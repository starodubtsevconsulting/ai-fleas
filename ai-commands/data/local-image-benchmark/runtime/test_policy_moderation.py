import base64
import json
import os
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

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

    @unittest.skipUnless(os.environ.get("POLICY_HTTP_TEST") == "1", "requires loopback socket permission")
    async def test_real_http_contract_and_bearer_token(self):
        received = {}

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                received["authorization"] = self.headers.get("Authorization")
                length = int(self.headers["Content-Length"])
                received["payload"] = json.loads(self.rfile.read(length))
                response = {
                    "request_id": received["payload"]["request_id"],
                    "decision": "allow",
                    "reason_code": "policy_allow",
                }
                body = json.dumps(response).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                token_file = Path(directory) / "token"
                token_file.write_text("test-token\n", encoding="utf-8")
                moderator = SemanticModerator(
                    POLICY,
                    f"http://127.0.0.1:{server.server_port}/decide",
                    input_enabled=True,
                    output_enabled=False,
                    auth_token_file=str(token_file),
                )
                await moderator.check_input("a harmless prompt")
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

        self.assertEqual(received["authorization"], "Bearer test-token")
        self.assertEqual(received["payload"]["profile"]["policy_ids"], ["content-nudity"])
        self.assertEqual(received["payload"]["content"]["text"], "a harmless prompt")

    def test_evaluation_corpus_has_required_attack_and_benign_coverage(self):
        cases = json.loads((Path(__file__).parent / "moderation-cases.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(cases), 20)
        self.assertTrue({"allow", "deny"}.issubset({case["expected"] for case in cases}))
        self.assertTrue(
            {"paraphrase", "euphemism", "misspelling", "obfuscation", "prompt-injection", "multilingual"}.issubset(
                {case["kind"] for case in cases}
            )
        )
        self.assertTrue({"en", "ru", "uk", "it", "es", "fr", "de"}.issubset({case["language"] for case in cases}))


if __name__ == "__main__":
    unittest.main()
