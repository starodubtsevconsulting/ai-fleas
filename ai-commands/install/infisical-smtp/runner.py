"""Profile-bound, value-free dispatcher for the existing-stack SMTP overlay."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys


class Blocked(Exception):
    pass


FIELDS = ('VERSION', 'COMMAND', 'SSH_TARGET', 'REMOTE_ROOT', 'COMPOSE_FILE',
          'SMTP_ENV_FILE', 'PROJECT_NAME', 'BACKEND_SERVICE', 'EXPECTED_SMTP_HOST',
          'EXPECTED_SMTP_PORT', 'EXPECTED_SMTP_USERNAME', 'EXPECTED_SMTP_FROM_ADDRESS')


def load_config(path, profile):
    profile_dir = Path(profile).resolve().parent
    source = Path(path).resolve()
    if profile_dir not in source.parents or not source.is_file() or source.stat().st_size > 8192:
        raise Blocked('PROFILE_CONFIG_REQUIRED')
    values = {}
    for line in source.read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        if not sep or key not in FIELDS or key in values or not value or value != value.strip():
            raise Blocked('CONFIG_FIELD_INVALID')
        if any(char in value for char in '$`\'"\\#;'):
            raise Blocked('CONFIG_VALUE_INVALID')
        values[key] = value
    if set(values) != set(FIELDS) or values['VERSION'] != '1' or values['COMMAND'] != 'infisical-smtp':
        raise Blocked('CONFIG_FIELDS_REQUIRED')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}', values['SSH_TARGET']):
        raise Blocked('SSH_TARGET_INVALID')
    root = values['REMOTE_ROOT']
    if not re.fullmatch(r'/[A-Za-z0-9._/-]+', root) or any(p in ('', '.', '..') for p in root.split('/')[1:]):
        raise Blocked('REMOTE_ROOT_INVALID')
    for field in ('COMPOSE_FILE', 'SMTP_ENV_FILE'):
        value = values[field]
        if (not re.fullmatch(r'/[A-Za-z0-9._/-]+', value)
                or any(p in ('', '.', '..') for p in value.split('/')[1:])
                or Path(value).parent != Path(root)):
            raise Blocked('REMOTE_FILE_INVALID')
    for field in ('PROJECT_NAME', 'BACKEND_SERVICE'):
        if not re.fullmatch(r'[a-z][a-z0-9_-]{1,63}', values[field]):
            raise Blocked('COMPOSE_ID_INVALID')
    if (not re.fullmatch(r'[A-Za-z0-9.-]+', values['EXPECTED_SMTP_HOST'])
            or not values['EXPECTED_SMTP_PORT'].isdigit()
            or not 1 <= int(values['EXPECTED_SMTP_PORT']) <= 65535
            or not re.fullmatch(r'[A-Za-z0-9_.@+-]+', values['EXPECTED_SMTP_USERNAME'])
            or not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', values['EXPECTED_SMTP_FROM_ADDRESS'])):
        raise Blocked('SMTP_METADATA_INVALID')
    return values


def main():
    try:
        args = sys.argv[1:]
        if args not in (['validate'], ['status'], ['apply', '--apply']):
            raise Blocked('OPERATION_INVALID')
        profile = os.environ.get('AI_PROFILE_FILE', '')
        config = os.environ.get('AI_COMMAND_CONFIG_PATH', '')
        scope = {key: os.environ.get(env, '') for key, env in (
            ('profile', 'AI_WORK_PROFILE_ID'), ('workflow', 'AI_FLOW_WORKFLOW'),
            ('logical_project', 'AI_LOGICAL_PROJECT_ID'))}
        if not profile or not config or not all(scope.values()):
            raise Blocked('PROFILE_SCOPE_REQUIRED')
        cfg = load_config(config, profile)
        if args == ['validate']:
            print(json.dumps({'status': 'VALIDATED', 'networkAccess': False}))
            return 0
        operation = args[0]
        source = Path(__file__).with_name('remote.py').read_text()
        source += '\nif __name__ == "__main__":\n    sys.exit(main(' + repr(cfg) + ',' + repr(scope) + ',' + repr(operation) + '))\n'
        try:
            result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                                     '-o', 'ConnectTimeout=10', '--', cfg['SSH_TARGET'], 'sudo -n python3 -'],
                                    input=source, capture_output=True, text=True, timeout=240)
            receipt = json.loads(result.stdout)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            raise Blocked('REMOTE_RECEIPT_UNAVAILABLE')
        safe_codes = {'SMTP_OVERLAY_HEALTHY', 'REMOTE_CHECK_FAILED'}
        for match in re.findall(r"raise Blocked\('([A-Z_]+)'\)", source):
            safe_codes.add(match)
        if (not isinstance(receipt, dict) or set(receipt) != {'status', 'code'}
                or receipt['status'] not in ('HEALTHY', 'BLOCKED')
                or receipt['code'] not in safe_codes
                or (result.returncode == 0) != (receipt['status'] == 'HEALTHY')):
            raise Blocked('REMOTE_RECEIPT_INVALID')
        print(json.dumps(receipt, separators=(',', ':')))
        return 0 if result.returncode == 0 else 2
    except (Blocked, OSError, UnicodeError) as error:
        print(json.dumps({'status': 'BLOCKED', 'code': str(error)}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
