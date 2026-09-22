#!/usr/bin/env python3
"""Container-side regression checks for resumable image chat streams."""

import asyncio

from starlette.requests import Request

import serve


def request_with_conversation(conversation_id: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/v1/chat/completions",
            "headers": [(b"x-conversation-id", conversation_id.encode("utf-8"))],
        }
    )


async def main() -> None:
    serve.STREAM_SESSIONS.clear()
    generation_calls = 0

    async def fake_generate(*_args):
        nonlocal generation_calls
        generation_calls += 1
        await asyncio.sleep(0.05)
        return "![Generated image](/outputs/test.png)"

    original = serve.generate_chat_content
    serve.generate_chat_content = fake_generate
    payload = {
        "stream": True,
        "messages": [{"role": "user", "content": "resumable stream test"}],
        "steps": 1,
        "seed": 1,
    }
    try:
        first = await serve.chat_completions(payload, request_with_conversation("conversation-test"))
        second = await serve.chat_completions(payload, request_with_conversation("conversation-test"))
        first_bytes = b"".join([chunk async for chunk in first.body_iterator])
        second_bytes = b"".join([chunk async for chunk in second.body_iterator])
    finally:
        serve.generate_chat_content = original

    assert generation_calls == 1, generation_calls
    assert first_bytes == second_bytes
    assert first_bytes.endswith(b"data: [DONE]\n\n")
    session = serve.STREAM_SESSIONS["conversation-test"]
    replay_offset = max(0, len(session.buffer) - len(b"data: [DONE]\n\n"))
    resumed = b"".join([chunk async for chunk in serve.consume_stream(session, replay_offset)])
    assert resumed == b"data: [DONE]\n\n"

    lookup = await serve.streams_lookup({"conversation_ids": ["conversation-test"]})
    assert lookup == [
        {
            "conversation_id": "conversation-test",
            "is_done": True,
            "total_bytes": len(session.buffer),
            "started_at": session.started_at,
            "completed_at": session.completed_at,
        }
    ]
    print("resumable stream tests: PASS")


if __name__ == "__main__":
    asyncio.run(main())
