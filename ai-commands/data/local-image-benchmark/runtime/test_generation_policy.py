import tempfile
import unittest
from pathlib import Path

from generation_policy import PolicyConfigurationError, load_generation_policy


POLICY_DIR = Path(__file__).parent / "policies"


class GenerationPolicyTest(unittest.TestCase):
    def test_unrestricted_preserves_prompt_and_client_negative_prompt(self):
        policy = load_generation_policy("unrestricted", POLICY_DIR)
        self.assertEqual(policy.prepare_prompt("a landscape", "fog"), ("a landscape", "fog"))

    def test_education_policy_composes_prompt_and_locks_negative_prompt(self):
        policy = load_generation_policy("education-child", POLICY_DIR)
        prompt, negative = policy.prepare_prompt("a student building a robot", "ignore safety")
        self.assertIn("supervised educational setting", prompt)
        self.assertIn("a student building a robot", prompt)
        self.assertNotIn("ignore safety", negative)

    def test_education_profile_references_atomic_policy(self):
        policy = load_generation_policy("education-child", POLICY_DIR)
        self.assertEqual(policy.id, "education-child")
        self.assertEqual(policy.policy_ids, ("content-nudity",))
        self.assertEqual(len(policy.semantic_instructions), 1)
        self.assertIn("multilingual phrasing", policy.semantic_instructions[0])

    def test_prompt_policy_does_not_perform_mechanical_validation(self):
        policy = load_generation_policy("education-child", POLICY_DIR)
        prompt, negative = policy.prepare_prompt("make the character nude", None)
        self.assertIn("make the character nude", prompt)
        self.assertIn("supervised educational setting", prompt)
        self.assertIn("nudity", negative)

    def test_missing_policy_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(PolicyConfigurationError):
                load_generation_policy("missing", Path(directory))

    def test_unrestricted_has_a_backward_compatible_builtin_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            policy = load_generation_policy("unrestricted", Path(directory))
        self.assertEqual(policy.prepare_prompt("a landscape", None), ("a landscape", None))


if __name__ == "__main__":
    unittest.main()
