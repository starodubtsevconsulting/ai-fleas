import base64
import unittest

from ollama_policy_service import EvaluatorError, OllamaPolicyEvaluator, validate_request


def request(stage="input"):
    content = {"type": "text", "text": "a student building a robot"}
    if stage == "output":
        content = {"type": "image", "media_type": "image/png", "base64": base64.b64encode(b"png").decode()}
    return {
        "schema_version": 1,
        "request_id": "a" * 32,
        "profile": {
            "id": "education-child",
            "policy_ids": ["content-nudity"],
            "instructions": ["Deny nudity."],
        },
        "stage": stage,
        "capability": "image",
        "content": content,
    }


class OllamaPolicyServiceTest(unittest.TestCase):
    def test_requires_profile_selected_model(self):
        with self.assertRaisesRegex(EvaluatorError, "POLICY_SERVICE_MODEL is required"):
            OllamaPolicyEvaluator("http://localhost:11434", "", 1)

    def test_numeric_keep_alive_is_sent_as_an_integer(self):
        evaluator = OllamaPolicyEvaluator("http://localhost:11434", "model", 1, keep_alive="-1")
        self.assertEqual(evaluator.keep_alive, -1)

    def test_validates_text_and_image_requests(self):
        self.assertEqual(validate_request(request())["stage"], "input")
        self.assertEqual(validate_request(request("output"))["stage"], "output")

    def test_rejects_invalid_request_and_image(self):
        invalid = request()
        invalid["request_id"] = "wrong"
        with self.assertRaises(EvaluatorError):
            validate_request(invalid)
        invalid = request("output")
        invalid["content"]["base64"] = "not base64"
        with self.assertRaises(EvaluatorError):
            validate_request(invalid)

    def test_normalizes_only_consistent_constrained_decisions(self):
        payload = request()
        allow = OllamaPolicyEvaluator._normalize(payload, {"decision": "allow", "violated_policy_ids": []})
        deny = OllamaPolicyEvaluator._normalize(
            payload, {"decision": "deny", "violated_policy_ids": ["content-nudity"]}
        )
        self.assertEqual(allow["reason_code"], "policy_allow")
        self.assertEqual(deny["reason_code"], "semantic_policy_denied")

    def test_malformed_unknown_or_inconsistent_results_become_uncertain(self):
        payload = request()
        cases = [
            {"decision": "allow", "violated_policy_ids": ["content-nudity"]},
            {"decision": "deny", "violated_policy_ids": []},
            {"decision": "deny", "violated_policy_ids": ["foreign-policy"]},
            {"decision": "allow"},
            {"decision": "allow", "violated_policy_ids": [], "extra": True},
        ]
        for result in cases:
            with self.subTest(result=result):
                normalized = OllamaPolicyEvaluator._normalize(payload, result)
                self.assertEqual(normalized["decision"], "uncertain")
                self.assertEqual(normalized["reason_code"], "evaluator_uncertain")


if __name__ == "__main__":
    unittest.main()
