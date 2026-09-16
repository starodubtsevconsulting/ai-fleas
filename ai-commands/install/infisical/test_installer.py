"""Offline mechanics tests. All deployment resources live in temporary fixtures."""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import remote
import runner

PACKAGE = Path(__file__).resolve().parent
CATALOG = PACKAGE.parents[1]
SCOPE = {'profile': 'example', 'workflow': 'dev.workflow.md', 'logical_project': 'example-dev'}

FAKE_DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
a=sys.argv[1:]; fixture=Path(os.environ['FIXTURE']); cfg=json.loads((fixture/'config.json').read_text())
root=Path(cfg['remote_root']); state=fixture/'state.json'
with (fixture/'calls.jsonl').open('a') as stream: stream.write(json.dumps(a)+'\n')
if os.environ.get('FAIL_DOCKER')=='1':
 print('SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK',file=sys.stderr);sys.exit(1)
if a[0]=='info': print('"fixture"')
elif a[:3]==['compose','version','--short']: print('2.32.0')
elif a[0] in ('container','volume','network') and a[1]=='ls':
 if os.environ.get('FOREIGN_RESOURCES')=='1': print('foreign-resource')
elif a[:2]==['volume','inspect']:
 print(json.dumps([{'Name':a[2],'CreatedAt':'fixture-created-at'}]))
elif a[0]=='exec':
 marker=fixture/'database-marker'
 if 'CREATE SCHEMA' in a[-1]: marker.write_text('persistent-marker')
 elif 'SELECT value' in a[-1]: print(marker.read_text())
 else:sys.exit(9)
elif a[0]=='compose':
 action=a[a.index('-f')+2:]
 if action[:2]==['config','--quiet']:
  expected={'backend','db','redis'}|({'proxy','cloudflared'} if cfg['access_mode']=='cloudflare' else set())
  assert set(json.loads((root/'compose.json').read_text())['services'])==expected
  print('SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK')
 elif action[0]=='pull': pass
 elif action[0]=='up': state.write_text(json.dumps({'running':True}))
 elif action[0]=='stop': state.write_text(json.dumps({'running':False}))
 elif action[0]=='ps':
  if state.exists(): print(action[-1])
 else: sys.exit(9)
elif a[0]=='inspect':
 name=a[1]; running=json.loads(state.read_text())['running']
 healthchecks={
  'backend':{'Test':['CMD','node','-e',"require('http').get('http://127.0.0.1:8080/api/status',r=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"]},
  'db':{'Test':['CMD','pg_isready','-U','infisical','-d','infisical']},
  'redis':{'Test':['CMD-SHELL','unauth="$$(redis-cli --raw ping 2>/dev/null || true)"; [ "$$unauth" = "NOAUTH Authentication required." ] && [ "$$(redis-cli --no-auth-warning -a "$$REDIS_PASSWORD" --raw ping 2>/dev/null)" = "PONG" ]']},
  'proxy':{'Test':['CMD-SHELL','wget --no-check-certificate -q -O /dev/null https://127.0.0.1:8443/api/status']}}
 for check in healthchecks.values(): check.update(Interval=5000000000,Timeout=5000000000,Retries=24,StartPeriod=30000000000)
 healthchecks['proxy']['StartPeriod']=10000000000
 if os.environ.get('HEALTHCHECK_DRIFT')=='1' and name=='redis': healthchecks[name]['Retries']=1
 if cfg['access_mode']=='core':
  ports={'8080/tcp':[{'HostIp':'127.0.0.1','HostPort':str(cfg['backend_port'])}]} if name=='backend' else {}
  expected_networks={'backend':{'private','outbound'},'db':{'private'},'redis':{'private'}}
 else:
  ports={'8443/tcp':[{'HostIp':'127.0.0.1','HostPort':str(cfg['proxy_port'])}]} if name=='proxy' else {}
  expected_networks={'backend':{'data','application','backend_egress'},'db':{'data'},'redis':{'data'},
   'proxy':{'application','tunnel'},'cloudflared':{'tunnel','tunnel_egress'}}
 if os.environ.get('PUBLIC_DB')=='1' and name=='db': ports={'5432/tcp':[{'HostIp':'0.0.0.0','HostPort':'5432'}]}
 health='unhealthy' if os.environ.get('UNHEALTHY')=='1' else 'healthy'
 networks={cfg['project_name']+'_'+network:{} for network in expected_networks[name]}
 if os.environ.get('PUBLIC_NETWORK')=='1' and name=='db': networks['foreign_network']={}
 print(json.dumps([{'Config':{'Image':cfg['images'][name],'Env':['SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK'],
 'Healthcheck':healthchecks.get(name),
 'Labels':{'com.docker.compose.project':cfg['project_name'],'com.docker.compose.service':name}},
 'HostConfig':{'PortBindings':ports},'NetworkSettings':{'Networks':networks},
 'State':{'Running':running,'Health':None if name=='cloudflared' else {'Status':health}}}]))
else: sys.exit(9)
'''

FAKE_SSH = r'''#!/usr/bin/env python3
import subprocess, sys
source=sys.stdin.read()
# Simulate a qualified disposable Linux host; qualification has separate negative tests.
source=source.replace('if __name__ == "__main__":\n', 'if __name__ == "__main__":\n    qualify=lambda cfg,fresh: None\n')
r=subprocess.run([sys.executable,'-'],input=source,text=True)
sys.exit(r.returncode)
'''


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='infisical-test-')
        self.folder = Path(self.temporary.name).resolve()
        self.profile = self.folder / 'ai-profile/example'
        self.profile.mkdir(parents=True)
        self.config_path = self.profile / 'infisical.config'
        self.profile_file = self.profile / 'example-work-profile.yml'
        self.profile_file.write_text('name: example\n')
        digest = '@sha256:' + '0' * 64
        self.cfg = {'version': 1, 'command': 'infisical', 'ssh_target': 'example-server',
                    'remote_root': str(self.folder / 'deployment'), 'project_name': 'example-secrets',
                    'site_url': 'https://secrets.example.invalid',
                    'images': {'backend': 'infisical/infisical:v0.1-postgres' + digest,
                               'db': 'postgres:16-alpine' + digest, 'redis': 'redis:7-alpine' + digest}}
        self.save_config()
        self.cfg = runner.load_config(self.config_path, self.profile_file)
        self.save_config()
        binary = self.folder / 'bin'
        binary.mkdir()
        for name, source in [('docker', FAKE_DOCKER), ('ssh', FAKE_SSH)]:
            path = binary / name
            path.write_text(source)
            path.chmod(0o700)
        self.environment = patch.dict(os.environ, {'FIXTURE': str(self.folder),
                                  'PATH': str(binary) + os.pathsep + os.environ['PATH'],
                                  'AI_PROFILE_FILE': str(self.profile_file), 'AI_COMMAND_CONFIG_PATH': str(self.config_path),
                                  'AI_WORK_PROFILE_ID': 'example', 'AI_FLOW_WORKFLOW': 'dev.workflow.md',
                                  'AI_LOGICAL_PROJECT_ID': 'example-dev'})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temporary.cleanup()

    def save_config(self):
        self.config_path.write_text(json.dumps(self.cfg))
        (self.folder / 'config.json').write_text(json.dumps(self.cfg))

    def perform(self, action):
        with patch.object(remote, 'qualify'):
            return remote.perform(self.cfg, SCOPE, action)

    def test_install_rerun_start_stop_preserve_credentials_and_volumes(self):
        self.assertEqual(self.perform('install')['status'], 'HEALTHY')
        root = Path(self.cfg['remote_root'])
        original = {name: (root / name).read_bytes() for name in ('backend.env', 'db.env', 'redis.env')}
        before_status = {p.name: p.stat().st_mtime_ns for p in root.iterdir()}
        self.assertEqual(self.perform('status')['status'], 'HEALTHY')
        self.assertEqual(before_status, {p.name: p.stat().st_mtime_ns for p in root.iterdir()})
        self.assertEqual(self.perform('install')['status'], 'HEALTHY')
        self.assertEqual(self.perform('stop')['status'], 'STOPPED')
        self.assertEqual(self.perform('start')['status'], 'HEALTHY')
        self.assertTrue(all((root / k).read_bytes() == v for k, v in original.items()))
        calls = [json.loads(line) for line in (self.folder / 'calls.jsonl').read_text().splitlines()]
        self.assertFalse(any('down' in call or 'rm' in call or '--remove-orphans' in call for call in calls))
        doc = json.loads((root / 'compose.json').read_text())
        for name in ('db', 'redis'):
            self.assertNotIn('ports', doc['services'][name])
            self.assertEqual(doc['services'][name]['networks'], ['private'])
        self.assertTrue(doc['networks']['private']['internal'])
        self.assertTrue(all((root / n).stat().st_mode & 0o777 == 0o600 for n in original))

    def test_unknown_deployment_and_project_resources_rejected(self):
        root = Path(self.cfg['remote_root'])
        root.mkdir()
        marker = root / 'foreign.txt'
        marker.write_text('keep')
        with self.assertRaises(remote.RemoteBlocked): self.perform('install')
        self.assertEqual(marker.read_text(), 'keep')
        marker.unlink(); root.rmdir()
        with patch.dict(os.environ, {'FOREIGN_RESOURCES': '1'}):
            with self.assertRaises(remote.RemoteBlocked): self.perform('install')
        self.assertFalse(root.exists())

    def test_scope_config_or_credential_loss_never_regenerates_keys(self):
        self.perform('install')
        key = Path(self.cfg['remote_root']) / 'backend.env'
        original = key.read_bytes()
        with patch.dict(SCOPE, {'profile': 'foreign'}):
            with self.assertRaises(remote.RemoteBlocked): self.perform('start')
        self.cfg['site_url'] = 'https://changed.example.invalid'
        with self.assertRaises(remote.RemoteBlocked): self.perform('install')
        self.assertEqual(key.read_bytes(), original)
        self.cfg['site_url'] = 'https://secrets.example.invalid'
        key.unlink()
        with self.assertRaises(remote.RemoteBlocked): self.perform('install')
        self.assertFalse(key.exists())

    def test_public_datastore_and_unhealthy_services_fail_truthfully(self):
        self.perform('install')
        with patch.dict(os.environ, {'PUBLIC_DB': '1'}):
            with self.assertRaisesRegex(remote.RemoteBlocked, 'PUBLICATION'): self.perform('status')
        with patch.dict(os.environ, {'UNHEALTHY': '1'}):
            with self.assertRaisesRegex(remote.RemoteBlocked, 'NOT_HEALTHY'): self.perform('status')
        with patch.dict(os.environ, {'PUBLIC_NETWORK': '1'}):
            with self.assertRaisesRegex(remote.RemoteBlocked, 'NETWORK_ISOLATION'): self.perform('stop')
        with patch.dict(os.environ, {'HEALTHCHECK_DRIFT': '1'}):
            with self.assertRaisesRegex(remote.RemoteBlocked, 'HEALTHCHECK_MISMATCH'): self.perform('status')
        self.assertTrue(json.loads((self.folder / 'state.json').read_text())['running'])

    def test_remote_receipts_cannot_relay_arbitrary_values(self):
        source = (PACKAGE / 'remote.py').read_text()
        for key in ('code', 'images', 'services', 'initialAccountSetupRequired'):
            receipt = {'status': 'BLOCKED', 'dataPreserved': True, key: 'SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK'}
            with self.assertRaises(runner.Blocked): runner.validate_receipt(receipt, self.cfg, source, 2)

    def test_invalid_config_and_duplicate_keys_fail_without_ssh(self):
        for key, value in [('ssh_target', '-oProxyCommand=bad'), ('remote_root', '/opt/../etc'),
                           ('site_url', 'http://secrets.example.invalid'), ('backend_port', True),
                           ('images', dict(self.cfg['images'], backend='infisical/infisical:latest'))]:
            cfg = copy.deepcopy(self.cfg); cfg[key] = value
            self.config_path.write_text(json.dumps(cfg))
            with self.assertRaises(runner.Blocked): runner.load_config(self.config_path, self.profile_file)
        self.config_path.write_text('{"version":1,"version":1}')
        with self.assertRaises(runner.Blocked): runner.load_config(self.config_path, self.profile_file)
        self.assertFalse((self.folder / 'calls.jsonl').exists())

    def test_env_configuration_matches_legacy_json_and_never_executes_expressions(self):
        lines = ['# Fictional profile configuration']
        for key, field in runner.CONFIG_ENV_FIELDS.items():
            if key in runner.IMAGE_ENV_FIELDS:
                if field not in self.cfg['images']:
                    continue
                value = self.cfg['images'][field]
            elif field not in self.cfg:
                continue
            else:
                value = self.cfg[field]
            lines.append(key + '=' + json.dumps(str(value)))
        text = '\n'.join(lines) + '\n'
        self.config_path.write_text(text)
        self.assertEqual(runner.load_config(self.config_path, self.profile_file), self.cfg)
        for extra in ('VERSION=1\n', 'export VERSION=1\n', 'UNKNOWN=bad\n', 'SMTP_ENV_FILE=$(touch nope)\n'):
            self.config_path.write_text(text + extra)
            with self.assertRaises(runner.Blocked): runner.load_config(self.config_path, self.profile_file)
        self.assertFalse((self.folder / 'calls.jsonl').exists())

    def test_cloudflare_mode_owns_five_services_and_separates_every_network_boundary(self):
        digest = '@sha256:' + '1' * 64
        for name in ('origin.pem', 'origin.key', 'tunnel-token'):
            path = self.folder / name
            path.write_text('fictional-' + name + '\n')
            path.chmod(0o600)
        self.cfg.update({
            'access_mode': 'cloudflare',
            'proxy_port': 8443,
            'origin_server_name': 'origin.example.invalid',
            'origin_cert_file': str(self.folder / 'origin.pem'),
            'origin_key_file': str(self.folder / 'origin.key'),
            'cloudflared_token_file': str(self.folder / 'tunnel-token'),
        })
        self.cfg['images'].update({'proxy': 'nginx:alpine' + digest,
                                   'cloudflared': 'cloudflare/cloudflared:latest' + digest})
        self.save_config()
        receipt = self.perform('install')
        self.assertEqual(receipt['services'], {
            'backend': 'healthy', 'db': 'healthy', 'redis': 'healthy',
            'proxy': 'healthy', 'cloudflared': 'running'})
        root = Path(self.cfg['remote_root'])
        document = json.loads((root / 'compose.json').read_text())
        self.assertEqual(set(document['services']), {'backend', 'db', 'redis', 'proxy', 'cloudflared'})
        self.assertEqual(set(document['networks']),
                         {'data', 'application', 'tunnel', 'backend_egress', 'tunnel_egress'})
        self.assertTrue(all(document['networks'][name]['internal']
                            for name in ('data', 'application', 'tunnel')))
        self.assertEqual(document['services']['db']['networks'], ['data'])
        self.assertEqual(document['services']['redis']['networks'], ['data'])
        self.assertEqual(document['services']['proxy']['networks'], ['application', 'tunnel'])
        self.assertEqual(document['services']['backend']['networks']['backend_egress'], {'gw_priority': 1})
        self.assertEqual(document['services']['cloudflared']['networks'],
                         {'tunnel': {}, 'tunnel_egress': {'gw_priority': 1}})
        self.assertIn('--requirepass', document['services']['redis']['command'][-1])
        self.assertIn('NOAUTH Authentication required.',
                      document['services']['redis']['healthcheck']['test'][-1])
        for service in ('backend', 'db', 'redis', 'proxy'):
            self.assertIn('healthcheck', document['services'][service])
        self.assertNotIn('ports', document['services']['backend'])
        self.assertEqual(document['services']['proxy']['ports'], ['127.0.0.1:8443:8443'])
        for name in ('nginx.conf', 'origin.pem', 'origin.key', 'tunnel-token'):
            self.assertEqual((root / name).stat().st_mode & 0o777, 0o600)

    def test_symlink_ancestor_refused_before_mutation(self):
        actual = self.folder / 'actual'; actual.mkdir()
        link = self.folder / 'alias'; link.symlink_to(actual, target_is_directory=True)
        self.cfg['remote_root'] = str(link / 'deployment')
        with self.assertRaisesRegex(remote.RemoteBlocked, 'SYMLINK'): self.perform('install')
        self.assertFalse((actual / 'deployment').exists())

    def test_remote_errors_never_emit_synthetic_credentials(self):
        with patch.dict(os.environ, {'FAIL_DOCKER': '1'}), patch.object(remote, 'qualify'):
            output = io.StringIO()
            with contextlib.redirect_stdout(output), self.assertRaises(SystemExit):
                remote.remote_main(self.cfg, SCOPE, 'install')
            self.assertNotIn('SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK', output.getvalue())
            self.assertEqual(json.loads(output.getvalue())['status'], 'BLOCKED')

    def test_linux_and_capacity_qualification_rejects_before_mutation(self):
        with patch.object(remote.platform, 'system', return_value='Darwin'):
            with self.assertRaisesRegex(remote.RemoteBlocked, 'LINUX'): remote.qualify(self.cfg, True)
        with patch.object(remote.platform, 'system', return_value='Linux'), patch.object(remote.platform, 'machine', return_value='x86_64'), patch.object(remote.os, 'cpu_count', return_value=1):
            with self.assertRaisesRegex(remote.RemoteBlocked, 'CPU'): remote.qualify(self.cfg, True)
        self.assertFalse(Path(self.cfg['remote_root']).exists())

    def test_smtp_is_optional_and_cannot_bypass_tls_or_inject_backend_keys(self):
        path = self.folder / 'smtp.env'
        path.write_text('SMTP_HOST=relay.example.invalid\nSMTP_PORT=587\nSMTP_FROM_ADDRESS=sender@example.invalid\n')
        path.chmod(0o600)
        content = remote.smtp_content(path)
        self.assertIn('SMTP_REQUIRE_TLS=true\n', content)
        for line in ('SMTP_TLS_REJECT_UNAUTHORIZED=false\n', 'AUTH_SECRET=bad\n'):
            with path.open('a') as stream: stream.write(line)
            with self.assertRaises(remote.RemoteBlocked): remote.smtp_content(path)
        self.assertEqual(remote.compose_document(self.cfg)['services']['backend']['env_file'], ['backend.env'])

    def test_local_dispatcher_fake_ssh_end_to_end_and_apply_gate(self):
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
        r = subprocess.run([sys.executable, str(PACKAGE / 'runner.py'), 'install'], env=env, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse(Path(self.cfg['remote_root']).exists())
        for action in (['validate'], ['install', '--apply'], ['status'], ['stop', '--apply'], ['start', '--apply']):
            r = subprocess.run([sys.executable, str(PACKAGE / 'runner.py')] + action, env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertNotIn('SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK', r.stdout + r.stderr)

    def test_shell_entry_requires_profile_before_ssh(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith(('AI_', 'WORK_PROFILE'))}
        r = subprocess.run(['bash', str(PACKAGE / 'infisical.command.sh'), 'validate'], env=env, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('PROFILE_REQUIRED', r.stderr)
        self.assertFalse((self.folder / 'calls.jsonl').exists())

    def activate_fixture_profile(self):
        workflows = self.folder / 'workflows'; workflows.mkdir()
        platforms = self.folder / 'platforms'; platforms.mkdir()
        (platforms / 'registry.yml').write_text('platforms:\n  - id: example-platform\n    contract: example.md\n')
        (platforms / 'example.md').write_text('# Example platform\n')
        (self.folder / 'AGENTS.md').write_text('# Fixture governance\n')
        (self.profile / 'project.yml').write_text('id: example-repository\nrepo_path: ' + str(self.folder) + '\n')
        profile = ('name: example\nai_commands_root: ' + str(CATALOG) + '\nai_workflows_root: ' + str(workflows)
                   + '\nai_platforms_root: ' + str(platforms) + '\nagent_platforms:\n  default: example-platform\n  available:\n    - example-platform\n'
                   + 'governance_rules_repository: example-repository\ngovernance_rules_surface:\n  - AGENTS.md\ncommands:\n  - id: infisical\n    config: infisical.config\n'
                   + 'workflows:\n  - path: dev.workflow.md\n    projects:\n      - ref: project.yml\n    commands:\n      - infisical\n')
        self.profile_file.write_text(profile)
        env = dict(os.environ, AI_CONFIG_PROJECT=str(self.folder), AI_AGENT_PLATFORM='example-platform', REPORT_LOG_DIR=str(self.folder / 'logs'))
        return env, profile

    def test_shell_entry_activates_exact_profile_and_rejects_disallowed_command(self):
        env, profile = self.activate_fixture_profile()
        command = ['bash', str(PACKAGE / 'infisical.command.sh'), 'validate']
        result = subprocess.run(command, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['status'], 'VALIDATED')
        self.profile_file.write_text(profile.replace('      - infisical\n', '      - unrelated\n'))
        result = subprocess.run(command, env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('not allowed by workflow', result.stderr)
        self.assertFalse((self.folder / 'calls.jsonl').exists())

    def test_smoke_harness_refuses_non_test_target_before_commands(self):
        result = subprocess.run([sys.executable, str(PACKAGE/'smoke_test.py')],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(json.loads(result.stdout)['stage'],'configuration')
        self.assertFalse((self.folder/'calls.jsonl').exists())

    def test_smoke_harness_exercises_real_entry_and_keeps_marker_while_stopping_fixture(self):
        self.cfg['remote_root']=str(self.folder/'deployment-test')
        self.cfg['project_name']='example-secrets-test'
        self.cfg['site_url']='http://127.0.0.1:18080'
        self.save_config()
        env, _ = self.activate_fixture_profile()
        result = subprocess.run(['bash',str(PACKAGE/'infisical.command.smoke.test.sh'),'--apply'],
                                env=env,capture_output=True,text=True,timeout=120)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        receipt=json.loads(result.stdout)
        self.assertEqual(receipt['status'],'PASSED')
        self.assertIn('stopped_status',receipt['completed'])
        self.assertTrue(receipt['keysAndDataPreserved'])
        self.assertFalse(json.loads((self.folder/'state.json').read_text())['running'])
        self.assertEqual((self.folder/'database-marker').read_text(),'persistent-marker')
        self.assertNotIn('SYNTHETIC_CREDENTIAL_MUST_NOT_LEAK',result.stdout+result.stderr)


if __name__ == '__main__':
    unittest.main()
