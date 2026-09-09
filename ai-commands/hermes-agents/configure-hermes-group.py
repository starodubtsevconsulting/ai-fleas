#!/usr/bin/env python3
"""Idempotently realize an AI Fleas workflow group in Hermes profile metadata."""

from __future__ import annotations

import argparse
import fcntl
import os
import re
import tempfile
from pathlib import Path

import yaml


SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


def profile_dir(hermes_home: Path, profile: str) -> Path:
    return hermes_home if profile == "default" else hermes_home / "profiles" / profile


def write_document(path: Path, document: dict) -> None:
    meta_path = path / "profile.yaml"
    fd, temporary = tempfile.mkstemp(prefix=".profile.yaml.", dir=path)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            yaml.safe_dump(document, stream, sort_keys=False, allow_unicode=True)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, meta_path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def update_membership(path: Path, group: str | None, title: str | None) -> None:
    meta_path = path / "profile.yaml"
    if not path.is_dir():
        raise SystemExit(f"Hermes profile directory does not exist: {path}")

    lock_path = path / ".ai-fleas-group.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        document: dict = {}
        if meta_path.is_file():
            loaded = yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}
            if not isinstance(loaded, dict):
                raise SystemExit(f"Hermes profile metadata is not a mapping: {meta_path}")
            document = loaded

        ui_meta = document.setdefault("ui_meta", {})
        if not isinstance(ui_meta, dict):
            raise SystemExit(f"Hermes ui_meta is not a mapping: {meta_path}")
        bot_meta = ui_meta.setdefault("hermes-bots", {})
        if not isinstance(bot_meta, dict):
            raise SystemExit(f"Hermes bot metadata is not a mapping: {meta_path}")

        if group:
            groups = bot_meta.get("groups")
            if not isinstance(groups, list):
                legacy = bot_meta.get("group")
                groups = [legacy] if isinstance(legacy, str) and legacy.strip() else []
            groups = list(dict.fromkeys(str(value).strip() for value in groups if str(value).strip()))
            if group not in groups:
                groups.append(group)
            bot_meta["groups"] = groups
            bot_meta["group"] = groups[0]
        # Hermes renders bots and group chats in one flat roster. Keep role
        # profiles operational inside their groups while making workflow
        # groups the primary top-level navigation.
        bot_meta["hidden"] = True
        bot_meta["pinned"] = False
        if title and not bot_meta.get("title"):
            bot_meta["title"] = title

        revisions = document.setdefault("_ui_meta_revisions", {})
        if not isinstance(revisions, dict):
            revisions = {}
            document["_ui_meta_revisions"] = revisions
        revisions["hermes-bots"] = max(0, int(revisions.get("hermes-bots", 0))) + 1

        write_document(path, document)


def remove_membership(path: Path, group: str) -> None:
    meta_path = path / "profile.yaml"
    if not path.is_dir():
        return
    lock_path = path / ".ai-fleas-group.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        loaded = yaml.safe_load(meta_path.read_text(encoding="utf-8")) if meta_path.is_file() else {}
        document = loaded or {}
        if not isinstance(document, dict):
            raise SystemExit(f"Hermes profile metadata is not a mapping: {meta_path}")
        ui_meta = document.setdefault("ui_meta", {})
        bot_meta = ui_meta.setdefault("hermes-bots", {})
        groups = bot_meta.get("groups", [])
        if not isinstance(groups, list):
            groups = []
        groups = [value for value in groups if value != group]
        bot_meta["groups"] = groups
        legacy = bot_meta.get("group")
        if legacy == group:
            if groups:
                bot_meta["group"] = groups[0]
            else:
                bot_meta.pop("group", None)
        revisions = document.setdefault("_ui_meta_revisions", {})
        revisions["hermes-bots"] = max(0, int(revisions.get("hermes-bots", 0))) + 1
        write_document(path, document)


def restore_group(hermes_home: Path, group: str) -> None:
    """Clear an exact deletion tombstone before intentionally recreating a group."""
    path = profile_dir(hermes_home, "default")
    meta_path = path / "profile.yaml"
    lock_path = path / ".ai-fleas-group.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        loaded = yaml.safe_load(meta_path.read_text(encoding="utf-8")) if meta_path.is_file() else {}
        document = loaded or {}
        ui_meta = document.setdefault("ui_meta", {})
        group_meta = ui_meta.setdefault("hermes-bots-groups", {})
        deleted = group_meta.setdefault("deleted", {})
        tombstone = f"name:{group}"
        if tombstone not in deleted:
            return
        del deleted[tombstone]
        revisions = document.setdefault("_ui_meta_revisions", {})
        revisions["hermes-bots-groups"] = max(
            0, int(revisions.get("hermes-bots-groups", 0)) + 1
        )
        write_document(path, document)


def tombstone_group(hermes_home: Path, group: str) -> None:
    path = profile_dir(hermes_home, "default")
    meta_path = path / "profile.yaml"
    lock_path = path / ".ai-fleas-group.lock"
    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        loaded = yaml.safe_load(meta_path.read_text(encoding="utf-8")) if meta_path.is_file() else {}
        document = loaded or {}
        ui_meta = document.setdefault("ui_meta", {})
        group_meta = ui_meta.setdefault("hermes-bots-groups", {})
        rooms = group_meta.setdefault("rooms", {})
        for key, room in list(rooms.items()):
            if key == f"name:{group}" or (isinstance(room, dict) and room.get("name") == group):
                del rooms[key]
        deleted = group_meta.setdefault("deleted", {})
        revision = max([0, *[int(value) for value in deleted.values() if isinstance(value, int)]]) + 1
        deleted[f"name:{group}"] = revision
        group_meta["version"] = max(3, int(group_meta.get("version", 0)))
        revisions = document.setdefault("_ui_meta_revisions", {})
        revisions["hermes-bots-groups"] = max(
            revision, int(revisions.get("hermes-bots-groups", 0)) + 1
        )
        write_document(path, document)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hermes-home", required=True, type=Path)
    parser.add_argument("--group")
    parser.add_argument("--member", action="append")
    parser.add_argument("--title")
    parser.add_argument("--hide-only", action="store_true")
    parser.add_argument("--delete-group", action="store_true")
    args = parser.parse_args()

    if args.delete_group:
        if not args.group or not args.member:
            raise SystemExit("--delete-group requires --group and at least one --member")
    elif not args.hide_only and not args.group:
        raise SystemExit("--group is required unless --hide-only is used")
    for label, value in (("group", args.group), *(("member", member) for member in args.member or [])):
        if value is None:
            continue
        if not SAFE_ID.fullmatch(value):
            raise SystemExit(f"Unsafe Hermes {label} ID: {value}")
    if args.delete_group:
        for member in args.member:
            remove_membership(profile_dir(args.hermes_home, member), args.group)
        tombstone_group(args.hermes_home, args.group)
        print(f"Hermes group deleted: {args.group}")
        return

    if len(args.member or []) != 1:
        raise SystemExit("exactly one --member is required")
    title = (args.title or "").strip()
    if not title or len(title) > 80 or any(char in title for char in "\r\n\t"):
        raise SystemExit("Hermes member title is empty or unsafe")

    member = args.member[0]
    if not args.hide_only:
        restore_group(args.hermes_home, args.group)
    update_membership(profile_dir(args.hermes_home, member), None if args.hide_only else args.group, title)
    if args.hide_only:
        print(f"Hermes top-level profile hidden: {member}")
    else:
        print(f"Hermes group member ready: {args.group} ({member} as {title})")


if __name__ == "__main__":
    main()
