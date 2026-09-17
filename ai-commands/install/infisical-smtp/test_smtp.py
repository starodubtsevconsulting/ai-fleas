"""Offline checks for the declarative SMTP overlay and value-free validation."""
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import remote
import runner


class SmtpOverlayTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.compose = self.root / 'compose.yml'
        self.smtp = self.root / 'smtp.env'
        self.cfg = {'REMOTE_ROOT': str(self.root), 'COMPOSE_FILE': str(self.compose),
                    'SMTP_ENV_FILE': str(self.smtp), 'BACKEND_SERVICE': 'backend',
                    'PROJECT_NAME': 'example', 'EXPECTED_SMTP_HOST': 'smtp.example.invalid',
                    'EXPECTED_SMTP_PORT': '587', 'EXPECTED_SMTP_USERNAME': 'example',
                    'EXPECTED_SMTP_FROM_ADDRESS': 'secrets@example.invalid'}
        self.compose.write_text('services:\n  backend:\n    image: example/backend\n    environment:\n      SITE_URL: https://example.invalid\n  db:\n    image: example/db\n')

    def test_source_reference_is_exact_and_other_env_files_fail_closed(self):
        with patch.object(remote, 'protected'):
            source, present, line, column = remote.source_state(self.cfg)
            self.assertFalse(present)
            self.assertEqual((line, column), (1, 2))
            self.compose.write_text(source.replace('  backend:\n',
                '  backend:\n    env_file:\n      - ' + str(self.smtp) + '\n'))
            self.assertTrue(remote.source_state(self.cfg)[1])
            self.compose.write_text(self.compose.read_text().replace(
                '      - ' + str(self.smtp), '      - /tmp/unreviewed.env'))
            with self.assertRaises(remote.Blocked):
                remote.source_state(self.cfg)

    def test_resolved_change_allows_only_backend_smtp_keys(self):
        before = {'services': {'backend': {'image': 'example/backend',
                  'environment': {'SITE_URL': 'https://example.invalid'}},
                  'db': {'image': 'example/db'}}}
        after = copy.deepcopy(before)
        after['services']['backend']['environment']['SMTP_HOST'] = 'smtp.example.invalid'
        remote.compare_addition(before, after, self.cfg, {'SMTP_HOST': 'smtp.example.invalid'})
        after['services']['db']['image'] = 'changed'
        with self.assertRaises(remote.Blocked):
            remote.compare_addition(before, after, self.cfg, {'SMTP_HOST': 'smtp.example.invalid'})
        after['services']['db']['image'] = 'example/db'
        after['services']['backend']['environment']['SITE_URL'] = 'changed'
        with self.assertRaises(remote.Blocked):
            remote.compare_addition(before, after, self.cfg, {'SMTP_HOST': 'smtp.example.invalid'})

    def test_smtp_file_rejects_missing_password_and_tls_bypass(self):
        values = ('SMTP_HOST=smtp.example.invalid\nSMTP_PORT=587\nSMTP_USERNAME=example\n'
                  'SMTP_PASSWORD=synthetic-only\nSMTP_FROM_ADDRESS=secrets@example.invalid\n'
                  'SMTP_IGNORE_TLS=false\nSMTP_REQUIRE_TLS=true\nSMTP_TLS_REJECT_UNAUTHORIZED=true\n')
        with patch.object(remote, 'protected'):
            self.smtp.write_text(values)
            self.assertEqual(remote.smtp_values(self.cfg)['SMTP_PASSWORD'], 'synthetic-only')
            for changed in (values.replace('SMTP_PASSWORD=synthetic-only', 'SMTP_PASSWORD='),
                            values.replace('SMTP_REQUIRE_TLS=true', 'SMTP_REQUIRE_TLS=false')):
                self.smtp.write_text(changed)
                with self.assertRaises(remote.Blocked):
                    remote.smtp_values(self.cfg)

    def test_profile_config_stays_nonsecret_and_scoped(self):
        profile = self.root / 'example-work-profile.yml'
        profile.write_text('name: example\n')
        config = self.root / 'smtp.config'
        template = Path(__file__).with_name('infisical-smtp.command.example.config').read_text()
        config.write_text(template)
        self.assertEqual(runner.load_config(config, profile)['COMMAND'], 'infisical-smtp')
        config.write_text(template + 'SMTP_PASSWORD=synthetic-only\n')
        with self.assertRaises(runner.Blocked):
            runner.load_config(config, profile)

    def test_baseline_ignores_only_declared_smtp_fields(self):
        document = {'services': {'backend': {'environment': {'SITE_URL': 'https://example.invalid',
                    'SMTP_PASSWORD': 'synthetic-only'}}}}
        same = copy.deepcopy(document)
        same['services']['backend']['environment']['SMTP_PASSWORD'] = 'rotated-synthetic'
        self.assertEqual(remote.baseline(document, 'backend'), remote.baseline(same, 'backend'))
        same['services']['backend']['environment']['SITE_URL'] = 'changed'
        self.assertNotEqual(remote.baseline(document, 'backend'), remote.baseline(same, 'backend'))

    def test_receipt_rejects_scope_and_baseline_drift(self):
        scope = {'profile': 'example', 'workflow': 'dev.workflow.md', 'logical_project': 'example-dev'}
        baseline = 'synthetic-baseline'
        receipt = remote.expected_receipt(self.cfg, scope, baseline)
        remote.receipt_path(self.cfg).write_text(json.dumps(receipt))
        with patch.object(remote, 'protected'):
            self.assertTrue(remote.check_receipt(self.cfg, scope, baseline, True))
            with self.assertRaises(remote.Blocked):
                remote.check_receipt(self.cfg, scope, 'drifted', True)
            with self.assertRaises(remote.Blocked):
                remote.check_receipt(self.cfg, {**scope, 'workflow': 'other.workflow.md'}, baseline, True)

    def test_first_apply_status_and_repeat_apply_are_reproducible(self):
        (self.root / 'backups').mkdir()
        values = {'SMTP_HOST': 'smtp.example.invalid'}
        scope = {'profile': 'example', 'workflow': 'dev.workflow.md', 'logical_project': 'example-dev'}
        def resolved(_cfg):
            document = {'services': {'backend': {'image': 'example/backend',
                        'environment': {'SITE_URL': 'https://example.invalid'}},
                        'db': {'image': 'example/db'}}}
            if '    env_file:\n' in self.compose.read_text():
                document['services']['backend']['environment'].update(values)
            return document
        with (patch.object(remote, 'ensure_root'), patch.object(remote, 'protected'),
              patch.object(remote, 'smtp_values', return_value=values),
              patch.object(remote, 'resolved', side_effect=resolved),
              patch.object(remote, 'runtime_healthy', return_value=True),
              patch.object(remote, 'restart_and_wait') as restart):
            remote.reconcile(self.cfg, scope, 'apply')
            self.assertIn(str(self.smtp), self.compose.read_text())
            self.assertEqual(len(list((self.root / 'backups').glob('compose.before-smtp.*.yml'))), 1)
            self.assertTrue(remote.receipt_path(self.cfg).exists())
            remote.reconcile(self.cfg, scope, 'status')
            remote.reconcile(self.cfg, scope, 'apply')
            self.assertEqual(restart.call_count, 1)
            self.compose.write_text(self.compose.read_text().replace(
                'SITE_URL: https://example.invalid', 'SITE_URL: https://changed.invalid'))
            def drifted(_cfg):
                doc = resolved(_cfg)
                doc['services']['backend']['environment']['SITE_URL'] = 'https://changed.invalid'
                return doc
            with patch.object(remote, 'resolved', side_effect=drifted):
                with self.assertRaises(remote.Blocked):
                    remote.reconcile(self.cfg, scope, 'status')

    def test_apply_restores_compose_when_resolved_change_is_unrelated(self):
        (self.root / 'backups').mkdir()
        original = self.compose.read_text()
        scope = {'profile': 'example', 'workflow': 'dev.workflow.md', 'logical_project': 'example-dev'}
        def resolved(_cfg):
            altered = '    env_file:\n' in self.compose.read_text()
            return {'services': {'backend': {'image': 'example/backend',
                    'environment': {'SITE_URL': 'https://example.invalid',
                                    **({'SMTP_HOST': 'smtp.example.invalid'} if altered else {})}},
                    'db': {'image': 'unexpected' if altered else 'example/db'}}}
        with (patch.object(remote, 'ensure_root'), patch.object(remote, 'protected'),
              patch.object(remote, 'smtp_values', return_value={'SMTP_HOST': 'smtp.example.invalid'}),
              patch.object(remote, 'resolved', side_effect=resolved),
              patch.object(remote, 'docker')):
            with self.assertRaises(remote.Blocked):
                remote.reconcile(self.cfg, scope, 'apply')
        self.assertEqual(self.compose.read_text(), original)
        self.assertFalse(remote.receipt_path(self.cfg).exists())


if __name__ == '__main__':
    unittest.main()
