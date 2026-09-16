"""Real-host acceptance using the public command and a separately selected test stack."""
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

import runner


REMOTE_PROBE = r'''
import hashlib

def smoke_probe(cfg, scope, action):
    root = Path(cfg['remote_root'])
    ensure_owner(root, cfg, scope)
    verify_files(root, cfg)
    compose = ['docker', 'compose', '--project-name', cfg['project_name'],
               '--project-directory', str(root), '-f', str(root / 'compose.json')]
    inspect_services(compose, cfg, True)
    files = {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
             for name in ('backend.env', 'db.env', 'redis.env')}
    volumes = {}
    for suffix in ('pg_data', 'redis_data'):
        volume = json.loads(run(['docker', 'volume', 'inspect', cfg['project_name'] + '_' + suffix]))[0]
        volumes[suffix] = {'name': volume['Name'], 'createdAt': volume.get('CreatedAt')}
    identifier = run(compose + ['ps', '--all', '--quiet', 'db']).strip()
    psql = ['docker', 'exec', identifier, 'psql', '-U', 'infisical', '-d', 'infisical',
            '-v', 'ON_ERROR_STOP=1', '-At', '-c']
    baseline = root / 'smoke-test-baseline.json'
    if action == 'baseline' and not baseline.exists():
        run(psql + ["CREATE SCHEMA IF NOT EXISTS ai_fleas_installer_acceptance; "
                    "CREATE TABLE ai_fleas_installer_acceptance.marker (id integer PRIMARY KEY, value text NOT NULL); "
                    "INSERT INTO ai_fleas_installer_acceptance.marker VALUES (1, 'persistent-marker');"])
        private_write(baseline, json.dumps({'files': files, 'volumes': volumes}))
    protected_file(baseline)
    previous = json.loads(baseline.read_text())
    if previous != {'files': files, 'volumes': volumes}:
        raise RemoteBlocked('SMOKE_PERSISTENCE_MISMATCH')
    if run(psql + ['SELECT value FROM ai_fleas_installer_acceptance.marker WHERE id=1']).strip() != 'persistent-marker':
        raise RemoteBlocked('SMOKE_DATABASE_MARKER_LOST')
    print(json.dumps({'verified': True}))
'''


def main():
    completed = []
    stage = 'configuration'
    command = Path(__file__).with_name('infisical.command.sh')
    cfg = None

    def invoke(arguments, expected, success=True):
        result = subprocess.run(['bash', str(command)] + arguments, capture_output=True,
                                text=True, timeout=cfg['ssh_timeout_seconds'] + 30)
        receipt = json.loads(result.stdout)
        if (result.returncode == 0) != success or receipt.get('status') != expected:
            raise RuntimeError('command stage failed')

    def probe(action):
        scope = {key: os.environ.get(env, '') for key, env in (
            ('profile', 'AI_WORK_PROFILE_ID'), ('workflow', 'AI_FLOW_WORKFLOW'),
            ('logical_project', 'AI_LOGICAL_PROJECT_ID'))}
        if not all(scope.values()):
            raise RuntimeError('scope missing')
        source = Path(__file__).with_name('remote.py').read_text() + '\n' + REMOTE_PROBE
        source += '\ntry:\n    smoke_probe(' + repr(cfg) + ',' + repr(scope) + ',' + repr(action) + ')'
        source += '\nexcept Exception:\n    print("{\\"verified\\":false}")\n    raise SystemExit(2)\n'
        result = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                                 '-o', 'ConnectTimeout=10', '--', cfg['ssh_target'], 'python3 -'],
                                input=source, capture_output=True, text=True,
                                timeout=cfg['ssh_timeout_seconds'])
        if result.returncode or json.loads(result.stdout) != {'verified': True}:
            raise RuntimeError('persistence probe failed')

    success = False
    try:
        cfg = runner.load_config(os.environ['AI_COMMAND_CONFIG_PATH'], os.environ['AI_PROFILE_FILE'])
        url = urlsplit(cfg['site_url'])
        if (not cfg['project_name'].endswith('-test') or not Path(cfg['remote_root']).name.endswith('-test')
                or url.scheme != 'http' or url.hostname not in ('localhost', '127.0.0.1') or cfg['smtp_env_file']):
            raise RuntimeError('separate loopback test configuration required')
        for stage, arguments, expected in (
                ('validate', ['validate'], 'VALIDATED'), ('qualify', ['qualify'], 'QUALIFIED'),
                ('install', ['install', '--apply'], 'HEALTHY'), ('status', ['status'], 'HEALTHY')):
            invoke(arguments, expected); completed.append(stage)
        stage = 'save_data_marker'; probe('baseline'); completed.append(stage)
        stage = 'rerun_install'; invoke(['install', '--apply'], 'HEALTHY'); probe('verify'); completed.append(stage)
        stage = 'stop'; invoke(['stop', '--apply'], 'STOPPED'); completed.append(stage)
        stage = 'stopped_status'; invoke(['status'], 'BLOCKED', success=False); completed.append(stage)
        stage = 'start'; invoke(['start', '--apply'], 'HEALTHY'); completed.append(stage)
        stage = 'verify_persistence'; probe('verify'); completed.append(stage)
        success = True
    except Exception:
        # Do not relay child stderr, tracebacks, credentials or database contents.
        print(json.dumps({'status': 'FAILED', 'stage': stage, 'completed': completed}))
    finally:
        if cfg is not None and completed:
            try:
                invoke(['stop', '--apply'], 'STOPPED'); completed.append('final_stop')
            except Exception:
                success = False
                print(json.dumps({'status': 'FAILED', 'stage': 'final_stop', 'resourcesRetained': True}))
    if success:
        print(json.dumps({'status': 'PASSED', 'completed': completed,
                          'testStackStopped': True, 'keysAndDataPreserved': True}))
    return 0 if success else 2


if __name__ == '__main__':
    sys.exit(main())
