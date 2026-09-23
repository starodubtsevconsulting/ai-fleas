"""Fail-closed semantic policy decisions for model-serving adapters."""

from __future__ import annotations

import asyncio
import base64
import json
import re
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path


REASON_CODE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


class ModerationConfigurationError(RuntimeError):
    pass


class PolicyDecisionError(RuntimeError):
    def __init__(self, public_message: str, reason_code: str, unavailable: bool = False):
        super().__init__(public_message)
        self.public_message = public_message
        self.reason_code = reason_code
        self.unavailable = unavailable


@dataclass(frozen=True)
class SemanticPolicy:
    profile_id: str
    policy_ids: tuple[str, ...]
    instructions: tuple[str, ...]
    refusal: str


class SemanticModerator:
    """Spec: ../generation-policy.spec.md#phase-2-semantic-moderation"""

    def __init__(
        self,
        policy: SemanticPolicy,
        endpoint: str,
        *,
        input_enabled: bool,
        output_enabled: bool,
        timeout_seconds: float = 5.0,
        auth_token_file: str = "",
    ):
        self.policy = policy
        self.endpoint = endpoint.strip()
        self.input_enabled = input_enabled and policy.profile_id != "unrestricted"
        self.output_enabled = output_enabled and policy.profile_id != "unrestricted"
        self.timeout_seconds = timeout_seconds
        self.auth_token = ""
        if (self.input_enabled or self.output_enabled) and not self.endpoint:
            raise ModerationConfigurationError("semantic moderation is enabled without a decision-service URL")
        if (self.input_enabled or self.output_enabled) and not policy.instructions:
            raise ModerationConfigurationError("semantic moderation is enabled without policy instructions")
        if timeout_seconds <= 0:
            raise ModerationConfigurationError("semantic moderation timeout must be positive")
        if auth_token_file:
            try:
                self.auth_token = Path(auth_token_file).read_text(encoding="utf-8").strip()
            except OSError as error:
                raise ModerationConfigurationError("semantic moderation token file is unreadable") from error
            if not self.auth_token:
                raise ModerationConfigurationError("semantic moderation token file is empty")

    async def check_input(self, prompt: str) -> None:
        if self.input_enabled:
            await self._check("input", {"type": "text", "text": prompt})

    async def check_image_output(self, png_bytes: bytes) -> None:
        if self.output_enabled:
            await self._check(
                "output",
                {"type": "image", "media_type": "image/png", "base64": base64.b64encode(png_bytes).decode("ascii")},
            )

    async def _check(self, stage: str, content: dict) -> None:
        request_id = uuid.uuid4().hex
        started = time.perf_counter()
        payload = {
            "schema_version": 1,
            "request_id": request_id,
            "profile": {
                "id": self.policy.profile_id,
                "policy_ids": list(self.policy.policy_ids),
                "instructions": list(self.policy.instructions),
            },
            "stage": stage,
            "capability": "image",
            "content": content,
        }
        try:
            result = await asyncio.to_thread(self._post_json, payload)
        except (OSError, TimeoutError, urllib.error.URLError, json.JSONDecodeError) as error:
            self._log_decision(request_id, stage, "error", "moderation_unavailable", started)
            raise PolicyDecisionError(self.policy.refusal, "moderation_unavailable", unavailable=True) from error
        if not isinstance(result, dict) or result.get("request_id") != request_id:
            self._log_decision(request_id, stage, "error", "moderation_malformed", started)
            raise PolicyDecisionError(self.policy.refusal, "moderation_malformed", unavailable=True)
        decision = result.get("decision")
        reason_code = result.get("reason_code")
        if not isinstance(reason_code, str) or not REASON_CODE_PATTERN.fullmatch(reason_code):
            self._log_decision(request_id, stage, "error", "moderation_malformed", started)
            raise PolicyDecisionError(self.policy.refusal, "moderation_malformed", unavailable=True)
        if decision == "allow":
            self._log_decision(request_id, stage, "allow", reason_code, started)
            return
        if decision == "deny":
            self._log_decision(request_id, stage, "deny", reason_code, started)
            raise PolicyDecisionError(self.policy.refusal, reason_code)
        self._log_decision(request_id, stage, "error", "moderation_uncertain", started)
        raise PolicyDecisionError(self.policy.refusal, "moderation_uncertain", unavailable=True)

    def _log_decision(self, request_id: str, stage: str, decision: str, reason_code: str, started: float) -> None:
        event = {
            "event": "policy_moderation_decision",
            "request_id": request_id,
            "profile_id": self.policy.profile_id,
            "stage": stage,
            "decision": decision,
            "reason_code": reason_code,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }
        print(json.dumps(event, separators=(",", ":")), flush=True)

    def _post_json(self, payload: dict) -> dict:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        request = urllib.request.Request(self.endpoint, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
            if response.status != 200:
                raise OSError(f"moderation service returned HTTP {response.status}")
            raw = response.read(65537)
            if len(raw) > 65536:
                raise OSError("moderation service response is too large")
            return json.loads(raw.decode("utf-8"))
