import hashlib
import unittest

from policy_bypass import TemporaryPolicyBypass


class TemporaryPolicyBypassTest(unittest.TestCase):
    def manager(self, code="open-canvas", ttl=60):
        now = [1000.0]
        tokens = iter(("session-one", "session-two", "session-three"))
        manager = TemporaryPolicyBypass(
            hashlib.sha256(code.encode()).hexdigest(),
            ttl,
            clock=lambda: now[0],
            token_factory=lambda: next(tokens),
            max_sessions=2,
        )
        return manager, now

    def test_valid_code_creates_expiring_single_use_grant(self):
        manager, now = self.manager()
        token = manager.exchange("open-canvas")
        self.assertEqual(token, "session-one")
        self.assertTrue(manager.active(token))
        self.assertEqual(manager.seconds_remaining(token), 60)
        self.assertTrue(manager.consume(token))
        self.assertFalse(manager.active(token))
        self.assertFalse(manager.consume(token))

        token = manager.exchange("open-canvas")
        now[0] += 60
        self.assertFalse(manager.active(token))
        self.assertFalse(manager.consume(token))

    def test_wrong_or_disabled_code_never_creates_session(self):
        manager, _ = self.manager()
        self.assertIsNone(manager.exchange("wrong"))
        self.assertFalse(manager.active("wrong"))
        disabled = TemporaryPolicyBypass("", 60)
        self.assertFalse(disabled.enabled)
        self.assertIsNone(disabled.exchange("anything"))

    def test_revoke_and_session_limit(self):
        manager, _ = self.manager()
        first = manager.exchange("open-canvas")
        second = manager.exchange("open-canvas")
        third = manager.exchange("open-canvas")
        self.assertFalse(manager.active(first))
        self.assertTrue(manager.active(second))
        self.assertTrue(manager.active(third))
        manager.revoke(second)
        self.assertFalse(manager.active(second))

    def test_configuration_is_validated(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            TemporaryPolicyBypass("not-a-digest", 60)
        with self.assertRaisesRegex(ValueError, "60..86400"):
            TemporaryPolicyBypass("", 59)


if __name__ == "__main__":
    unittest.main()
