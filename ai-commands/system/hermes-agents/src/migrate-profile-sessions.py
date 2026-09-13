#!/usr/bin/env python3
"""Rebind profile-following Hermes sessions without deleting their history."""

import argparse
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-db", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--title", default="Bot Chat")
    args = parser.parse_args()

    state_db = Path(args.state_db)
    if not state_db.is_file():
        return

    connection = sqlite3.connect(state_db, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            "SELECT id, model, model_config, billing_base_url FROM sessions WHERE title = ?",
            (args.title,),
        ).fetchall()
        candidates = []
        for row in rows:
            try:
                config = json.loads(row["model_config"] or "{}")
            except (TypeError, json.JSONDecodeError):
                continue
            if config.get("follow_profile_config") is True:
                candidates.append((row, config))

        changes = [
            (row, config)
            for row, config in candidates
            if row["model"] != args.model
            or row["billing_base_url"] != args.base_url
            or config.get("model") != args.model
            or config.get("provider") != args.provider
            or config.get("base_url") != args.base_url
            or config.get("api_mode") != "chat_completions"
        ]
        if not changes:
            return

        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = state_db.with_name(f"{state_db.name}.pre-provider-migration-{stamp}")
        shutil.copy2(state_db, backup)

        connection.execute("BEGIN IMMEDIATE")
        for row, config in changes:
            config.update(
                {
                    "follow_profile_config": True,
                    "model": args.model,
                    "provider": args.provider,
                    "base_url": args.base_url,
                    "api_mode": "chat_completions",
                }
            )
            connection.execute(
                """UPDATE sessions
                   SET model = ?, model_config = ?, billing_base_url = ?,
                       system_prompt = NULL, system_prompt_hash = NULL
                   WHERE id = ?""",
                (args.model, json.dumps(config, separators=(",", ":")), args.base_url, row["id"]),
            )
        connection.commit()
        print(f"Hermes profile-following sessions migrated: {len(changes)}; backup={backup}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
