#!/usr/bin/env python3
import re
import sys
from pathlib import Path

EXPECTED_ROLES = {
    'admin', 'designer-reviewer', 'judge', 'manager', 'coder',
    'command-runner', 'ui-acceptance-tester', 'proxy-coder',
}
EXPECTED_FIELDS = {'account_name', 'display_name', 'email', 'github_login'}
EXPECTED_TOP = {'version', 'enabled', 'email_domain', 'public_repository_mode', 'private_repository_mode', 'roles'}


def fail(message: str) -> None:
    raise SystemExit(f'Agent identity validation failed: {message}')


def parse(path: Path) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    top: dict[str, str] = {}
    roles: dict[str, dict[str, str]] = {}
    current_role: str | None = None
    for number, raw in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        match = re.fullmatch(r'(?:(  )|(    ))?([a-z][a-z0-9_-]*):(?: (.*))?', raw)
        if not match:
            fail(f'unsupported YAML shape at line {number}')
        indent = len(match.group(1) or match.group(2) or '')
        key, value = match.group(3), match.group(4)
        if indent == 0:
            current_role = None
            if key in top:
                fail(f'duplicate top-level key {key}')
            top[key] = value or ''
        elif indent == 2:
            if list(top)[-1] != 'roles' or value is not None:
                fail(f'invalid role declaration at line {number}')
            if key in roles:
                fail(f'duplicate role {key}')
            roles[key] = {}
            current_role = key
        elif indent == 4:
            if current_role is None or value is None:
                fail(f'field outside role at line {number}')
            if key in roles[current_role]:
                fail(f'duplicate field {current_role}.{key}')
            roles[current_role][key] = value
        else:
            fail(f'unsupported indentation at line {number}')
    return top, roles


def main() -> None:
    if len(sys.argv) != 3:
        fail('usage: validate-agent-identities.py FILE EXPECTED_DOMAIN')
    path, domain = Path(sys.argv[1]), sys.argv[2]
    top, roles = parse(path)
    if set(top) != EXPECTED_TOP:
        fail(f'top-level key set mismatch: {sorted(set(top) ^ EXPECTED_TOP)}')
    if top.get('version') != '1' or top.get('roles') != '':
        fail('version or roles mapping marker mismatch')
    if top.get('enabled') != 'false':
        fail('example identities must be disabled')
    if top.get('email_domain') != domain:
        fail('email_domain mismatch')
    if top.get('public_repository_mode') != 'provenance-only':
        fail('public_repository_mode mismatch')
    if top.get('private_repository_mode') != 'provider-account':
        fail('private_repository_mode mismatch')
    if set(roles) != EXPECTED_ROLES:
        fail(f'role set mismatch: {sorted(set(roles) ^ EXPECTED_ROLES)}')
    values = {field: [] for field in ('account_name', 'email', 'github_login')}
    for role, fields in roles.items():
        if set(fields) != EXPECTED_FIELDS:
            fail(f'{role} field set mismatch')
        if not fields['display_name'].strip():
            fail(f'{role} display_name is empty')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', fields['account_name']):
            fail(f'{role} account_name is not lowercase kebab')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*@' + re.escape(domain), fields['email']):
            fail(f'{role} email is outside expected domain')
        if not re.fullmatch(r'example-[a-z0-9]+(?:-[a-z0-9]+)*', fields['github_login']):
            fail(f'{role} GitHub login is not a generic example')
        for field in values:
            values[field].append(fields[field].lower())
    for field, items in values.items():
        if len(items) != len(set(items)):
            fail(f'duplicate {field}')
    print('Agent identity example: PASS')


if __name__ == '__main__':
    main()
