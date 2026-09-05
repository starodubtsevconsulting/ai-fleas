#!/usr/bin/env python3
"""Parse sample-text.txt into structured JSON and optional speaker segments TSV."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional


SPEAKERS = ("Narrator", "Maria", "Robert")


def clean(line: str) -> str:
    return line.strip()


def is_separator(line: str) -> bool:
    return bool(re.fullmatch(r"-{3,}", line))


def parse_int(text: str) -> Optional[int]:
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else None


def parse_script(lines: List[str]) -> List[Dict[str, str]]:
    script: List[Dict[str, str]] = []
    current_speaker: Optional[str] = None
    buffer: List[str] = []

    def flush() -> None:
        nonlocal buffer
        if current_speaker is None:
            buffer = []
            return
        text = " ".join(part.strip() for part in buffer if part.strip()).strip()
        if text:
            script.append({"type": "line", "speaker": current_speaker, "text": text})
        buffer = []

    for raw in lines:
        line = clean(raw)
        if not line or is_separator(line):
            continue

        if line in ("SCENE_START", "SCENE_END"):
            flush()
            script.append({"type": "scene_marker", "value": line})
            current_speaker = None
            continue

        if line in ("Narrator:", "Maria:", "Robert:"):
            flush()
            current_speaker = line[:-1]
            continue

        buffer.append(line)

    flush()
    return script


def parse_file(path: Path) -> Dict[str, object]:
    raw_lines = path.read_text(encoding="utf-8").splitlines()
    lines = [clean(x) for x in raw_lines]

    title = lines[0] if lines else ""
    purpose = next((x for x in lines if x.startswith("Purpose:")), "")

    rec_idx = next((i for i, x in enumerate(lines) if x == "Recording format:"), -1)
    pause_idx = next((i for i, x in enumerate(lines) if x == "Pause rules:"), -1)
    voice_idx = next((i for i, x in enumerate(lines) if x == "VOICE CONFIGURATION"), -1)
    script_hdr_idx = next((i for i, x in enumerate(lines) if x == "SCRIPT"), -1)
    important_idx = next((i for i, x in enumerate(lines) if x.startswith("Important:")), -1)

    if rec_idx < 0 or pause_idx < 0 or voice_idx < 0 or script_hdr_idx < 0:
        raise ValueError("Missing required section headers in sample text.")

    recording_block = lines[rec_idx + 1 : pause_idx]
    pause_block = lines[pause_idx + 1 : voice_idx]
    voice_end = important_idx if important_idx > voice_idx else script_hdr_idx
    voice_block = lines[voice_idx + 1 : voice_end]
    script_block = lines[script_hdr_idx + 1 :]

    recording_format: Dict[str, object] = {}
    for line in recording_block:
        if not line or is_separator(line):
            continue
        low = line.lower()
        if ":" in line:
            key, value = [part.strip() for part in line.split(":", 1)]
            key_low = key.lower().replace(" ", "_")
            if key_low in ("sample_rate", "bit_depth"):
                maybe_int = parse_int(value)
                recording_format[key_low] = maybe_int if maybe_int is not None else value
            else:
                recording_format[key_low] = value
        elif low == "no background noise":
            recording_format["no_background_noise"] = True
        elif low == "no overlapping speech":
            recording_format["no_overlapping_speech"] = True

    pause_rules: Dict[str, object] = {}
    for line in pause_block:
        if not line or is_separator(line):
            continue
        if line.lower().startswith("narrator pause:"):
            pause_rules["narrator_pause_ms"] = parse_int(line)
        elif line.lower().startswith("dialogue pause:"):
            pause_rules["dialogue_pause_ms"] = parse_int(line)

    voices: Dict[str, Dict[str, str]] = {}
    current_speaker: Optional[str] = None
    for line in voice_block:
        if not line or is_separator(line):
            continue
        if line in SPEAKERS:
            current_speaker = line
            voices[current_speaker] = {}
            continue
        if current_speaker and ":" in line:
            key, value = [part.strip() for part in line.split(":", 1)]
            voices[current_speaker][key.lower().replace(" ", "_")] = value

    script = parse_script(script_block)

    warnings: List[str] = []
    for speaker in SPEAKERS:
        if speaker not in voices:
            warnings.append(f"Missing voice config for {speaker}")
    if not any(x.get("value") == "SCENE_START" for x in script if x.get("type") == "scene_marker"):
        warnings.append("Missing SCENE_START marker")
    if not any(x.get("value") == "SCENE_END" for x in script if x.get("type") == "scene_marker"):
        warnings.append("Missing SCENE_END marker")
    for item in script:
        if item.get("type") == "line" and not item.get("text"):
            warnings.append(f"Empty script text for speaker: {item.get('speaker')}")

    payload: Dict[str, object] = {
        "recording_format": recording_format,
        "pause_rules": pause_rules,
        "voices": voices,
        "script": script,
        "meta": {"title": title, "purpose": purpose},
    }
    if warnings:
        payload["warnings"] = warnings
    return payload


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--json-out")
    parser.add_argument("--segments-out")
    args = parser.parse_args()

    payload = parse_file(Path(args.input))

    if args.json_out:
        out = Path(args.json_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    if args.segments_out:
        out = Path(args.segments_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        rows: List[str] = []
        for item in payload.get("script", []):
            if item.get("type") != "line":
                continue
            speaker = str(item.get("speaker", "")).strip()
            text = str(item.get("text", "")).strip().replace("\t", " ")
            rows.append(f"{speaker}\t{text}")
        out.write_text("\n".join(rows) + ("\n" if rows else ""), encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
