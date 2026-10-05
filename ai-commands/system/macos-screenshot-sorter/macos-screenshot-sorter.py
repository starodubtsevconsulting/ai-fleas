#!/usr/bin/env python3
"""Sort macOS screenshots into capture-date folders without overwriting files.

Called by macos-screenshot-sorter.command.sh, directly by its macOS LaunchAgent, and by the
deterministic command test. Inputs are a source and destination directory; output
is one JSON line per processed item. The program only moves regular files whose
names match Apple's Screenshot/Screen Shot conventions. It has no lifecycle
effects: LaunchAgent installation and removal are handled by the shell command.
"""

import argparse
import datetime as dt
import errno
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".heic", ".webp", ".tif", ".tiff"}
SCREENSHOT_NAME = re.compile(r"^(?:Screenshot|Screen Shot)(?:[ _-]|$)", re.IGNORECASE)
DATE_IN_NAME = re.compile(r"^(?:Screenshot|Screen Shot)[ _-]+(\d{4}-\d{2}-\d{2})(?:[ _-]|$)", re.IGNORECASE)


def capture_day(path: Path) -> str:
    match = DATE_IN_NAME.match(path.name)
    if match:
        try:
            return dt.date.fromisoformat(match.group(1)).isoformat()
        except ValueError:
            pass
    stat = path.stat()
    timestamp = getattr(stat, "st_birthtime", stat.st_mtime)
    return dt.datetime.fromtimestamp(timestamp).date().isoformat()


def is_screenshot(path: Path) -> bool:
    return path.is_file() and not path.is_symlink() and path.suffix.lower() in IMAGE_SUFFIXES and bool(SCREENSHOT_NAME.match(path.name))


def available_destination(directory: Path, source: Path) -> Path:
    candidate = directory / source.name
    if not candidate.exists():
        return candidate
    stem, suffix = source.stem, source.suffix
    index = 1
    while True:
        candidate = directory / f"{stem} ({index}){suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def move_without_overwrite(source: Path, target: Path) -> None:
    """Move source while reserving target atomically; never replace an existing file."""
    try:
        os.link(source, target)
    except FileExistsError:
        raise
    except OSError as error:
        if error.errno != errno.EXDEV:
            raise
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        destination_fd = os.open(target, flags, 0o600)
        try:
            with os.fdopen(destination_fd, "wb") as output, source.open("rb") as input_file:
                shutil.copyfileobj(input_file, output)
            shutil.copystat(source, target)
        except BaseException:
            try:
                target.unlink()
            except FileNotFoundError:
                pass
            raise
    source.unlink()


def sort_once(source_dir: Path, destination_dir: Path, dry_run: bool) -> int:
    if not source_dir.is_dir():
        raise ValueError(f"source directory does not exist: {source_dir}")
    destination_dir.mkdir(parents=True, exist_ok=True)
    moved = 0
    for source in sorted(source_dir.iterdir(), key=lambda item: item.name.casefold()):
        if not is_screenshot(source):
            continue
        day_directory = destination_dir / capture_day(source)
        day_directory.mkdir(parents=True, exist_ok=True)
        target = available_destination(day_directory, source)
        result = {"source": str(source), "target": str(target), "action": "would-move" if dry_run else "moved"}
        if not dry_run:
            while True:
                try:
                    move_without_overwrite(source, target)
                    break
                except FileExistsError:
                    target = available_destination(day_directory, source)
                    result["target"] = str(target)
            moved += 1
        print(json.dumps(result, sort_keys=True))
    return moved


def main() -> int:
    parser = argparse.ArgumentParser(description="Sort macOS screenshots into YYYY-MM-DD folders.")
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--destination-dir", required=True, type=Path)
    parser.add_argument("--settle-seconds", type=float, default=0, help="Wait before scanning so the capture finishes writing.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.settle_seconds < 0:
        parser.error("--settle-seconds must be non-negative")
    if args.settle_seconds:
        time.sleep(args.settle_seconds)
    try:
        moved = sort_once(args.source_dir.expanduser(), args.destination_dir.expanduser(), args.dry_run)
    except (OSError, ValueError) as error:
        print(f"SCREENSHOT_SORTER_ERROR: {error}", file=sys.stderr)
        return 1
    print(json.dumps({"moved": moved, "status": "ok"}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
