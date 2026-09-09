#!/usr/bin/env python3
"""Atomically record one exact Hermes workflow-group lifecycle receipt."""
from __future__ import annotations
import argparse
import base64
import json
import os
import tempfile
from pathlib import Path
import yaml

parser = argparse.ArgumentParser()
parser.add_argument("--path", required=True, type=Path)
parser.add_argument("--group", required=True)
parser.add_argument("--profile", action="append", default=[])
parser.add_argument("--project-scope", required=True)
args = parser.parse_args()
projects = json.loads(base64.b64decode(args.project_scope, validate=True))
if not isinstance(projects, list) or not projects or not args.profile:
    raise SystemExit("Hermes workflow receipt requires projects and profiles")
args.path.parent.mkdir(parents=True, exist_ok=True)
document = yaml.safe_load(args.path.read_text(encoding="utf-8")) if args.path.is_file() else {}
document = document or {}
if not isinstance(document, dict) or document.get("schema_version") not in (None, "hermes-agents-binding-state.v1"):
    raise SystemExit("Existing Hermes binding registry has an incompatible schema")
document["schema_version"] = "hermes-agents-binding-state.v1"
groups = document.setdefault("workflow_groups", {})
groups[args.group] = {
    "logical_project_id": args.group,
    "group_id": args.group,
    "projects": projects,
    "profiles": list(dict.fromkeys(args.profile)),
    "readiness": "ready",
}
fd, temporary = tempfile.mkstemp(prefix=".bindings.yml.", dir=args.path.parent)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        yaml.safe_dump(document, stream, sort_keys=False, allow_unicode=True)
        stream.flush(); os.fsync(stream.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, args.path)
finally:
    if os.path.exists(temporary): os.unlink(temporary)
