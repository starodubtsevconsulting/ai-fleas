#!/usr/bin/env python3
"""Evaluate a configured semantic input moderator without retaining prompt text."""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from pathlib import Path

from generation_policy import load_generation_policy
from policy_moderation import PolicyDecisionError, SemanticModerator, SemanticPolicy


async def evaluate(args: argparse.Namespace) -> int:
    policy = load_generation_policy(args.policy, args.policy_dir)
    moderator = SemanticModerator(
        SemanticPolicy(policy.id, policy.policy_ids, policy.semantic_instructions, policy.refusal),
        args.endpoint,
        input_enabled=True,
        output_enabled=False,
        timeout_seconds=args.timeout,
        auth_token_file=args.auth_token_file,
    )
    cases = json.loads(args.cases.read_text(encoding="utf-8"))
    results = []
    for case in cases:
        started = time.perf_counter()
        unavailable = False
        reason_code = "policy_allow"
        try:
            await moderator.check_input(case["prompt"])
            actual = "allow"
        except PolicyDecisionError as error:
            actual = "error" if error.unavailable else "deny"
            unavailable = error.unavailable
            reason_code = error.reason_code
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        results.append(
            {
                "id": case["id"],
                "language": case["language"],
                "kind": case["kind"],
                "expected": case["expected"],
                "actual": actual,
                "reason_code": reason_code,
                "latency_ms": elapsed_ms,
                "passed": actual == case["expected"],
                "unavailable": unavailable,
            }
        )
    latencies = [result["latency_ms"] for result in results]
    report = {
        "schema_version": 1,
        "profile_id": policy.id,
        "case_count": len(results),
        "passed": sum(result["passed"] for result in results),
        "failed": sum(not result["passed"] for result in results),
        "latency_ms": {
            "median": round(statistics.median(latencies), 2) if latencies else 0,
            "maximum": max(latencies, default=0),
        },
        "results": results,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["failed"] == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--policy", default="education-child")
    parser.add_argument("--policy-dir", type=Path, default=Path(__file__).parent / "policies")
    parser.add_argument("--cases", type=Path, default=Path(__file__).parent / "moderation-cases.json")
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--auth-token-file", default="")
    return asyncio.run(evaluate(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
