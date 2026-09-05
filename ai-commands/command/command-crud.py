#!/usr/bin/env python3
"""Deterministic CRUD for definitions in one managed ai_commands_root."""
import argparse, filecmp, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROUTE_TOKEN = re.compile(r'^[a-z][a-z0-9-]*$')
PORTION_FIELDS = ('reasoning', 'implementation', 'execution', 'ui_acceptance')
PRUNE = {'.agent-runtime', '.local', 'session-root', 'sessions', 'node_modules',
         '.venv', 'dist', 'log', 'logs'}

def fail(message):
    print(f'command CRUD error: {message}', file=sys.stderr)
    raise SystemExit(1)

def root_path(value):
    root = Path(value).resolve()
    if not root.is_dir() or root == Path('/'):
        fail(f'command root must be an existing safe directory: {value}')
    return root

def rel_path(root, value):
    path = Path(value)
    if path.is_absolute() or '..' in path.parts or not value.endswith('.command.md'):
        fail('path must be a normalized relative *.command.md path')
    if any(c in value for c in '\t\r\n') or '\\' in value:
        fail('path contains an unsafe delimiter')
    resolved = (root / path).resolve()
    if root not in resolved.parents or resolved == root or resolved.is_symlink():
        fail('path escapes the managed command root or targets a symlink')
    return path

def files(root):
    for path in root.rglob('*'):
        if any(part in PRUNE for part in path.relative_to(root).parts):
            continue
        if path.is_symlink():
            fail(f'symlinks are forbidden in the managed command root: {path}')
        if path.is_file():
            yield path

def definitions(root):
    return sorted(p.relative_to(root).as_posix() for p in files(root) if p.name.endswith('.command.md'))

def read_registry(root):
    registry = root / 'execution-routes.tsv'
    if not registry.is_file() or registry.is_symlink(): fail('missing or unsafe execution-routes.tsv')
    rows, comments = {}, []
    for line in registry.read_text().splitlines():
        if not line or line.startswith('#'):
            comments.append(line); continue
        parts = line.split('\t')
        if len(parts) != 6 or parts[0] in rows: fail(f'invalid or duplicate route entry: {line}')
        rows[parts[0]] = parts[1:]
    return comments, rows

def route(args):
    if not args.route or not ROUTE_TOKEN.fullmatch(args.route):
        fail(f'invalid route token: {args.route}')
    values = [getattr(args, key) or '-' for key in PORTION_FIELDS]
    if args.route != 'mixed':
        if any(v != '-' for v in values): fail('non-mixed route cannot include portion mappings')
    else:
        for value in values:
            if value != '-' and not ROUTE_TOKEN.fullmatch(value):
                fail(f'invalid mixed portion route token: {value}')
        if sum(v != '-' for v in values) < 2: fail('mixed route needs at least two explicit portion mappings')
    return [args.route, *values]

def write_registry(root, comments, rows):
    lines = comments + [f'{path}\t' + '\t'.join(rows[path]) for path in sorted(rows)]
    (root / 'execution-routes.tsv').write_text('\n'.join(lines) + '\n')

def validate(root):
    test_mode = os.environ.get('COMMAND_CRUD_TEST_MODE')
    injected = os.environ.get('COMMAND_CRUD_TEST_FAIL_VALIDATE')
    if injected:
        if test_mode != '1' or injected != 'after-prepare':
            fail('unsafe validator failure injection request')
        fail('injected staged validator failure after mutation preparation')
    validator = root / 'validate-execution-routes.sh'
    if not validator.is_file(): fail('missing validate-execution-routes.sh')
    result = subprocess.run(['bash', str(validator), str(root)], text=True, capture_output=True)
    if result.returncode:
        fail('preflight validation failed: ' + (result.stderr or result.stdout).strip())

def references(root, needle, exclude=()):
    result = []
    for path in files(root):
        rel = path.relative_to(root).as_posix()
        if rel in exclude or path.name == 'execution-routes.tsv': continue
        try: text = path.read_text()
        except UnicodeDecodeError: continue
        if needle in text: result.append((rel, text.count(needle)))
    return result

def replace_exact(root, refs, old, new):
    for rel, _ in refs:
        path = root / rel
        path.write_text(path.read_text().replace(old, new))

def apply_stage(root, stage, touched, dry):
    plans = sorted(touched)
    print('plan=' + ','.join(plans))
    if dry: return
    test_mode = os.environ.get('COMMAND_CRUD_TEST_MODE')
    injected = os.environ.get('COMMAND_CRUD_TEST_FAIL_APPLY')
    if injected and (test_mode != '1' or injected != 'after-first-write'):
        fail('unsafe apply failure injection request')
    backup = Path(tempfile.mkdtemp(prefix='command-crud-backup-'))
    try:
        for rel in plans:
            source = root / rel
            if source.exists():
                target = backup / rel; target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(source, target)
        for index, rel in enumerate(plans):
            source, target = stage / rel, root / rel
            if source.exists():
                target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(source, target)
            elif target.exists(): target.unlink()
            if injected and index == 0:
                raise OSError('injected apply failure after first scoped write')
    except Exception:
        for rel in plans:
            original, target = backup / rel, root / rel
            if original.exists(): target.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(original, target)
            elif target.exists(): target.unlink()
        raise
    finally: shutil.rmtree(backup, ignore_errors=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--commands-root', default=str(Path(__file__).resolve().parent.parent))
    parser.add_argument('operation', choices=['list','show','check','create','update','rename','delete'])
    parser.add_argument('--path'); parser.add_argument('--new-path'); parser.add_argument('--route')
    parser.add_argument('--reasoning'); parser.add_argument('--implementation'); parser.add_argument('--execution'); parser.add_argument('--ui-acceptance')
    parser.add_argument('--content-file'); parser.add_argument('--dry-run', action='store_true'); parser.add_argument('--yes', action='store_true')
    args = parser.parse_args(); root = root_path(args.commands_root)
    if args.operation == 'list':
        _, rows = read_registry(root); print('\n'.join(f'{p}\t{rows[p][0]}' for p in sorted(rows))); return
    if args.operation == 'check': validate(root); print('status=checked'); return
    if not args.path: fail('--path is required')
    old = rel_path(root, args.path); target = root / old
    if args.operation == 'show':
        if not target.is_file(): fail(f'missing definition: {old}')
        _, rows = read_registry(root); print(f'path={old}\nroute=' + '\t'.join(rows[str(old)])); return
    with tempfile.TemporaryDirectory(prefix='command-crud-stage-') as tmp:
        stage = Path(tmp) / 'root'; shutil.copytree(root, stage, symlinks=True)
        comments, rows = read_registry(stage); touched = {'execution-routes.tsv'}
        if args.operation == 'create':
            if target.exists() or str(old) in rows: fail(f'duplicate definition or route: {old}')
            if not args.route: fail('--route is required')
            staged = stage / old; staged.parent.mkdir(parents=True, exist_ok=True)
            content = Path(args.content_file).read_text() if args.content_file else '# ' + old.stem.replace('.command','').replace('-', ' ').title() + '\n'
            staged.write_text(content); rows[str(old)] = route(args); touched.add(str(old))
        elif args.operation == 'update':
            if not target.is_file() or str(old) not in rows: fail(f'missing definition or route: {old}')
            if args.route: rows[str(old)] = route(args)
            if args.content_file: (stage / old).write_text(Path(args.content_file).read_text()); touched.add(str(old))
        elif args.operation == 'rename':
            if not args.new_path: fail('--new-path is required')
            new = rel_path(root, args.new_path)
            if not target.is_file() or str(old) not in rows: fail(f'missing definition or route: {old}')
            if (root / new).exists() or str(new) in rows: fail(f'destination already exists: {new}')
            name = old.name
            ambiguous = references(root, name, exclude={str(old)})
            exact = references(root, str(old), exclude={str(old)})
            if any(rel not in {r for r,_ in exact} for rel,_ in ambiguous): fail('ambiguous command-name references: ' + ','.join(r for r,_ in ambiguous))
            staged_old, staged_new = stage / old, stage / new; staged_new.parent.mkdir(parents=True, exist_ok=True); staged_old.rename(staged_new)
            replace_exact(stage, exact, str(old), str(new)); rows[str(new)] = rows.pop(str(old)); touched |= {str(old), str(new)} | {r for r,_ in exact}
        else:
            if not args.yes: fail('delete requires --yes and exact --path')
            if not target.is_file() or str(old) not in rows: fail(f'missing definition or route: {old}')
            refs = references(root, str(old), exclude={str(old)})
            if refs: fail('referenced-delete blocked: ' + ','.join(r for r,_ in refs))
            (stage / old).unlink(); rows.pop(str(old)); touched.add(str(old))
        write_registry(stage, comments, rows); validate(stage); apply_stage(root, stage, touched, args.dry_run)
        print(f'status={"dry-run" if args.dry_run else "changed"} operation={args.operation} path={old} definitions={len(definitions(stage))} route={rows.get(str(old), rows.get(str(locals().get("new", old)), ["-"]))[0]}')
if __name__ == '__main__': main()
