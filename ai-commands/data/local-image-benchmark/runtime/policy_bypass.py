"""Short-lived in-memory sessions for an explicitly configured policy bypass."""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time
from collections.abc import Callable


SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


class TemporaryPolicyBypass:
    """Exchange one configured code for revocable, process-local session tokens."""

    def __init__(
        self,
        code_sha256: str,
        ttl_seconds: int = 28_800,
        *,
        clock: Callable[[], float] = time.time,
        token_factory: Callable[[], str] = lambda: secrets.token_urlsafe(32),
        max_sessions: int = 256,
    ) -> None:
        digest = code_sha256.strip().lower()
        if digest and not SHA256_PATTERN.fullmatch(digest):
            raise ValueError("IMAGE_POLICY_BYPASS_CODE_SHA256 must be empty or a lowercase SHA-256 digest")
        if not 60 <= ttl_seconds <= 86_400:
            raise ValueError("IMAGE_POLICY_BYPASS_SESSION_TTL_SECONDS must be 60..86400")
        if max_sessions < 1:
            raise ValueError("max_sessions must be positive")
        self.code_sha256 = digest
        self.ttl_seconds = ttl_seconds
        self.clock = clock
        self.token_factory = token_factory
        self.max_sessions = max_sessions
        self.sessions: dict[str, float] = {}

    @property
    def enabled(self) -> bool:
        return bool(self.code_sha256)

    def exchange(self, code: str) -> str | None:
        if not self.enabled or not code:
            return None
        candidate = hashlib.sha256(code.encode("utf-8")).hexdigest()
        if not hmac.compare_digest(candidate, self.code_sha256):
            return None
        self._prune()
        while len(self.sessions) >= self.max_sessions:
            oldest = min(self.sessions, key=self.sessions.get)
            self.sessions.pop(oldest, None)
        token = self.token_factory()
        self.sessions[token] = self.clock() + self.ttl_seconds
        return token

    def active(self, token: str) -> bool:
        self._prune()
        return bool(token) and token in self.sessions

    def seconds_remaining(self, token: str) -> int:
        self._prune()
        expires_at = self.sessions.get(token)
        return max(0, int(expires_at - self.clock())) if expires_at is not None else 0

    def revoke(self, token: str) -> None:
        if token:
            self.sessions.pop(token, None)

    def _prune(self) -> None:
        now = self.clock()
        for token, expires_at in tuple(self.sessions.items()):
            if expires_at <= now:
                self.sessions.pop(token, None)
