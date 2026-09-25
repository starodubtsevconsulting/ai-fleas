#!/usr/bin/env python3
"""Container-side integration checks for policy-bypass HTTP and generation behavior."""

import asyncio
import hashlib
from http.cookies import SimpleCookie

from starlette.requests import Request
from starlette.responses import Response

import serve
from policy_bypass import TemporaryPolicyBypass


def request(query: bytes = b"", cookie: str = "") -> Request:
    headers = []
    if cookie:
        headers.append((b"cookie", cookie.encode("ascii")))
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": "/",
            "raw_path": b"/",
            "query_string": query,
            "headers": headers,
            "client": ("127.0.0.1", 1),
            "server": ("example.test", 443),
        }
    )


class FakeImage:
    def save(self, target, format="PNG"):
        del format
        target.write(b"test-png")


async def main() -> None:
    code = "test-code"
    clock = [1000.0]
    manager = TemporaryPolicyBypass(
        hashlib.sha256(code.encode()).hexdigest(),
        300,
        clock=lambda: clock[0],
        token_factory=lambda: "session-token",
    )
    original_manager = serve.POLICY_BYPASS
    serve.POLICY_BYPASS = manager

    async def must_not_route(_request):
        raise AssertionError("query exchange must redirect before routing")

    original_validate = serve.validate_policy_input
    original_generate = serve.generate_image
    try:
        exchanged = await serve.exchange_policy_bypass(
            request(b"keep=value&policy_bypass=test-code"),
            must_not_route,
        )
        assert exchanged.status_code == 303
        assert exchanged.headers["location"] == "/?keep=value&policy_bypass=active"
        assert code not in exchanged.headers["location"]
        assert exchanged.headers["cache-control"] == "no-store"
        assert exchanged.headers["referrer-policy"] == "no-referrer"
        cookie = SimpleCookie()
        cookie.load(exchanged.headers["set-cookie"])
        morsel = cookie[serve.POLICY_BYPASS_COOKIE]
        assert morsel.value == "session-token"
        assert morsel["secure"] and morsel["httponly"] and morsel["samesite"].lower() == "strict"
        cookie_header = f"{serve.POLICY_BYPASS_COOKIE}={morsel.value}"
        active_request = request(cookie=cookie_header)
        assert serve.policy_bypass_status(active_request) == {
            "enabled": True,
            "active": True,
            "expires_in_seconds": 300,
        }

        routed = []

        async def route(_request):
            routed.append(True)
            return Response("ui")

        active_page = await serve.exchange_policy_bypass(
            request(b"policy_bypass=active", cookie=cookie_header),
            route,
        )
        assert active_page.status_code == 200
        assert routed == [True]
        assert manager.active("session-token")

        generation_args = []

        async def reject_validation(_prompt):
            raise AssertionError("active bypass must skip semantic input validation")

        async def fake_generate(*args):
            generation_args.append(args)
            return FakeImage(), 0.01

        serve.validate_policy_input = reject_validation
        serve.generate_image = fake_generate
        payload = serve.GenerationRequest(prompt="boundary test", size="256x256", steps=1)
        generated = await serve.generate(payload, active_request)
        assert generated["data"][0]["b64_json"]
        assert generation_args[-1][-1] is True

        validation_calls = []

        async def allow_validation(prompt):
            validation_calls.append(prompt)

        serve.validate_policy_input = allow_validation
        await serve.generate(payload, request())
        assert validation_calls == ["boundary test"]
        assert generation_args[-1][-1] is False

        default_page = await serve.exchange_policy_bypass(active_request, route)
        assert default_page.status_code == 200
        assert not manager.active("session-token")
        assert "Max-Age=0" in default_page.headers["set-cookie"]

        second_exchange = await serve.exchange_policy_bypass(
            request(b"policy_bypass=test-code"),
            must_not_route,
        )
        second_cookie = SimpleCookie()
        second_cookie.load(second_exchange.headers["set-cookie"])
        second_token = second_cookie[serve.POLICY_BYPASS_COOKIE].value
        second_request = request(cookie=f"{serve.POLICY_BYPASS_COOKIE}={second_token}")
        revoked = serve.policy_bypass_revoke(second_request)
        assert revoked.status_code == 204
        assert not manager.active(second_token)
        assert "Max-Age=0" in revoked.headers["set-cookie"]

        invalid = await serve.exchange_policy_bypass(
            request(b"policy_bypass=wrong"),
            must_not_route,
        )
        assert invalid.status_code == 303
        assert "set-cookie" not in invalid.headers
    finally:
        serve.POLICY_BYPASS = original_manager
        serve.validate_policy_input = original_validate
        serve.generate_image = original_generate

    print("serve policy-bypass tests: PASS")


if __name__ == "__main__":
    asyncio.run(main())
