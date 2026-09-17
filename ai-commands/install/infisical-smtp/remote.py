"""Remote SMTP overlay reconciliation. Never emit protected contents or raw tool output."""
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time

class Blocked(Exception):
    pass


SMTP_KEYS = {'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD',
             'SMTP_FROM_ADDRESS', 'SMTP_FROM_NAME', 'SMTP_HELO_HOST',
             'SMTP_IGNORE_TLS', 'SMTP_REQUIRE_TLS', 'SMTP_TLS_REJECT_UNAUTHORIZED'}
REQUIRED = {'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD',
            'SMTP_FROM_ADDRESS', 'SMTP_IGNORE_TLS', 'SMTP_REQUIRE_TLS',
            'SMTP_TLS_REJECT_UNAUTHORIZED'}
SAFE_CODES = {'BACKEND_ENV_INVALID', 'BACKEND_MISSING', 'BACKEND_NOT_HEALTHY',
              'BACKEND_STRUCTURE_INVALID', 'BACKUP_DIRECTORY_REQUIRED',
              'COMPOSE_STRUCTURE_INVALID', 'DOCKER_OPERATION_FAILED',
              'OTHER_ENV_FILE_PRESENT', 'OVERLAY_APPLY_FAILED_RESTORED',
              'OVERLAY_DRIFT', 'OWNERSHIP_OR_BASELINE_DRIFT',
              'OWNERSHIP_RECEIPT_REQUIRED', 'PROTECTED_FILE_REQUIRED',
              'ROOT_OWNERSHIP_REQUIRED', 'SMTP_FILE_INVALID',
              'UNRELATED_COMPOSE_CHANGE', 'UNRELATED_SMTP_ENV_PRESENT'}


def protected(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        raise Blocked('PROTECTED_FILE_REQUIRED')


def smtp_values(cfg):
    path = Path(cfg['SMTP_ENV_FILE'])
    protected(path)
    if path.stat().st_size > 8192:
        raise Blocked('SMTP_FILE_INVALID')
    values = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if (not sep or key not in SMTP_KEYS or key in values or value != value.strip()
                or any(char in value for char in '$`\'"\\#')):
            raise Blocked('SMTP_FILE_INVALID')
        values[key] = value
    if (not REQUIRED <= values.keys() or not all(values[key] for key in REQUIRED)
            or values['SMTP_HOST'] != cfg['EXPECTED_SMTP_HOST']
            or values['SMTP_PORT'] != cfg['EXPECTED_SMTP_PORT']
            or values['SMTP_USERNAME'] != cfg['EXPECTED_SMTP_USERNAME']
            or values['SMTP_FROM_ADDRESS'] != cfg['EXPECTED_SMTP_FROM_ADDRESS']
            or values['SMTP_IGNORE_TLS'] != 'false'
            or values['SMTP_REQUIRE_TLS'] != 'true'
            or values['SMTP_TLS_REJECT_UNAUTHORIZED'] != 'true'):
        raise Blocked('SMTP_FILE_INVALID')
    return values


def docker(cfg, *args):
    command = ['docker', 'compose', '--project-name', cfg['PROJECT_NAME'],
               '--project-directory', cfg['REMOTE_ROOT'], '-f', cfg['COMPOSE_FILE']]
    result = subprocess.run(command + list(args), cwd=cfg['REMOTE_ROOT'], capture_output=True, timeout=180)
    if result.returncode:
        raise Blocked('DOCKER_OPERATION_FAILED')
    return result.stdout


def resolved(cfg):
    return json.loads(docker(cfg, 'config', '--format', 'json'))


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def baseline(document, backend):
    normalized = copy.deepcopy(document)
    env = normalized['services'][backend].get('environment', {})
    if not isinstance(env, dict):
        raise Blocked('BACKEND_ENV_INVALID')
    normalized['services'][backend]['environment'] = {k: v for k, v in env.items() if k not in SMTP_KEYS}
    return fingerprint(normalized)


def source_state(cfg):
    path = Path(cfg['COMPOSE_FILE'])
    protected(path)
    source = path.read_text()
    lines = source.splitlines(keepends=True)
    if sum(line.strip() == 'services:' and line.startswith('services:') for line in lines) != 1:
        raise Blocked('COMPOSE_STRUCTURE_INVALID')
    anchors = [i for i, line in enumerate(lines)
               if line == '  ' + cfg['BACKEND_SERVICE'] + ':\n']
    if len(anchors) != 1:
        raise Blocked('BACKEND_STRUCTURE_INVALID')
    start = anchors[0]
    end = next((i for i in range(start + 1, len(lines))
                if ((lines[i] and not lines[i][0].isspace())
                    or re.fullmatch(r'  [A-Za-z0-9_-]+:\s*', lines[i]))), len(lines))
    block = lines[start + 1:end]
    env_positions = [i for i, text in enumerate(block) if text == '    env_file:\n']
    if len(env_positions) > 1 or any(text.lstrip().startswith('env_file:') and text != '    env_file:\n' for text in block):
        raise Blocked('OTHER_ENV_FILE_PRESENT')
    present = bool(env_positions)
    if present and (env_positions[0] + 1 >= len(block)
                    or block[env_positions[0] + 1] != '      - ' + cfg['SMTP_ENV_FILE'] + '\n'
                    or (env_positions[0] + 2 < len(block) and block[env_positions[0] + 2].startswith('      - '))):
        raise Blocked('OTHER_ENV_FILE_PRESENT')
    return source, present, start, 2


def atomic_write(path, data):
    fd, temporary = tempfile.mkstemp(prefix='.infisical-smtp.', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def receipt_path(cfg):
    return Path(cfg['REMOTE_ROOT']) / '.infisical-smtp-owner.json'


def expected_receipt(cfg, scope, base_hash):
    return {'version': 1, 'scope': scope, 'configHash': fingerprint(cfg), 'baselineHash': base_hash}


def check_receipt(cfg, scope, base_hash, required):
    path = receipt_path(cfg)
    if not path.exists():
        if required:
            raise Blocked('OWNERSHIP_RECEIPT_REQUIRED')
        return False
    protected(path)
    if json.loads(path.read_text()) != expected_receipt(cfg, scope, base_hash):
        raise Blocked('OWNERSHIP_OR_BASELINE_DRIFT')
    return True


def runtime_healthy(cfg, values):
    identifier = docker(cfg, 'ps', '-q', cfg['BACKEND_SERVICE']).decode().strip()
    if not identifier or '\n' in identifier:
        return False
    result = subprocess.run(['docker', 'inspect', identifier], capture_output=True, timeout=15)
    if result.returncode:
        return False
    container = json.loads(result.stdout)[0]
    labels = container.get('Config', {}).get('Labels', {})
    env = dict(entry.split('=', 1) for entry in container.get('Config', {}).get('Env', []) if '=' in entry)
    return (labels.get('com.docker.compose.project') == cfg['PROJECT_NAME']
            and labels.get('com.docker.compose.service') == cfg['BACKEND_SERVICE']
            and container.get('State', {}).get('Health', {}).get('Status') == 'healthy'
            and all(env.get(key) == value for key, value in values.items()))


def restart_and_wait(cfg, values):
    docker(cfg, 'up', '-d', '--no-deps', cfg['BACKEND_SERVICE'])
    for _ in range(60):
        if runtime_healthy(cfg, values):
            return
        time.sleep(2)
    raise Blocked('BACKEND_NOT_HEALTHY')


def compare_addition(before, after, cfg, values):
    backend = cfg['BACKEND_SERVICE']
    if set(before['services']) != set(after['services']):
        raise Blocked('UNRELATED_COMPOSE_CHANGE')
    for name in before['services']:
        old, new = copy.deepcopy(before['services'][name]), copy.deepcopy(after['services'][name])
        if name == backend:
            old_env, new_env = old.pop('environment', {}), new.pop('environment', {})
            old.pop('env_file', None)
            new.pop('env_file', None)
            if (old != new or not isinstance(old_env, dict) or not isinstance(new_env, dict)
                    or any(new_env.get(k) != v for k, v in old_env.items())
                    or set(new_env) - set(old_env) != set(values)
                    or any(new_env.get(k) != v for k, v in values.items())):
                raise Blocked('UNRELATED_COMPOSE_CHANGE')
        elif old != new:
            raise Blocked('UNRELATED_COMPOSE_CHANGE')


def ensure_root(root):
    if root.is_symlink() or not root.is_dir() or root.stat().st_uid != 0:
        raise Blocked('ROOT_OWNERSHIP_REQUIRED')


def reconcile(cfg, scope, operation):
    root = Path(cfg['REMOTE_ROOT'])
    ensure_root(root)
    values = smtp_values(cfg)
    source, present, line, column = source_state(cfg)
    current = resolved(cfg)
    backend = cfg['BACKEND_SERVICE']
    if backend not in current.get('services', {}):
        raise Blocked('BACKEND_MISSING')
    env = current['services'][backend].get('environment', {})
    if not isinstance(env, dict) or (set(env) & SMTP_KEYS) - (set(values) if present else set()):
        raise Blocked('UNRELATED_SMTP_ENV_PRESENT')
    base_hash = baseline(current, backend)
    owned = check_receipt(cfg, scope, base_hash, operation == 'status')
    if operation == 'status':
        if not present or any(env.get(k) != v for k, v in values.items()) or not runtime_healthy(cfg, values):
            raise Blocked('OVERLAY_DRIFT')
        return
    if present:
        if any(env.get(k) != v for k, v in values.items()):
            raise Blocked('OVERLAY_DRIFT')
        if not runtime_healthy(cfg, values):
            restart_and_wait(cfg, values)
    else:
        lines = source.splitlines(keepends=True)
        indent = ' ' * (column + 2)
        lines.insert(line + 1, indent + 'env_file:\n' + indent + '  - ' + cfg['SMTP_ENV_FILE'] + '\n')
        path = Path(cfg['COMPOSE_FILE'])
        backup_dir = root / 'backups'
        if not backup_dir.is_dir() or backup_dir.is_symlink():
            raise Blocked('BACKUP_DIRECTORY_REQUIRED')
        backup = backup_dir / ('compose.before-smtp.' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '.yml')
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(source.encode())
        atomic_write(path, ''.join(lines).encode())
        attempted_restart = False
        try:
            compare_addition(current, resolved(cfg), cfg, values)
            attempted_restart = True
            restart_and_wait(cfg, values)
        except Exception:
            atomic_write(path, source.encode())
            if attempted_restart:
                try:
                    docker(cfg, 'up', '-d', '--no-deps', backend)
                except Exception:
                    pass
            raise Blocked('OVERLAY_APPLY_FAILED_RESTORED')
    if not owned:
        atomic_write(receipt_path(cfg), json.dumps(expected_receipt(cfg, scope, base_hash), sort_keys=True).encode())


def main(cfg, scope, operation):
    try:
        reconcile(cfg, scope, operation)
        print(json.dumps({'status': 'HEALTHY', 'code': 'SMTP_OVERLAY_HEALTHY'}))
        return 0
    except Blocked as error:
        code = str(error)
        print(json.dumps({'status': 'BLOCKED', 'code': code if code in SAFE_CODES else 'REMOTE_CHECK_FAILED'}))
        return 2
    except Exception:
        print(json.dumps({'status': 'BLOCKED', 'code': 'REMOTE_CHECK_FAILED'}))
        return 2
