"""Configurable prompt and enforcement policies for local image generation."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path


ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


class PolicyConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class DenyRule:
    id: str
    pattern: re.Pattern[str]


@dataclass(frozen=True)
class GenerationPolicy:
    id: str
    prompt_prefix: str
    prompt_suffix: str
    negative_prompt: str
    allow_client_negative_prompt: bool
    refusal: str
    deny_rules: tuple[DenyRule, ...]

    def validate_prompt(self, prompt: str) -> None:
        normalized = prompt.strip()
        for rule in self.deny_rules:
            if rule.pattern.search(normalized):
                raise ValueError(self.refusal)

    def prepare_prompt(self, prompt: str, client_negative_prompt: str | None) -> tuple[str, str | None]:
        normalized = prompt.strip()
        self.validate_prompt(normalized)
        effective_prompt = "\n\n".join(
            part.strip() for part in (self.prompt_prefix, normalized, self.prompt_suffix) if part.strip()
        )
        if self.allow_client_negative_prompt:
            negative_parts = (self.negative_prompt, client_negative_prompt or "")
        else:
            negative_parts = (self.negative_prompt,)
        effective_negative = ", ".join(part.strip(" ,") for part in negative_parts if part.strip(" ,"))
        return effective_prompt, effective_negative or None


def unrestricted_policy() -> GenerationPolicy:
    return GenerationPolicy(
        id="unrestricted",
        prompt_prefix="",
        prompt_suffix="",
        negative_prompt="",
        allow_client_negative_prompt=True,
        refusal="This request is not available under the active generation policy.",
        deny_rules=(),
    )


def load_generation_policy(policy_id: str, policy_dir: Path) -> GenerationPolicy:
    if not ID_PATTERN.fullmatch(policy_id):
        raise PolicyConfigurationError("IMAGE_POLICY_PRESET must be a safe lowercase policy ID")
    path = policy_dir / f"{policy_id}.json"
    if not path.is_file():
        if policy_id == "unrestricted":
            return unrestricted_policy()
        raise PolicyConfigurationError(f"generation policy preset not found: {policy_id}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PolicyConfigurationError(f"generation policy preset is unreadable: {policy_id}") from error
    if data.get("id") != policy_id:
        raise PolicyConfigurationError(f"generation policy preset has an invalid identity: {policy_id}")
    if data.get("schema_version") == 2:
        data = _compose_profile(data, policy_dir)
    elif data.get("schema_version") != 1:
        raise PolicyConfigurationError(f"generation policy preset has an unsupported schema: {policy_id}")
    prompt = data.get("prompt", {})
    enforcement = data.get("enforcement", {})
    input_policy = enforcement.get("input", {})
    if not all(isinstance(value, dict) for value in (prompt, enforcement, input_policy)):
        raise PolicyConfigurationError(f"generation policy preset has an invalid structure: {policy_id}")
    raw_rules = input_policy.get("deny_rules", [])
    if not isinstance(raw_rules, list):
        raise PolicyConfigurationError(f"generation policy deny_rules must be a list: {policy_id}")
    rules = []
    for raw_rule in raw_rules:
        if not isinstance(raw_rule, dict) or not ID_PATTERN.fullmatch(str(raw_rule.get("id", ""))):
            raise PolicyConfigurationError(f"generation policy has an invalid deny rule: {policy_id}")
        try:
            pattern = re.compile(str(raw_rule["pattern"]), re.IGNORECASE)
        except (KeyError, re.error) as error:
            raise PolicyConfigurationError(f"generation policy has an invalid deny pattern: {policy_id}") from error
        rules.append(DenyRule(id=raw_rule["id"], pattern=pattern))
    return GenerationPolicy(
        id=policy_id,
        prompt_prefix=str(prompt.get("prefix", "")),
        prompt_suffix=str(prompt.get("suffix", "")),
        negative_prompt=str(prompt.get("negative_prompt", "")),
        allow_client_negative_prompt=bool(prompt.get("allow_client_negative_prompt", True)),
        refusal=str(input_policy.get("refusal", "This request is not available under the active generation policy.")),
        deny_rules=tuple(rules),
    )


def _compose_profile(profile: dict, policy_dir: Path) -> dict:
    """Resolve a v2 profile into the v1 shape consumed by the image adapter."""
    policy_ids = profile.get("policy_ids")
    if not isinstance(policy_ids, list) or not all(
        isinstance(policy_id, str) and ID_PATTERN.fullmatch(policy_id) for policy_id in policy_ids
    ):
        raise PolicyConfigurationError(f"generation policy profile has invalid policy_ids: {profile.get('id', '')}")

    prefixes: list[str] = []
    suffixes: list[str] = []
    negative_prompts: list[str] = []
    allow_client_negative_prompt = True
    refusal = "This request is not available under the active generation policy."
    deny_rules: list[dict] = []
    seen_rule_ids: set[str] = set()
    rule_dir = policy_dir.parent / "policy-rules"

    for policy_id in policy_ids:
        rule_path = rule_dir / f"{policy_id}.json"
        try:
            rule = json.loads(rule_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise PolicyConfigurationError(f"atomic prompt policy is unreadable: {policy_id}") from error
        if rule.get("schema_version") != 1 or rule.get("id") != policy_id:
            raise PolicyConfigurationError(f"atomic prompt policy has an invalid identity: {policy_id}")
        capabilities = rule.get("capabilities")
        if not isinstance(capabilities, dict) or not isinstance(capabilities.get("image"), dict):
            raise PolicyConfigurationError(f"atomic prompt policy does not support image generation: {policy_id}")
        image = capabilities["image"]
        prompt = image.get("prompt", {})
        input_policy = image.get("input", {})
        if not isinstance(prompt, dict) or not isinstance(input_policy, dict):
            raise PolicyConfigurationError(f"atomic prompt policy has an invalid image adapter: {policy_id}")
        prefixes.append(str(prompt.get("prefix", "")))
        suffixes.append(str(prompt.get("suffix", "")))
        negative_prompts.append(str(prompt.get("negative_prompt", "")))
        allow_client_negative_prompt = allow_client_negative_prompt and bool(
            prompt.get("allow_client_negative_prompt", True)
        )
        if input_policy.get("refusal"):
            refusal = str(input_policy["refusal"])
        raw_rules = input_policy.get("deny_rules", [])
        if not isinstance(raw_rules, list):
            raise PolicyConfigurationError(f"atomic prompt policy deny_rules must be a list: {policy_id}")
        for raw_rule in raw_rules:
            rule_id = str(raw_rule.get("id", "")) if isinstance(raw_rule, dict) else ""
            if rule_id in seen_rule_ids:
                raise PolicyConfigurationError(f"duplicate prompt policy deny rule: {rule_id}")
            seen_rule_ids.add(rule_id)
            deny_rules.append(raw_rule)

    return {
        "schema_version": 1,
        "id": profile["id"],
        "prompt": {
            "prefix": "\n\n".join(part for part in prefixes if part),
            "suffix": "\n\n".join(part for part in suffixes if part),
            "negative_prompt": ", ".join(part for part in negative_prompts if part),
            "allow_client_negative_prompt": allow_client_negative_prompt,
        },
        "enforcement": {"input": {"refusal": refusal, "deny_rules": deny_rules}},
    }
