"""Configuration and host-memory safety helpers for the image service."""

from __future__ import annotations

import os
from pathlib import Path


def env_int(name: str, default: int, minimum: int = 0) -> int:
    value = int(os.environ.get(name, str(default)))
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}")
    return value


def env_float(name: str, default: float, minimum: float = 0) -> float:
    value = float(os.environ.get(name, str(default)))
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}")
    return value


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name, "true" if default else "false").strip().lower()
    if value not in {"true", "false"}:
        raise RuntimeError(f"{name} must be true or false")
    return value == "true"


def available_memory_bytes(meminfo: Path = Path("/proc/meminfo")) -> int:
    for line in meminfo.read_text(encoding="utf-8").splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1]) * 1024
    raise RuntimeError(f"MemAvailable is missing from {meminfo}")


def request_limit_error(
    width: int,
    height: int,
    steps: int,
    max_width: int,
    max_height: int,
    max_pixels: int,
    max_steps: int,
) -> str | None:
    if width > max_width or height > max_height:
        return f"dimensions exceed configured maximum {max_width}x{max_height}"
    if width * height > max_pixels:
        return f"pixel count exceeds configured maximum {max_pixels}"
    if steps > max_steps:
        return f"steps exceed configured maximum {max_steps}"
    return None
