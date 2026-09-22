#!/usr/bin/env python3
"""Run one quality-first image-generation candidate and retain evidence."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import platform
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def meminfo() -> dict[str, int]:
    values = {}
    with Path("/proc/meminfo").open(encoding="utf-8") as handle:
        for line in handle:
            key, value = line.split(":", 1)
            values[key] = int(value.strip().split()[0]) * 1024
    return values


class MemorySampler:
    def __init__(self, interval: float = 0.2):
        self.interval = interval
        self.minimum_available = None
        self.maximum_used = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._sample, daemon=True)

    def _sample(self):
        while not self._stop.is_set():
            current = meminfo()
            available = current.get("MemAvailable", 0)
            total = current.get("MemTotal", 0)
            used = total - available
            self.minimum_available = available if self.minimum_available is None else min(self.minimum_available, available)
            self.maximum_used = used if self.maximum_used is None else max(self.maximum_used, used)
            self._stop.wait(self.interval)

    def __enter__(self):
        self._thread.start()
        return self

    def __exit__(self, *_):
        self._stop.set()
        self._thread.join()


def command_output(command: list[str]) -> str | None:
    try:
        return subprocess.check_output(command, text=True, stderr=subprocess.DEVNULL, timeout=10).strip()
    except (OSError, subprocess.SubprocessError):
        return None


def environment(machine_label: str, catalog_root: Path) -> dict:
    import torch

    memory = meminfo()
    return {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "machine_label": machine_label,
        "platform": platform.platform(),
        "architecture": platform.machine(),
        "python": platform.python_version(),
        "torch": torch.__version__,
        "torch_cuda": torch.version.cuda,
        "cuda_available": torch.cuda.is_available(),
        "gpu": command_output(["nvidia-smi", "--query-gpu=name,driver_version", "--format=csv,noheader"]),
        "memory_total_bytes": memory.get("MemTotal"),
        "git_commit": command_output(["git", "-C", str(catalog_root), "rev-parse", "HEAD"]),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidate", required=True)
    parser.add_argument(
        "--catalog-root",
        type=Path,
        required=True,
        help="Directory containing candidates.json, cases.json, and benchmark references.",
    )
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--seed", type=int, default=104729)
    parser.add_argument("--case", action="append", dest="case_ids")
    parser.add_argument(
        "--machine-label",
        default="local-benchmark-host",
        help="Non-identifying hardware label stored in results; never use a hostname, account, IP, or personal name.",
    )
    args = parser.parse_args()

    catalog_root = args.catalog_root.expanduser().resolve()
    if not catalog_root.is_dir():
        parser.error("catalog root is not a directory")
    candidates = {item["id"]: item for item in read_json(catalog_root / "candidates.json")}
    if args.candidate not in candidates:
        parser.error(f"unknown candidate: {args.candidate}")
    candidate = candidates[args.candidate]
    cases = read_json(catalog_root / "cases.json")
    if args.case_ids:
        cases = [case for case in cases if case["id"] in args.case_ids]
    cases = [case for case in cases if case["capability"] in candidate["capabilities"]]
    if not cases:
        parser.error("candidate and case selection have no compatible cases")

    import torch
    from diffusers import DiffusionPipeline, StableDiffusionXLPipeline
    from diffusers.utils import load_image
    from PIL import Image

    dtype = getattr(torch, candidate["dtype"])
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + f"-{candidate['id']}"
    run_dir = args.output_root.expanduser().resolve() / run_id
    run_dir.mkdir(parents=True)
    (run_dir / "environment.json").write_text(json.dumps(environment(args.machine_label, catalog_root), indent=2) + "\n", encoding="utf-8")
    packages = command_output([os.sys.executable, "-m", "pip", "freeze"]) or ""
    (run_dir / "resolved-packages.txt").write_text(packages + "\n", encoding="utf-8")

    load_started = time.perf_counter()
    with MemorySampler() as load_memory:
        if candidate.get("format") == "single-file-sdxl":
            pipe = StableDiffusionXLPipeline.from_single_file(
                candidate["model_file"],
                torch_dtype=dtype,
            ).to(candidate["device_map"])
        else:
            load_kwargs = {
                "torch_dtype": dtype,
                "device_map": candidate["device_map"],
            }
            if candidate.get("revision"):
                load_kwargs["revision"] = candidate["revision"]
            pipe = DiffusionPipeline.from_pretrained(
                candidate["model"],
                **load_kwargs,
            )
    load_seconds = time.perf_counter() - load_started
    resolved_model_revision = getattr(pipe, "_commit_hash", None)
    model_revision = resolved_model_revision or candidate.get("revision")

    results_path = run_dir / "results.jsonl"
    with results_path.open("a", encoding="utf-8") as results:
        for case in cases:
            for repetition in range(args.repeat):
                seed = args.seed + repetition
                generator = torch.Generator(device="cpu").manual_seed(seed)
                configured_parameters = candidate.get("generation_parameters", {})
                steps = configured_parameters.get("steps", case["steps"])
                kwargs = {
                    "prompt": case["prompt"],
                    "width": case["width"],
                    "height": case["height"],
                    "num_inference_steps": steps,
                    "generator": generator,
                }
                if "true_cfg_scale" in configured_parameters:
                    kwargs["true_cfg_scale"] = configured_parameters["true_cfg_scale"]
                    kwargs["negative_prompt"] = configured_parameters.get("negative_prompt", " ")
                else:
                    kwargs["guidance_scale"] = configured_parameters.get(
                        "guidance_scale", case["guidance_scale"]
                    )
                if case["capability"] == "image-editing":
                    image_path = (catalog_root / case["image"]).resolve()
                    try:
                        image_path.relative_to(catalog_root)
                    except ValueError:
                        raise RuntimeError("benchmark reference must stay within the catalog root")
                    if not image_path.is_file():
                        raise FileNotFoundError(f"missing benchmark reference: {image_path}")
                    if image_path.suffix.lower() == ".svg":
                        import cairosvg

                        rendered = cairosvg.svg2png(url=str(image_path), output_width=1024, output_height=1024)
                        kwargs["image"] = Image.open(io.BytesIO(rendered)).convert("RGB")
                    else:
                        kwargs["image"] = load_image(str(image_path))

                if torch.cuda.is_available():
                    torch.cuda.reset_peak_memory_stats()
                    torch.cuda.synchronize()
                started = time.perf_counter()
                with MemorySampler() as generation_memory:
                    image = pipe(**kwargs).images[0]
                    if torch.cuda.is_available():
                        torch.cuda.synchronize()
                latency = time.perf_counter() - started

                output = run_dir / "outputs" / candidate["id"] / case["id"] / f"{seed}.png"
                output.parent.mkdir(parents=True, exist_ok=True)
                image.save(output, format="PNG")
                record = {
                    "candidate_id": candidate["id"],
                    "benchmark_role": candidate["benchmark_role"],
                    "intended_use": candidate["intended_use"],
                    "production_eligible": candidate["production_eligible"],
                    "model": candidate["model"],
                    "model_revision": model_revision,
                    "model_revision_source": (
                        "pipeline" if resolved_model_revision else "pinned-candidate-config"
                    ),
                    "dtype": candidate["dtype"],
                    "case_id": case["id"],
                    "capability": case["capability"],
                    "seed": seed,
                    "repetition": repetition + 1,
                    "width": case["width"],
                    "height": case["height"],
                    "steps": steps,
                    "guidance_scale": kwargs.get("guidance_scale"),
                    "true_cfg_scale": kwargs.get("true_cfg_scale"),
                    "negative_prompt": kwargs.get("negative_prompt"),
                    "load_seconds": load_seconds,
                    "load_peak_system_used_bytes": load_memory.maximum_used,
                    "generation_seconds": latency,
                    "generation_peak_system_used_bytes": generation_memory.maximum_used,
                    "generation_minimum_available_bytes": generation_memory.minimum_available,
                    "torch_peak_allocated_bytes": torch.cuda.max_memory_allocated() if torch.cuda.is_available() else None,
                    "torch_peak_reserved_bytes": torch.cuda.max_memory_reserved() if torch.cuda.is_available() else None,
                    "output": str(output.relative_to(run_dir)),
                    "output_bytes": output.stat().st_size,
                    "output_sha256": sha256(output),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
                results.write(json.dumps(record, sort_keys=True) + "\n")
                results.flush()
                print(json.dumps(record, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
