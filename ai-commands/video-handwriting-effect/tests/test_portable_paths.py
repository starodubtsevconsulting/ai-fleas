#!/usr/bin/env python3
"""Reject tracked paths that collide on case-insensitive or Unicode-normalizing filesystems."""

from __future__ import annotations

import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def portable_key(path: str) -> str:
  return unicodedata.normalize("NFC", path).casefold()


def main() -> None:
  result = subprocess.run(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    cwd=ROOT,
    check=True,
    capture_output=True,
  )
  groups: dict[str, list[str]] = defaultdict(list)
  for raw_path in result.stdout.decode("utf-8").split("\0"):
    if raw_path and (ROOT / raw_path).exists():
      groups[portable_key(raw_path)].append(raw_path)

  collisions = [paths for paths in groups.values() if len(paths) > 1]
  if collisions:
    formatted = "\n".join(f"  {' <-> '.join(paths)}" for paths in collisions)
    raise AssertionError(
      "Tracked paths collide on case-insensitive or Unicode-normalizing filesystems:\n"
      f"{formatted}"
    )

  print("PASS tracked paths are portable across case-insensitive filesystems")


if __name__ == "__main__":
  try:
    main()
  except Exception as error:
    print(f"FAIL {error}", file=sys.stderr)
    raise
