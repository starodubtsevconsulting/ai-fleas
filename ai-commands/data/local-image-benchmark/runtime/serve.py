#!/usr/bin/env python3
"""Small OpenAI-compatible image endpoint for the selected local pipeline."""

from __future__ import annotations

import asyncio
import base64
import gc
import io
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path

import torch
from diffusers import DiffusionPipeline, StableDiffusionXLPipeline
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from safety import available_memory_bytes, env_bool, env_float, env_int, request_limit_error
from generation_policy import load_generation_policy


MODEL_ID = os.environ.get("IMAGE_MODEL_ID", "black-forest-labs/FLUX.2-dev")
MODEL_REVISION = os.environ.get("IMAGE_MODEL_REVISION", "")
MODEL_FILE = os.environ.get("IMAGE_MODEL_FILE", "")
PIPELINE_TYPE = os.environ.get("IMAGE_PIPELINE_TYPE", "diffusers-repository")
MODEL_ALIASES = {MODEL_ID, MODEL_ID.rsplit("/", 1)[-1], "local-image-generator"}
DTYPE_NAME = os.environ.get("IMAGE_DTYPE", "bfloat16")
DEFAULT_STEPS = int(os.environ.get("IMAGE_DEFAULT_STEPS", "50"))
DEFAULT_GUIDANCE = float(os.environ.get("IMAGE_DEFAULT_GUIDANCE", "4.0"))
GUIDANCE_PARAMETER = os.environ.get("IMAGE_GUIDANCE_PARAMETER", "guidance_scale")
DEFAULT_NEGATIVE_PROMPT = os.environ.get("IMAGE_DEFAULT_NEGATIVE_PROMPT", "")
DEFAULT_SIZE = os.environ.get("IMAGE_DEFAULT_SIZE", "1024x1024")
MAX_WIDTH = env_int("IMAGE_MAX_WIDTH", 2048, 256)
MAX_HEIGHT = env_int("IMAGE_MAX_HEIGHT", 2048, 256)
MAX_PIXELS = env_int("IMAGE_MAX_PIXELS", 4194304, 65536)
MAX_STEPS = env_int("IMAGE_MAX_STEPS", 100, 1)
MIN_AVAILABLE_BYTES = env_int("IMAGE_MIN_AVAILABLE_BYTES", 0, 0)
EMERGENCY_AVAILABLE_BYTES = env_int("IMAGE_EMERGENCY_AVAILABLE_BYTES", 0, 0)
MEMORY_POLL_SECONDS = env_float("IMAGE_MEMORY_POLL_SECONDS", 0.5, 0.05)
EXIT_ON_MEMORY_EMERGENCY = env_bool("IMAGE_EXIT_ON_MEMORY_EMERGENCY", False)
RELEASE_CACHE_AFTER_GENERATION = env_bool("IMAGE_RELEASE_CACHE_AFTER_GENERATION", False)
if EMERGENCY_AVAILABLE_BYTES > MIN_AVAILABLE_BYTES:
    raise RuntimeError("IMAGE_EMERGENCY_AVAILABLE_BYTES cannot exceed IMAGE_MIN_AVAILABLE_BYTES")
if GUIDANCE_PARAMETER not in {"guidance_scale", "true_cfg_scale", "none"}:
    raise RuntimeError("IMAGE_GUIDANCE_PARAMETER must be guidance_scale, true_cfg_scale, or none")
OUTPUT_DIR = Path(os.environ.get("IMAGE_OUTPUT_DIR", "/outputs"))
UI_DIR = Path(os.environ.get("IMAGE_UI_DIR", "/benchmark/ui"))
POLICY_DIR = Path(os.environ.get("IMAGE_POLICY_DIR", str(Path(__file__).parent / "policies")))
POLICY_ID = os.environ.get("IMAGE_POLICY_PRESET", "unrestricted")
GENERATION_POLICY = load_generation_policy(POLICY_ID, POLICY_DIR)
PIPELINE = None
GENERATION_LOCK = asyncio.Lock()
BACKGROUND_TASKS: set[asyncio.Task] = set()
STREAM_SESSIONS: dict[str, "StreamSession"] = {}
STREAM_SESSION_TTL_SECONDS = 300


@dataclass
class StreamSession:
    conversation_id: str
    started_at: int = field(default_factory=lambda: int(time.time()))
    completed_at: int = 0
    buffer: bytearray = field(default_factory=bytearray)
    condition: asyncio.Condition = field(default_factory=asyncio.Condition)
    producer: asyncio.Task | None = None
    cancelled: bool = False

    @property
    def done(self) -> bool:
        return self.completed_at > 0

    async def append(self, value: str) -> None:
        async with self.condition:
            self.buffer.extend(value.encode("utf-8"))
            self.condition.notify_all()

    async def finish(self) -> None:
        async with self.condition:
            self.completed_at = int(time.time())
            self.condition.notify_all()


def prune_stream_sessions() -> None:
    cutoff = int(time.time()) - STREAM_SESSION_TTL_SECONDS
    expired = [key for key, session in STREAM_SESSIONS.items() if session.done and session.completed_at < cutoff]
    for key in expired:
        STREAM_SESSIONS.pop(key, None)


async def consume_stream(session: StreamSession, offset: int = 0):
    while True:
        async with session.condition:
            await session.condition.wait_for(lambda: len(session.buffer) > offset or session.done)
            data = bytes(session.buffer[offset:])
            offset = len(session.buffer)
            done = session.done
        if data:
            yield data
        if done and offset >= len(session.buffer):
            return


class GenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    model: str | None = None
    n: int = Field(default=1, ge=1, le=1)
    size: str = DEFAULT_SIZE
    response_format: str = "b64_json"
    seed: int | None = None
    steps: int | None = Field(default=None, ge=1, le=100)
    guidance_scale: float | None = Field(default=None, ge=0, le=20)
    true_cfg_scale: float | None = Field(default=None, ge=0, le=20)
    negative_prompt: str | None = Field(default=None, max_length=8000)


def parse_size(value: str) -> tuple[int, int]:
    try:
        width, height = (int(part) for part in value.lower().split("x", 1))
    except (TypeError, ValueError):
        raise HTTPException(400, "size must be WIDTHxHEIGHT")
    if width < 256 or height < 256 or width > 2048 or height > 2048 or width % 16 or height % 16:
        raise HTTPException(400, "dimensions must be 256..2048 and divisible by 16")
    return width, height


def validated_request(width: int, height: int, steps: int) -> None:
    limit_error = request_limit_error(width, height, steps, MAX_WIDTH, MAX_HEIGHT, MAX_PIXELS, MAX_STEPS)
    if limit_error:
        raise HTTPException(400, limit_error)
    available = available_memory_bytes()
    if available < MIN_AVAILABLE_BYTES:
        raise HTTPException(
            503,
            f"insufficient host memory: {available} available; {MIN_AVAILABLE_BYTES} required",
        )


def release_generation_memory() -> None:
    if not RELEASE_CACHE_AFTER_GENERATION:
        return
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        if hasattr(torch.cuda, "ipc_collect"):
            torch.cuda.ipc_collect()


async def memory_watchdog(stop: asyncio.Event) -> None:
    if EMERGENCY_AVAILABLE_BYTES == 0:
        return
    while not stop.is_set():
        available = available_memory_bytes()
        if available < EMERGENCY_AVAILABLE_BYTES:
            message = (
                f"MEMORY_EMERGENCY: {available} bytes available is below "
                f"{EMERGENCY_AVAILABLE_BYTES}; terminating worker to protect the host"
            )
            print(message, flush=True)
            if EXIT_ON_MEMORY_EMERGENCY:
                os._exit(75)
            raise RuntimeError(message)
        try:
            await asyncio.wait_for(stop.wait(), timeout=MEMORY_POLL_SECONDS)
        except TimeoutError:
            pass


def chat_prompt(messages: object) -> str:
    if not isinstance(messages, list):
        raise HTTPException(400, "messages must be a list")
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
        if isinstance(content, list):
            parts = [
                item.get("text", "").strip()
                for item in content
                if isinstance(item, dict) and item.get("type") == "text"
            ]
            prompt = "\n".join(part for part in parts if part)
            if prompt:
                return prompt
    raise HTTPException(400, "a non-empty user message is required")


async def generate_image(
    prompt: str,
    width: int,
    height: int,
    steps: int,
    guidance: float,
    seed: int,
    negative_prompt: str | None = None,
):
    try:
        prompt, negative_prompt = GENERATION_POLICY.prepare_prompt(prompt, negative_prompt)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    validated_request(width, height, steps)
    kwargs = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "num_inference_steps": steps,
        "generator": torch.Generator(device="cpu").manual_seed(seed),
    }
    if GUIDANCE_PARAMETER != "none":
        kwargs[GUIDANCE_PARAMETER] = guidance
    if GUIDANCE_PARAMETER == "true_cfg_scale":
        kwargs["negative_prompt"] = DEFAULT_NEGATIVE_PROMPT if negative_prompt is None else negative_prompt
    async with GENERATION_LOCK:
        started = time.perf_counter()
        watchdog_stop = asyncio.Event()
        watchdog = asyncio.create_task(memory_watchdog(watchdog_stop))
        try:
            image = await asyncio.to_thread(lambda: PIPELINE(**kwargs).images[0])
            elapsed = time.perf_counter() - started
        finally:
            watchdog_stop.set()
            await watchdog
    return image, elapsed


async def generate_chat_content(prompt: str, width: int, height: int, steps: int, guidance: float, seed: int, negative_prompt: str | None = None) -> str:
    try:
        image, elapsed = await generate_image(prompt, width, height, steps, guidance, seed, negative_prompt)
        filename = f"{int(time.time())}-{uuid.uuid4().hex}.png"
        output_path = OUTPUT_DIR / filename
        image.save(output_path, format="PNG")
        return (
            f"![Generated image](/outputs/{filename})\n\n"
            f"Model: `{MODEL_ID}` · Seed: `{seed}` · {width}×{height} · "
            f"{steps} steps · {elapsed:.2f} s"
        )
    finally:
        release_generation_memory()


@asynccontextmanager
async def lifespan(_: FastAPI):
    global PIPELINE
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dtype = getattr(torch, DTYPE_NAME)
    if PIPELINE_TYPE == "single-file-sdxl":
        if not MODEL_FILE:
            raise RuntimeError("IMAGE_MODEL_FILE is required for single-file-sdxl")
        PIPELINE = StableDiffusionXLPipeline.from_single_file(
            MODEL_FILE,
            torch_dtype=dtype,
        ).to("cuda")
    else:
        load_kwargs = {"torch_dtype": dtype, "device_map": "cuda"}
        if MODEL_REVISION:
            load_kwargs["revision"] = MODEL_REVISION
        PIPELINE = DiffusionPipeline.from_pretrained(MODEL_ID, **load_kwargs)
    yield
    PIPELINE = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = FastAPI(title="GX10 Local Image Generator", version="1", lifespan=lifespan)
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR), check_dir=False), name="outputs")


@app.get("/health")
def health():
    available = available_memory_bytes()
    if available < MIN_AVAILABLE_BYTES:
        raise HTTPException(503, f"degraded host memory: {available} bytes available")
    return {
        "status": "ready",
        "model": MODEL_ID,
        "generation_policy": GENERATION_POLICY.id,
        "available_memory_bytes": available,
    }


@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{"id": MODEL_ID, "object": "model", "owned_by": "local"}]}


@app.get("/props")
def props(model: str | None = None, autoload: bool = False):
    del autoload
    if model and model not in MODEL_ALIASES:
        raise HTTPException(404, f"model is not active: {model}")
    return {
        "model": MODEL_ID,
        "model_path": MODEL_ID,
        "total_slots": 1,
        "modalities": {"vision": False, "audio": False},
        "capabilities": ["image-generation"],
        "generation_policy": GENERATION_POLICY.id,
        "default_generation_settings": {
            "id": MODEL_ID,
            "params": {
                "size": DEFAULT_SIZE,
                "steps": DEFAULT_STEPS,
                "guidance_scale": DEFAULT_GUIDANCE,
                "guidance_parameter": GUIDANCE_PARAMETER,
            },
        },
    }


@app.post("/v1/images/generations")
async def generate(request: GenerationRequest):
    if request.model and request.model not in MODEL_ALIASES:
        raise HTTPException(400, f"model is not active: {request.model}")
    if request.response_format != "b64_json":
        raise HTTPException(400, "only response_format=b64_json is supported")
    width, height = parse_size(request.size)
    seed = request.seed if request.seed is not None else int.from_bytes(os.urandom(8), "big")
    try:
        image, elapsed = await generate_image(
            request.prompt,
            width,
            height,
            request.steps or DEFAULT_STEPS,
            request.true_cfg_scale if request.true_cfg_scale is not None else request.guidance_scale if request.guidance_scale is not None else DEFAULT_GUIDANCE,
            seed,
            request.negative_prompt,
        )
        output = io.BytesIO()
        image.save(output, format="PNG")
        return {
            "created": int(time.time()),
            "data": [{"b64_json": base64.b64encode(output.getvalue()).decode("ascii")}],
            "model": MODEL_ID,
            "seed": seed,
            "generation_seconds": elapsed,
        }
    finally:
        release_generation_memory()


@app.post("/v1/chat/completions")
async def chat_completions(payload: dict, http_request: Request):
    prompt = chat_prompt(payload.get("messages"))
    width, height = parse_size(str(payload.get("size", DEFAULT_SIZE)))
    steps = int(payload.get("steps", DEFAULT_STEPS))
    guidance = float(payload.get("guidance_scale", DEFAULT_GUIDANCE))
    if GUIDANCE_PARAMETER == "true_cfg_scale":
        guidance = float(payload.get("true_cfg_scale", guidance))
    negative_prompt = payload.get("negative_prompt", DEFAULT_NEGATIVE_PROMPT)
    seed = int(payload.get("seed", int.from_bytes(os.urandom(8), "big")))
    if not 1 <= steps <= 100:
        raise HTTPException(400, "steps must be 1..100")
    if not 0 <= guidance <= 20:
        raise HTTPException(400, "guidance_scale must be 0..20")
    created = int(time.time())
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"
    if not payload.get("stream"):
        content = await generate_chat_content(prompt, width, height, steps, guidance, seed, negative_prompt)
        return {
            "id": completion_id,
            "object": "chat.completion",
            "created": created,
            "model": MODEL_ID,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    conversation_id = http_request.headers.get("x-conversation-id", "").strip() or completion_id
    prune_stream_sessions()
    session = STREAM_SESSIONS.get(conversation_id)

    async def produce_stream(active_session: StreamSession):
        generation_task = asyncio.create_task(generate_chat_content(prompt, width, height, steps, guidance, seed, negative_prompt))
        BACKGROUND_TASKS.add(generation_task)
        generation_task.add_done_callback(BACKGROUND_TASKS.discard)
        while not generation_task.done() and not active_session.cancelled:
            try:
                await asyncio.wait_for(asyncio.shield(generation_task), timeout=10)
            except TimeoutError:
                await active_session.append(": keep-alive\n\n")
        try:
            if active_session.cancelled:
                generation_task.cancel()
                return
            content = generation_task.result()
            chunk = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": MODEL_ID,
                "choices": [{"index": 0, "delta": {"role": "assistant", "content": content}, "finish_reason": None}],
            }
            await active_session.append(f"data: {json.dumps(chunk)}\n\n")
            done = dict(chunk)
            done["choices"] = [{"index": 0, "delta": {}, "finish_reason": "stop"}]
            await active_session.append(f"data: {json.dumps(done)}\n\n")
            await active_session.append("data: [DONE]\n\n")
        except Exception as error:
            message = {"error": {"message": str(error), "type": "generation_error"}}
            await active_session.append(f"data: {json.dumps(message)}\n\n")
            await active_session.append("data: [DONE]\n\n")
        finally:
            await active_session.finish()

    if session is None or session.done:
        session = StreamSession(conversation_id=conversation_id)
        STREAM_SESSIONS[conversation_id] = session
        session.producer = asyncio.create_task(produce_stream(session))
        BACKGROUND_TASKS.add(session.producer)
        session.producer.add_done_callback(BACKGROUND_TASKS.discard)

    return StreamingResponse(consume_stream(session), media_type="text/event-stream")


@app.post("/v1/streams/lookup")
async def streams_lookup(payload: dict):
    prune_stream_sessions()
    requested = payload.get("conversation_ids", [])
    if not isinstance(requested, list) or not all(isinstance(value, str) for value in requested):
        raise HTTPException(400, "conversation_ids must be a list of strings")
    matches = []
    for requested_id in requested:
        for session in STREAM_SESSIONS.values():
            if session.conversation_id == requested_id or session.conversation_id.startswith(f"{requested_id}::"):
                matches.append(
                    {
                        "conversation_id": session.conversation_id,
                        "is_done": session.done,
                        "total_bytes": len(session.buffer),
                        "started_at": session.started_at,
                        "completed_at": session.completed_at,
                    }
                )
    return matches


@app.get("/v1/stream")
async def stream_resume(conv_id: str, from_offset: int = Query(default=0, alias="from", ge=0)):
    prune_stream_sessions()
    session = STREAM_SESSIONS.get(conv_id)
    if session is None:
        raise HTTPException(404, "Stream not found or expired")
    if from_offset > len(session.buffer):
        raise HTTPException(400, "Stream offset is beyond available data")
    return StreamingResponse(consume_stream(session, from_offset), media_type="text/event-stream")


@app.delete("/v1/stream")
async def stream_delete(conv_id: str):
    session = STREAM_SESSIONS.pop(conv_id, None)
    if session is not None:
        session.cancelled = True
        await session.finish()
    return Response(status_code=204)


if UI_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(UI_DIR), html=True), name="ui")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("IMAGE_PORT", "8000")))
