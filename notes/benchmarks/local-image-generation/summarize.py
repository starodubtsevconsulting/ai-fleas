#!/usr/bin/env python3
"""Summarize image benchmark JSONL records as Markdown."""

from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path


def gib(value):
    return "—" if value is None else f"{value / (1024 ** 3):.1f}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("results", type=Path, nargs="+")
    args = parser.parse_args()
    grouped = defaultdict(list)
    for path in args.results:
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                record = json.loads(line)
                grouped[(record["candidate_id"], record["case_id"])].append(record)

    print("| Candidate | Case | Runs | Median generation | Peak system used | Peak torch reserved |")
    print("|---|---|---:|---:|---:|---:|")
    for (candidate, case), records in sorted(grouped.items()):
        latency = statistics.median(record["generation_seconds"] for record in records)
        system_peak = max(record["generation_peak_system_used_bytes"] for record in records)
        torch_values = [record["torch_peak_reserved_bytes"] for record in records if record["torch_peak_reserved_bytes"] is not None]
        torch_peak = max(torch_values) if torch_values else None
        print(f"| {candidate} | {case} | {len(records)} | {latency:.2f} s | {gib(system_peak)} GiB | {gib(torch_peak)} GiB |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
