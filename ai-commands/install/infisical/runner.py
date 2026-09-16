"""Profile-bound local dispatcher. Only non-secret configuration crosses SSH."""
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from urllib.parse import urlsplit


class Blocked(Exception):
    pass


CONFIG_ENV_FIELDS = {
    'VERSION': 'version', 'COMMAND': 'command', 'SSH_TARGET': 'ssh_target',
    'REMOTE_ROOT': 'remote_root', 'PROJECT_NAME': 'project_name', 'SITE_URL': 'site_url',
    'BACKEND_PORT': 'backend_port', 'MINIMUM_CPUS': 'minimum_cpus',
    'MINIMUM_MEMORY_GIB': 'minimum_memory_gib', 'MINIMUM_FREE_DISK_GIB': 'minimum_free_disk_gib',
    'HEALTH_TIMEOUT_SECONDS': 'health_timeout_seconds', 'SSH_TIMEOUT_SECONDS': 'ssh_timeout_seconds',
    'SMTP_ENV_FILE': 'smtp_env_file', 'BACKEND_IMAGE': 'backend', 'POSTGRES_IMAGE': 'db', 'REDIS_IMAGE': 'redis'}
INTEGER_FIELDS = {'version', 'backend_port', 'minimum_cpus', 'minimum_memory_gib',
                  'minimum_free_disk_gib', 'health_timeout_seconds', 'ssh_timeout_seconds'}


def parse_configuration(text):
    # Compatibility with existing JSON inputs; new configuration follows config.env conventions.
    if text.lstrip().startswith('{'):
        return json.loads(text, object_pairs_hook=object_without_duplicates)
    cfg = {'images': {}}
    seen = set()
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator or key not in CONFIG_ENV_FIELDS or key in seen:
            raise Blocked('unsupported or duplicate config.env field')
        if '$' in value or '`' in value:
            raise Blocked('config.env expressions and interpolation are unsupported')
        values = shlex.split(value, comments=True, posix=True)
        if len(values) > 1:
            raise Blocked('config.env values must be single literal values')
        value = values[0] if values else ''
        field = CONFIG_ENV_FIELDS[key]
        if field in INTEGER_FIELDS:
            if not re.fullmatch('[0-9]+', value):
                raise Blocked('config.env integer field required')
            value = int(value)
        if key in ('BACKEND_IMAGE', 'POSTGRES_IMAGE', 'REDIS_IMAGE'):
            cfg['images'][field] = value
        else:
            cfg[field] = value
        seen.add(key)
    return cfg


def object_without_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise Blocked('duplicate configuration key')
        result[key] = value
    return result


def load_config(config_path, profile_path):
    profile_root = Path(profile_path).resolve().parent
    path = Path(config_path).resolve()
    if profile_root not in path.parents or not path.is_file() or path.stat().st_size > 16384:
        raise Blocked('configuration must be a bounded file inside the activated profile')
    try:
        cfg = parse_configuration(path.read_text())
    except (ValueError, OSError, UnicodeError):
        raise Blocked('configuration must be valid config.env or legacy JSON; values are not included in diagnostics')
    required = {'version', 'command', 'ssh_target', 'remote_root', 'project_name', 'site_url', 'images'}
    optional = {'backend_port', 'minimum_cpus', 'minimum_memory_gib', 'minimum_free_disk_gib',
                'health_timeout_seconds', 'ssh_timeout_seconds', 'smtp_env_file'}
    if not isinstance(cfg, dict) or not required <= cfg.keys() or cfg.keys() - required - optional:
        raise Blocked('missing or unsupported configuration keys')
    if type(cfg['version']) is not int or cfg['version'] != 1 or cfg['command'] != 'infisical':
        raise Blocked('wrong configuration version or command')
    for key, pattern in [('ssh_target', r'[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}'),
                         ('project_name', r'[a-z][a-z0-9_-]{2,40}')]:
        if not isinstance(cfg[key], str) or not re.fullmatch(pattern, cfg[key]):
            raise Blocked('invalid ' + key)
    root = cfg['remote_root']
    if not isinstance(root, str) or not re.fullmatch(r'/[A-Za-z0-9._/-]+', root):
        raise Blocked('invalid remote deployment root')
    parts = root.split('/')[1:]
    if len(parts) < 2 or any(part in ('', '.', '..') for part in parts):
        raise Blocked('remote deployment root must be an explicit child directory')
    site = cfg['site_url']
    if not isinstance(site, str):
        raise Blocked('invalid site URL')
    try:
        url = urlsplit(site)
        url.port  # Validate the optional numeric port.
    except ValueError:
        raise Blocked('invalid site URL')
    if (url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password
            or url.path not in ('', '/') or url.query or url.fragment or '\n' in site
            or '\r' in site or not re.fullmatch(r'[A-Za-z0-9.-]+', url.hostname)
            or (url.scheme == 'http' and url.hostname not in ('localhost', '127.0.0.1'))):
        raise Blocked('site URL requires HTTPS, or HTTP on an explicit loopback host')
    images = cfg['images']
    if not isinstance(images, dict) or set(images) != {'backend', 'db', 'redis'}:
        raise Blocked('three explicit image references required')
    if any(not isinstance(image, str) or not re.fullmatch(
            r'[A-Za-z0-9][A-Za-z0-9._/:-]*@sha256:[a-f0-9]{64}', image)
           for image in images.values()):
        raise Blocked('all images must use approved immutable sha256 digests')
    if not re.fullmatch(r'(?:[A-Za-z0-9._/:-]+/)?postgres:(?:14|15|16|17)(?:\.[0-9]+)*(?:-[A-Za-z0-9.-]+)?@sha256:[a-f0-9]{64}', images['db']):
        raise Blocked('PostgreSQL 14-17 tagged digest required for the supported data-directory layout')
    for key, default, lower, upper in [
            ('backend_port', 8080, 1024, 65535), ('minimum_cpus', 2, 2, 256),
            ('minimum_memory_gib', 4, 4, 4096), ('minimum_free_disk_gib', 20, 20, 65536),
            ('health_timeout_seconds', 120, 10, 600), ('ssh_timeout_seconds', 900, 30, 3600)]:
        value = cfg.setdefault(key, default)
        if type(value) is not int or not lower <= value <= upper:
            raise Blocked('invalid ' + key)
    smtp = cfg.setdefault('smtp_env_file', '')
    if (not isinstance(smtp, str) or (smtp and (not re.fullmatch(r'/[A-Za-z0-9._/-]+', smtp)
                                               or any(x in ('', '.', '..') for x in smtp.split('/')[1:])))):
        raise Blocked('SMTP must reference an explicit protected remote file')
    return cfg


def validate_receipt(receipt, cfg, source, returncode):
    allowed = {'status', 'code', 'services', 'images', 'dataPreserved', 'initialAccountSetupRequired'}
    if not isinstance(receipt, dict) or receipt.keys() - allowed:
        raise Blocked('remote receipt shape rejected')
    statuses = {'QUALIFIED', 'HEALTHY', 'STOPPED'} if returncode == 0 else {'BLOCKED'}
    codes = set(re.findall(r"RemoteBlocked\('([A-Z_]+)'\)", source))
    codes.add('REMOTE_FAILURE_RESOURCES_RETAINED')
    if (not isinstance(receipt.get('status'), str) or receipt['status'] not in statuses or receipt.get('dataPreserved') is not True
            or ('code' in receipt and (not isinstance(receipt['code'], str) or receipt['code'] not in codes))
            or ('initialAccountSetupRequired' in receipt and type(receipt['initialAccountSetupRequired']) is not bool)
            or ('images' in receipt and receipt['images'] != cfg['images'])
            or ('services' in receipt and receipt['services'] != dict.fromkeys(('backend', 'db', 'redis'), 'healthy'))
            or (receipt.get('status') == 'HEALTHY' and not {'services', 'images'} <= receipt.keys())):
        raise Blocked('remote receipt values rejected')


def main():
    try:
        args = sys.argv[1:]
        if not args or args[0] not in ('validate', 'qualify', 'status', 'install', 'start', 'stop'):
            raise Blocked('usage: validate|qualify|status or install|start|stop --apply')
        operation = args[0]
        if args[1:] != (['--apply'] if operation in ('install', 'start', 'stop') else []):
            raise Blocked('mutations require the exact --apply flag; other arguments are unsupported')
        profile = os.environ.get('AI_PROFILE_FILE', '')
        config = os.environ.get('AI_COMMAND_CONFIG_PATH', '')
        scope = {key: os.environ.get(env, '') for key, env in [
            ('profile', 'AI_WORK_PROFILE_ID'), ('workflow', 'AI_FLOW_WORKFLOW'),
            ('logical_project', 'AI_LOGICAL_PROJECT_ID')]}
        if not profile or not config or not all(scope.values()):
            raise Blocked('activated profile, workflow, logical project and command configuration required')
        cfg = load_config(config, profile)
        if operation == 'validate':
            print(json.dumps({'status': 'VALIDATED', 'networkAccess': False, 'secretValues': False}))
            return 0
        source = Path(__file__).with_name('remote.py').read_text()
        source += '\nif __name__ == "__main__":\n    remote_main(' + repr(cfg) + ',' + repr(scope) + ',' + repr(operation) + ')\n'
        try:
            result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                                     '-o', 'ConnectTimeout=10', '--', cfg['ssh_target'], 'python3 -'],
                                    input=source, capture_output=True, text=True,
                                    timeout=cfg['ssh_timeout_seconds'])
        except (OSError, subprocess.TimeoutExpired):
            raise Blocked('SSH unavailable or timed out; no automatic retry; remote state may require status inspection')
        # Never relay untrusted SSH banners, Docker diagnostics or raw env/config output.
        try:
            receipt = json.loads(result.stdout)
        except ValueError:
            raise Blocked('remote execution returned no valid value-free receipt')
        validate_receipt(receipt, cfg, source, result.returncode)
        print(json.dumps(receipt, separators=(',', ':')))
        return 0 if result.returncode == 0 else 2
    except (Blocked, OSError) as error:
        # Blocked messages are fixed descriptions, never interpolated input values.
        print(json.dumps({'status': 'BLOCKED', 'code': str(error)}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
