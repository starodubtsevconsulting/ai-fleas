"""Remote mechanics; transmitted over SSH and executed only on the selected host."""
import fcntl
import json
import os
from pathlib import Path
import platform
import re
import secrets
import shutil
import socket
import stat
import subprocess
import time


class RemoteBlocked(Exception):
    pass


def run(args, cwd=None):
    try:
        result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=600)
    except (OSError, subprocess.TimeoutExpired):
        raise RemoteBlocked('REMOTE_TOOL_UNAVAILABLE_OR_TIMED_OUT')
    if result.returncode:
        raise RemoteBlocked('REMOTE_TOOL_FAILED_RESOURCES_RETAINED')
    return result.stdout


def protected_file(path):
    if path.is_symlink() or not path.is_file():
        raise RemoteBlocked('PROTECTED_FILE_MISSING_OR_SYMLINK')
    mode = path.stat()
    if stat.S_IMODE(mode.st_mode) != 0o600 or mode.st_uid != os.getuid():
        raise RemoteBlocked('PROTECTED_FILE_PERMISSION_OR_OWNER_MISMATCH')


def private_write(path, content):
    descriptor = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as stream:
        stream.write(content)


def compose_document(cfg):
    health = {'interval': '5s', 'timeout': '5s', 'retries': 24, 'start_period': '30s'}
    backend_health = dict(health, test=['CMD', 'node', '-e',
        "require('http').get('http://127.0.0.1:8080/api/status',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"])
    env_files = ['backend.env'] + (['smtp.env'] if cfg['smtp_env_file'] else [])
    return {'services': {
        'backend': {'image': cfg['images']['backend'], 'restart': 'unless-stopped',
                    'env_file': env_files, 'environment': {'NODE_ENV': 'production'},
                    'ports': ['127.0.0.1:' + str(cfg['backend_port']) + ':8080'],
                    'depends_on': {'db': {'condition': 'service_healthy'}, 'redis': {'condition': 'service_healthy'}},
                    'networks': ['private', 'outbound'], 'healthcheck': backend_health},
        'db': {'image': cfg['images']['db'], 'restart': 'unless-stopped', 'env_file': ['db.env'],
               'volumes': ['pg_data:/var/lib/postgresql/data'], 'networks': ['private'],
               'healthcheck': dict(health, test=['CMD', 'pg_isready', '-U', 'infisical', '-d', 'infisical'])},
        'redis': {'image': cfg['images']['redis'], 'restart': 'unless-stopped', 'env_file': ['redis.env'],
                  'command': ['sh', '-c', 'exec redis-server --appendonly yes --requirepass "$$REDIS_PASSWORD"'],
                  'volumes': ['redis_data:/data'], 'networks': ['private'],
                  'healthcheck': dict(health, test=['CMD-SHELL', 'REDISCLI_AUTH="$$REDIS_PASSWORD" redis-cli ping | grep -qx PONG'])}},
        'volumes': {'pg_data': {}, 'redis_data': {}},
        'networks': {'private': {'internal': True}, 'outbound': {}}}


def smtp_content(path):
    protected_file(path)
    if path.stat().st_size > 8192:
        raise RemoteBlocked('SMTP_FILE_TOO_LARGE')
    content = path.read_text()
    allowed = {'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_ADDRESS',
               'SMTP_FROM_NAME', 'SMTP_HELO_HOST', 'SMTP_IGNORE_TLS', 'SMTP_REQUIRE_TLS',
               'SMTP_TLS_REJECT_UNAUTHORIZED'}
    values = {}
    for line in content.splitlines():
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if (not separator or key not in allowed or key in values or value != value.strip()
                or any(x in value for x in ('$', '\\', '"', "'", '#'))):
            raise RemoteBlocked('SMTP_FILE_UNSUPPORTED_OR_DUPLICATE_FIELDS')
        values[key] = value
    if not all(values.get(k) for k in ('SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM_ADDRESS')):
        raise RemoteBlocked('SMTP_FILE_REQUIRED_FIELDS_MISSING')
    if not values['SMTP_PORT'].isdigit() or not 1 <= int(values['SMTP_PORT']) <= 65535:
        raise RemoteBlocked('SMTP_PORT_INVALID')
    if values.get('SMTP_IGNORE_TLS', 'false') != 'false' or values.get('SMTP_REQUIRE_TLS', 'true') != 'true' or values.get('SMTP_TLS_REJECT_UNAUTHORIZED', 'true') != 'true':
        raise RemoteBlocked('SMTP_TLS_VALIDATION_REQUIRED')
    values.update(SMTP_IGNORE_TLS='false', SMTP_REQUIRE_TLS='true', SMTP_TLS_REJECT_UNAUTHORIZED='true')
    return ''.join(key + '=' + value + '\n' for key, value in values.items())


def qualify(cfg, fresh):
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'aarch64'):
        raise RemoteBlocked('SUPPORTED_LINUX_ARCHITECTURE_REQUIRED')
    run(['docker', 'info', '--format', '{{json .ServerVersion}}'])
    version = run(['docker', 'compose', 'version', '--short']).strip().lstrip('v')
    if not version or not version.split('.')[0].isdigit() or int(version.split('.')[0]) < 2:
        raise RemoteBlocked('DOCKER_COMPOSE_V2_REQUIRED')
    if fresh:
        if (os.cpu_count() or 0) < cfg['minimum_cpus']:
            raise RemoteBlocked('INSUFFICIENT_CPU')
        memory = next(int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:'))
        if memory < cfg['minimum_memory_gib'] * 1024 ** 3:
            raise RemoteBlocked('INSUFFICIENT_MEMORY')
        parent = Path(cfg['remote_root']).parent
        while not parent.exists():
            parent = parent.parent
        if shutil.disk_usage(parent).free < cfg['minimum_free_disk_gib'] * 1024 ** 3:
            raise RemoteBlocked('INSUFFICIENT_DISK')
        try:
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', cfg['backend_port']))
        except OSError:
            raise RemoteBlocked('BACKEND_PORT_OCCUPIED')


def owner_record(cfg, scope):
    # No credentials: only scope and reviewed non-secret input/reference values.
    return {'version': 1, 'command': 'infisical', 'scope': scope, 'configuration': cfg}


def ensure_owner(root, cfg, scope):
    for parent in [root] + list(root.parents):
        if parent.is_symlink():
            raise RemoteBlocked('DEPLOYMENT_PATH_SYMLINK')
    protected_file(root / 'owner.json')
    if json.loads((root / 'owner.json').read_text()) != owner_record(cfg, scope):
        raise RemoteBlocked('DEPLOYMENT_OWNERSHIP_OR_CONFIGURATION_MISMATCH')
    if stat.S_IMODE(root.stat().st_mode) != 0o700 or root.stat().st_uid != os.getuid():
        raise RemoteBlocked('DEPLOYMENT_DIRECTORY_PERMISSION_MISMATCH')


def verify_files(root, cfg):
    for name in ['compose.json', 'backend.env', 'db.env', 'redis.env'] + (['smtp.env'] if cfg['smtp_env_file'] else []):
        protected_file(root / name)
    if json.loads((root / 'compose.json').read_text()) != compose_document(cfg):
        raise RemoteBlocked('COMPOSE_DOCUMENT_MODIFIED')
    # Refuse missing material instead of generating replacement encryption keys.
    def environment(name, keys):
        values = {}
        for line in (root / name).read_text().splitlines():
            key, separator, value = line.partition('=')
            if not separator or key in values or key not in keys or not value:
                raise RemoteBlocked('EXISTING_CREDENTIAL_MATERIAL_INCOMPLETE')
            values[key] = value
        if set(values) != keys:
            raise RemoteBlocked('EXISTING_CREDENTIAL_MATERIAL_INCOMPLETE')
        return values
    backend = environment('backend.env', {'ENCRYPTION_KEY', 'AUTH_SECRET', 'DB_CONNECTION_URI', 'REDIS_URL', 'SITE_URL'})
    db = environment('db.env', {'POSTGRES_USER', 'POSTGRES_DB', 'POSTGRES_PASSWORD'})
    redis = environment('redis.env', {'REDIS_PASSWORD'})
    if (not re.fullmatch('[a-f0-9]{32}', backend['ENCRYPTION_KEY'])
            or not re.fullmatch('[A-Za-z0-9_-]{43}', backend['AUTH_SECRET'])
            or not re.fullmatch('[a-f0-9]{64}', db['POSTGRES_PASSWORD'])
            or not re.fullmatch('[a-f0-9]{64}', redis['REDIS_PASSWORD'])
            or db['POSTGRES_USER'] != 'infisical' or db['POSTGRES_DB'] != 'infisical'
            or backend['DB_CONNECTION_URI'] != 'postgresql://infisical:' + db['POSTGRES_PASSWORD'] + '@db:5432/infisical'
            or backend['REDIS_URL'] != 'redis://:' + redis['REDIS_PASSWORD'] + '@redis:6379'
            or backend['SITE_URL'] != cfg['site_url']):
        raise RemoteBlocked('EXISTING_CREDENTIAL_MATERIAL_INCOMPLETE')


def create_files(root, cfg, scope, smtp):
    # mkdir is exclusive; never claim an unknown existing directory.
    root.mkdir(mode=0o700, parents=False, exist_ok=False)
    private_write(root / 'owner.json', json.dumps(owner_record(cfg, scope)))
    password = secrets.token_hex(32)
    redis_password = secrets.token_hex(32)
    backend = {'ENCRYPTION_KEY': secrets.token_hex(16), 'AUTH_SECRET': secrets.token_urlsafe(32),
               'DB_CONNECTION_URI': 'postgresql://infisical:' + password + '@db:5432/infisical',
               'REDIS_URL': 'redis://:' + redis_password + '@redis:6379', 'SITE_URL': cfg['site_url']}
    private_write(root / 'backend.env', ''.join(k + '=' + v + '\n' for k, v in backend.items()))
    private_write(root / 'db.env', 'POSTGRES_USER=infisical\nPOSTGRES_DB=infisical\nPOSTGRES_PASSWORD=' + password + '\n')
    private_write(root / 'redis.env', 'REDIS_PASSWORD=' + redis_password + '\n')
    if smtp is not None:
        private_write(root / 'smtp.env', smtp)
    private_write(root / 'compose.json', json.dumps(compose_document(cfg)))


def inspect_services(compose, cfg, require_healthy, allow_missing=False):
    services = {}
    images = {}
    for name in ('backend', 'db', 'redis'):
        identifier = run(compose + ['ps', '--all', '--quiet', name]).strip()
        if not identifier and allow_missing:
            continue
        if not identifier or len(identifier.splitlines()) != 1:
            raise RemoteBlocked('OWNED_SERVICE_MISSING_OR_DUPLICATE')
        data = json.loads(run(['docker', 'inspect', identifier]))[0]
        if data['Config']['Labels'].get('com.docker.compose.project') != cfg['project_name'] or data['Config']['Labels'].get('com.docker.compose.service') != name:
            raise RemoteBlocked('CONTAINER_OWNERSHIP_MISMATCH')
        if data['Config']['Image'] != cfg['images'][name]:
            raise RemoteBlocked('CONTAINER_IMAGE_MISMATCH')
        ports = data['HostConfig'].get('PortBindings', {}) or {}
        if name == 'backend':
            if ports != {'8080/tcp': [{'HostIp': '127.0.0.1', 'HostPort': str(cfg['backend_port'])}]}:
                raise RemoteBlocked('BACKEND_LISTENER_ISOLATION_FAILED')
        elif any(ports.values()):
            raise RemoteBlocked('DATABASE_OR_REDIS_PUBLICATION_FORBIDDEN')
        expected_networks = {cfg['project_name'] + '_private'}
        if name == 'backend':
            expected_networks.add(cfg['project_name'] + '_outbound')
        if set(data.get('NetworkSettings', {}).get('Networks', {})) != expected_networks:
            raise RemoteBlocked('CONTAINER_NETWORK_ISOLATION_FAILED')
        state = data['State']
        services[name] = 'healthy' if state.get('Running') and state.get('Health', {}).get('Status') == 'healthy' else 'not-healthy'
        if require_healthy and services[name] != 'healthy':
            raise RemoteBlocked('SERVICES_NOT_HEALTHY')
        images[name] = cfg['images'][name]
    return services, images


def perform(cfg, scope, operation):
    root = Path(cfg['remote_root'])
    for parent in [root] + list(root.parents):
        if parent.is_symlink():
            raise RemoteBlocked('DEPLOYMENT_PATH_SYMLINK')
    if operation == 'qualify':
        qualify(cfg, not root.exists())
        return {'status': 'QUALIFIED', 'dataPreserved': True}
    fresh = not root.exists()
    if not fresh:
        ensure_owner(root, cfg, scope)
    elif operation != 'install':
        raise RemoteBlocked('NO_PACKAGE_OWNED_DEPLOYMENT')
    qualify(cfg, fresh)
    if fresh:
        # Existing project resources without this package receipt must not be adopted.
        for kind in ('container', 'volume', 'network'):
            if run(['docker', kind, 'ls', '--quiet', '--filter', 'label=com.docker.compose.project=' + cfg['project_name']]).strip():
                raise RemoteBlocked('UNKNOWN_EXISTING_PROJECT_RESOURCES')
        for kind, suffix in [('volume', '(pg_data|redis_data)'), ('network', '(private|outbound)')]:
            if run(['docker', kind, 'ls', '--quiet', '--filter', 'name=^' + cfg['project_name'] + '_' + suffix + '$']).strip():
                raise RemoteBlocked('UNKNOWN_EXISTING_NAMED_RESOURCES')
        if not root.parent.is_dir():
            raise RemoteBlocked('DEPLOYMENT_PARENT_MUST_ALREADY_EXIST')
        smtp = smtp_content(Path(cfg['smtp_env_file'])) if cfg['smtp_env_file'] else None
        create_files(root, cfg, scope, smtp)
    ensure_owner(root, cfg, scope)
    # Prevent two operations from mutating or observing a partial stack concurrently.
    lock_path = root / 'operation.lock'
    if lock_path.is_symlink():
        raise RemoteBlocked('LOCK_PATH_SYMLINK')
    if lock_path.exists():
        protected_file(lock_path)
    read_only = operation == 'status'
    flags = os.O_RDONLY if read_only else os.O_RDWR | os.O_CREAT
    descriptor = os.open(str(lock_path), flags | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'r' if read_only else 'r+') as lock:
        try:
            fcntl.flock(lock, (fcntl.LOCK_SH if read_only else fcntl.LOCK_EX) | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RemoteBlocked('DEPLOYMENT_OPERATION_ALREADY_RUNNING')
        verify_files(root, cfg)
        compose = ['docker', 'compose', '--project-name', cfg['project_name'], '--project-directory', str(root), '-f', str(root / 'compose.json')]
        run(compose + ['config', '--quiet'])
        if not fresh:
            # Inspect actual existing containers before any start, replacement or stop.
            inspect_services(compose, cfg, False, allow_missing=operation in ('install', 'start'))
        if operation == 'stop':
            run(compose + ['stop', '--timeout', '30'])
            for name in ('backend', 'db', 'redis'):
                identifier = run(compose + ['ps', '--all', '--quiet', name]).strip()
                if not identifier or json.loads(run(['docker', 'inspect', identifier]))[0]['State'].get('Running'):
                    raise RemoteBlocked('STOP_VERIFICATION_FAILED')
            return {'status': 'STOPPED', 'dataPreserved': True}
        if operation in ('install', 'start'):
            if operation == 'install':
                run(compose + ['pull', '--quiet'])
            run(compose + ['up', '--detach'])
            deadline = time.monotonic() + cfg['health_timeout_seconds']
            while True:
                try:
                    services, images = inspect_services(compose, cfg, True)
                    break
                except RemoteBlocked as error:
                    if str(error) != 'SERVICES_NOT_HEALTHY' or time.monotonic() >= deadline:
                        raise
                    time.sleep(2)
        else:
            services, images = inspect_services(compose, cfg, True)
        return {'status': 'HEALTHY', 'services': services, 'images': images, 'dataPreserved': True,
                'initialAccountSetupRequired': fresh}


def remote_main(cfg, scope, operation):
    try:
        receipt = perform(cfg, scope, operation)
        code = 0
    except RemoteBlocked as error:
        receipt = {'status': 'BLOCKED', 'code': str(error), 'dataPreserved': True}
        code = 2
    except Exception:
        # No traceback, command stderr, configuration or credential values leave this host.
        receipt = {'status': 'BLOCKED', 'code': 'REMOTE_FAILURE_RESOURCES_RETAINED', 'dataPreserved': True}
        code = 2
    print(json.dumps(receipt, separators=(',', ':')))
    raise SystemExit(code)
