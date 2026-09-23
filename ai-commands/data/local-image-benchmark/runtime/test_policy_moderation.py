import base64
import unittest

from policy_moderation import (
    ModerationConfigurationError,
    PolicyDecisionError,
    SemanticModerator,
    SemanticPolicy,
)


POLICY = SemanticPolicy(
    profile_id="education-child",
    policy_ids=("content-nudity",),
    instructions=("Deny explicit images.",),
    refusal="This request is unavailable.",
)


class FakeModerator(SemanticModerator):
    def __init__(self, decision, **kwargs):
        super().__init__(POLICY, "http://moderator.test/decide", **kwargs)
        self.decision = decision
        self.requests = []

    def _post_json(self, payload):
        self.requests.append(payload)
        if isinstance(self.decision, Exception):
            raise self.decision
        result = dict(self.decision)
        result.setdefault("request_id", payload["request_id"])
        return result


class SemanticModeratorTest(unittest.IsolatedAsyncioTestCase):
    async def test_semantic_input_allow_carries_shared_policy_intent(self):
        moderator = FakeModerator(
            {"decision": "allow", "reason_code": "policy_allow"},
            input_enabled=True,
            output_enabled=False,
        )
        await moderator.check_input("a harmless multilingual paraphrase")
        request = moderator.requests[0]
        self.assertEqual(request["stage"], "input")
        self.assertEqual(request["profile"]["id"], "education-child")
        self.assertEqual(request["profile"]["policy_ids"], ["content-nudity"])
        self.assertEqual(request["profile"]["instructions"], ["Deny explicit images."])

    async def test_denied_input_returns_neutral_message_and_reason_code(self):
        moderator = FakeModerator(
            {"decision": "deny", "reason_code": "semantic_nudity"},
            input_enabled=True,
            output_enabled=False,
        )
        with self.assertRaises(PolicyDecisionError) as raised:
            await moderator.check_input("an obfuscated request")
        self.assertEqual(raised.exception.public_message, "This request is unavailable.")
        self.assertEqual(raised.exception.reason_code, "semantic_nudity")
        self.assertFalse(raised.exception.unavailable)

    async def test_output_candidate_is_sent_as_private_png_content(self):
        moderator = FakeModerator(
            {"decision": "allow", "reason_code": "policy_allow"},
            input_enabled=False,
            output_enabled=True,
        )
        await moderator.check_image_output(b"private-png")
        content = moderator.requests[0]["content"]
        self.assertEqual(content["type"], "image")
        self.assertEqual(base64.b64decode(content["base64"]), b"private-png")

    async def test_timeout_transport_and_uncertain_decisions_fail_closed(self):
        cases = (
            (OSError("offline"), "moderation_unavailable"),
            ({"decision": "uncertain", "reason_code": "low_confidence"}, "moderation_uncertain"),
            ({"decision": "allow", "reason_code": "INVALID CODE"}, "moderation_malformed"),
            ({"request_id": "wrong", "decision": "allow", "reason_code": "policy_allow"}, "moderation_malformed"),
        )
        for decision, reason in cases:
            with self.subTest(reason=reason):
                moderator = FakeModerator(decision, input_enabled=True, output_enabled=False)
                with self.assertRaises(PolicyDecisionError) as raised:
                    await moderator.check_input("prompt")
                self.assertTrue(raised.exception.unavailable)
                self.assertEqual(raised.exception.reason_code, reason)

    async def test_disabled_and_unrestricted_gates_do_not_call_service(self):
        disabled = FakeModerator(OSError("must not call"), input_enabled=False, output_enabled=False)
        await disabled.check_input("prompt")
        await disabled.check_image_output(b"png")
        self.assertEqual(disabled.requests, [])

        unrestricted = SemanticModerator(
            SemanticPolicy("unrestricted", (), (), "unavailable"),
            "",
            input_enabled=True,
            output_enabled=True,
        )
        await unrestricted.check_input("prompt")
        await unrestricted.check_image_output(b"png")

    def test_enabled_protected_gate_requires_endpoint(self):
        with self.assertRaises(ModerationConfigurationError):
            SemanticModerator(POLICY, "", input_enabled=True, output_enabled=False)


if __name__ == "__main__":
    unittest.main()
