#!/usr/bin/env python3
"""Spec: ai-config/commands/lyrics-timestamp/lyrics-timestamp.command.md"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class TimedLyricLine:
    index: int
    start_ms: int
    end_ms: int
    text: str
    confidence: float

    def to_json(self) -> dict[str, object]:
        return {
            "index": self.index,
            "startMs": self.start_ms,
            "endMs": self.end_ms,
            "text": self.text,
            "confidence": self.confidence,
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Map lyrics lines to audio timestamps.")
    parser.add_argument("--lyrics-file", required=True)
    parser.add_argument("--audio-file", required=True)
    parser.add_argument("--dist", required=True)
    parser.add_argument("--line-mode", default="non-empty", choices=["non-empty"])
    parser.add_argument("--format", default="json,srt")
    parser.add_argument("--tail-ms", type=int, default=250)
    parser.add_argument("--timing-hints-file", default="")
    parser.add_argument("--preview", action="store_true")
    return parser.parse_args()


def audio_duration_ms(audio_file: Path) -> int:
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(audio_file),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("ffprobe is required to detect audio duration.") from exc
    except subprocess.CalledProcessError as exc:
        message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise RuntimeError(f"Could not read audio duration: {message}") from exc

    raw_duration = result.stdout.strip()
    if not raw_duration:
        raise RuntimeError("ffprobe did not return an audio duration.")
    duration_ms = round(float(raw_duration) * 1000)
    if duration_ms <= 0:
        raise RuntimeError(f"Audio duration must be positive, got {duration_ms}ms.")
    return duration_ms


def is_speakable_line(line: str) -> bool:
    text = line.strip()
    if not text:
        return False
    return any(char.isalnum() for char in text)


def lyric_lines(lyrics_file: Path) -> list[str]:
    lines = [line.strip() for line in lyrics_file.read_text(encoding="utf-8").splitlines()]
    return [line for line in lines if is_speakable_line(line)]


def parse_time_ms(value: object) -> int:
    if isinstance(value, int | float):
        return round(float(value))
    text = str(value or "").strip()
    if not text:
        raise RuntimeError("Timing hint value is empty.")
    if text.isdigit():
        return int(text)
    normalized = text.replace(",", ".")
    parts = normalized.split(":")
    try:
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return round((minutes * 60 + seconds) * 1000)
        if len(parts) == 3:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return round((hours * 3600 + minutes * 60 + seconds) * 1000)
    except ValueError as exc:
        raise RuntimeError(f"Invalid timing hint value: {value}") from exc
    raise RuntimeError(f"Invalid timing hint value: {value}")


def normalized_text(value: str) -> str:
    return " ".join(value.casefold().split())


def load_timing_hints(hints_file: Path | None, lines: list[str]) -> dict[int, tuple[int, int]]:
    if hints_file is None:
        return {}
    if not hints_file.is_file():
        raise RuntimeError(f"Timing hints file not found: {hints_file}")
    payload = json.loads(hints_file.read_text(encoding="utf-8"))
    entries = payload if isinstance(payload, list) else payload.get("lines", [])
    if not isinstance(entries, list):
        raise RuntimeError("Timing hints file must contain a list or a top-level lines list.")

    text_to_indexes: dict[str, list[int]] = {}
    for offset, line in enumerate(lines, start=1):
        text_to_indexes.setdefault(normalized_text(line), []).append(offset)

    hints: dict[int, tuple[int, int]] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise RuntimeError("Each timing hint must be an object.")
        if "index" in entry:
            index = int(entry["index"])
        elif "text" in entry:
            matches = text_to_indexes.get(normalized_text(str(entry["text"])), [])
            if len(matches) != 1:
                raise RuntimeError(f"Timing hint text must match exactly one lyric line: {entry['text']}")
            index = matches[0]
        else:
            raise RuntimeError("Timing hint requires index or text.")
        if index < 1 or index > len(lines):
            raise RuntimeError(f"Timing hint index out of range: {index}")
        start = parse_time_ms(entry.get("startMs", entry.get("start")))
        end = parse_time_ms(entry.get("endMs", entry.get("end")))
        if end <= start:
            raise RuntimeError(f"Timing hint end must be after start for line {index}.")
        hints[index] = (start, end)
    return hints


def distribute_segment(lines: list[str], first_index: int, last_index: int, start_ms: int, end_ms: int, tail_ms: int) -> list[TimedLyricLine]:
    count = last_index - first_index + 1
    if count <= 0:
        return []
    span = max(1, end_ms - start_ms)
    slot_ms = span / count
    timed_lines: list[TimedLyricLine] = []
    for offset, index in enumerate(range(first_index, last_index + 1)):
        line_start = round(start_ms + offset * slot_ms)
        natural_end = round(start_ms + (offset + 1) * slot_ms)
        line_end = min(end_ms, max(line_start + 1, natural_end + tail_ms))
        timed_lines.append(TimedLyricLine(index=index, start_ms=line_start, end_ms=line_end, text=lines[index - 1], confidence=0.1))
    return timed_lines


def map_lines(lines: list[str], duration_ms: int, tail_ms: int, hints: dict[int, tuple[int, int]] | None = None) -> list[TimedLyricLine]:
    if not lines:
        raise RuntimeError("Lyrics file has no speakable lines to timestamp.")

    hints = hints or {}
    if not hints:
        return distribute_segment(lines, 1, len(lines), 0, duration_ms, tail_ms)

    timed_by_index: dict[int, TimedLyricLine] = {}
    anchors = sorted(hints.items())
    previous_index = 0
    previous_end = 0
    for index, (start_ms, end_ms) in anchors:
        for line in distribute_segment(lines, previous_index + 1, index - 1, previous_end, start_ms, tail_ms):
            timed_by_index[line.index] = line
        timed_by_index[index] = TimedLyricLine(index=index, start_ms=start_ms, end_ms=end_ms, text=lines[index - 1], confidence=1.0)
        previous_index = index
        previous_end = end_ms
    for line in distribute_segment(lines, previous_index + 1, len(lines), previous_end, duration_ms, tail_ms):
        timed_by_index[line.index] = line
    return [timed_by_index[index] for index in range(1, len(lines) + 1)]


def srt_timestamp(ms: int) -> str:
    hours, remainder = divmod(ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def srt_text(lines: list[TimedLyricLine]) -> str:
    blocks = []
    for line in lines:
        blocks.append(
            "\n".join(
                [
                    str(line.index),
                    f"{srt_timestamp(line.start_ms)} --> {srt_timestamp(line.end_ms)}",
                    line.text,
                ]
            )
        )
    return "\n\n".join(blocks) + "\n"


def write_srt(path: Path, lines: list[TimedLyricLine]) -> None:
    path.write_text(srt_text(lines), encoding="utf-8")


def output_paths(dist: Path, formats: set[str]) -> tuple[Path | None, Path | None]:
    if dist.suffix.lower() == ".json":
        json_path = dist
        srt_path = dist.with_suffix(".srt") if "srt" in formats else None
        return json_path, srt_path

    json_path = dist / "lyrics-timestamp.json" if "json" in formats else None
    srt_path = dist / "lyrics-timestamp.srt" if "srt" in formats else None
    return json_path, srt_path


def main() -> int:
    args = parse_args()
    lyrics_file = Path(args.lyrics_file).expanduser().resolve()
    audio_file = Path(args.audio_file).expanduser().resolve()
    dist = Path(args.dist).expanduser().resolve()
    formats = {item.strip().lower() for item in args.format.split(",") if item.strip()}

    if not lyrics_file.is_file():
        raise RuntimeError(f"Lyrics file not found: {lyrics_file}")
    if not audio_file.is_file():
        raise RuntimeError(f"Audio file not found: {audio_file}")
    if not formats.issubset({"json", "srt"}):
        raise RuntimeError(f"Unsupported output format list: {args.format}")

    duration_ms = audio_duration_ms(audio_file)
    raw_lines = lyric_lines(lyrics_file)
    hints_file = Path(args.timing_hints_file).expanduser().resolve() if args.timing_hints_file else None
    hints = load_timing_hints(hints_file, raw_lines)
    lines = map_lines(raw_lines, duration_ms, args.tail_ms, hints)
    json_path, srt_path = output_paths(dist, formats)

    output_parent = dist.parent if dist.suffix.lower() == ".json" else dist
    output_parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "audioFile": str(audio_file),
        "lyricsFile": str(lyrics_file),
        "durationMs": duration_ms,
        "lineMode": args.line_mode,
        "alignmentMethod": "timing-hints" if hints else "proportional-duration",
        "timingHintsFile": str(hints_file) if hints_file else "",
        "ignoredLineRule": "skip empty and punctuation-only lines",
        "lines": [line.to_json() for line in lines],
    }

    if args.preview:
        preview = {
            "payload": payload,
            "srt": srt_text(lines) if srt_path is not None else "",
            "jsonPath": str(json_path) if json_path is not None else "",
            "srtPath": str(srt_path) if srt_path is not None else "",
        }
        print(json.dumps(preview, indent=2))
        return 0

    if json_path is not None:
        json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {json_path}")

    if srt_path is not None:
        write_srt(srt_path, lines)
        print(f"Wrote {srt_path}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"lyrics-timestamp: {exc}", file=sys.stderr)
        raise SystemExit(1)
