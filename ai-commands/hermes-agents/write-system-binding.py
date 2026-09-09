#!/usr/bin/env python3
"""Atomically write the profile-owned Hermes System lifecycle receipt."""
from __future__ import annotations
import argparse
import os
import tempfile
from pathlib import Path
import yaml

parser = argparse.ArgumentParser()
parser.add_argument("--path", required=True, type=Path)
parser.add_argument("--profile", required=True)
parser.add_argument("--title", required=True)
parser.add_argument("--provider", required=True)
parser.add_argument("--model", required=True)
parser.add_argument("--every", required=True)
parser.add_argument("--scheduler-id", required=True)
parser.add_argument("--watch-group", action="append", default=[])
args = parser.parse_args()
args.path.parent.mkdir(parents=True, exist_ok=True)
if args.path.is_file():
    loaded = yaml.safe_load(args.path.read_text(encoding="utf-8")) or {}
    if not isinstance(loaded, dict) or loaded.get("schema_version") not in (None, "hermes-agents-binding-state.v1"):
        raise SystemExit("Existing Hermes binding registry has an incompatible schema")
    document = loaded
else:
    document = {}
document["schema_version"] = "hermes-agents-binding-state.v1"
document["system"] = {
        "profile_id": args.profile,
        "title": args.title,
        "provider": args.provider,
        "model": args.model,
        "scope": "system",
        "groups": [],
        "hidden": False,
        "pinned": True,
        "watch_groups": list(dict.fromkeys(args.watch_group)),
        "scheduler": {
            "id": args.scheduler_id,
            "name": f"{args.profile}-lifecycle-monitor",
            "every": args.every,
            "enabled": True,
        },
}
fd, temporary = tempfile.mkstemp(prefix=".bindings.yml.", dir=args.path.parent)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        yaml.safe_dump(document, stream, sort_keys=False, allow_unicode=True)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, args.path)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
