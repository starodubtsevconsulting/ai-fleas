#!/usr/bin/env python3
"""Realize one resolved Hermes workflow roster with two-phase safety."""

from __future__ import annotations

import argparse
import base64
import os
from pathlib import Path
import subprocess
import sys


ROLE_TITLES = {
    "admin": "Admin",
    "designer-reviewer": "Designer/Reviewer",
    "judge": "Judge",
    "manager": "Manager",
    "coder": "Coder",
    "command-runner": "Command Runner",
    "ui-acceptance-tester": "UI Acceptance Tester",
}


def fail(code: str, detail: str, status: int = 2) -> "None":
    print(f"{code}: {detail}", file=sys.stderr)
    raise SystemExit(status)


def decode(value: str, field: str, role: str) -> str:
    try:
        return base64.b64decode(value, validate=True).decode("utf-8")
    except (ValueError, UnicodeDecodeError) as error:
        fail("HERMES_PROFILE_SCOPE_INVALID", f"role={role}; invalid {field}: {error}")


def parse_bindings(raw: str, group: str) -> list[dict[str, str]]:
    if not raw:
        fail("HERMES_PROFILE_SCOPE_INVALID", f"group={group}; resolved roster is empty")
    bindings: list[dict[str, str]] = []
    profiles: set[str] = set()
    for record in raw.split(","):
        fields = record.split("|")
        if len(fields) != 12:
            fail("HERMES_PROFILE_SCOPE_INVALID", f"group={group}; malformed role binding with {len(fields)} fields")
        (
            role,
            suffix,
            provider,
            provider_label_b64,
            endpoint_b64,
            model,
            context,
            threshold,
            target,
            protect,
            role_path_b64,
            flow_path_b64,
        ) = fields
        if not all((role, suffix, provider, endpoint_b64, model)):
            fail("HERMES_PROFILE_SCOPE_INVALID", f"group={group}; role binding has required empty fields")
        profile = f"{group}-{suffix}"
        if profile in profiles:
            fail("HERMES_PROFILE_SCOPE_INVALID", f"group={group}; duplicate resolved profile={profile}")
        profiles.add(profile)
        bindings.append(
            {
                "role": role,
                "profile": profile,
                "provider": provider,
                "provider_label": decode(provider_label_b64, "provider label", role),
                "endpoint": decode(endpoint_b64, "endpoint", role),
                "model": model,
                "context": context,
                "threshold": threshold,
                "target": target,
                "protect": protect,
                "role_path": decode(role_path_b64, "role path", role),
                "flow_path": decode(flow_path_b64, "flow path", role),
            }
        )
    return bindings


def role_environment(base: dict[str, str], binding: dict[str, str]) -> dict[str, str]:
    environment = base.copy()
    environment.update(
        {
            "HERMES_PROFILE": binding["profile"],
            "HERMES_ROLE": binding["role"],
            "HERMES_ROLE_TITLE": ROLE_TITLES.get(binding["role"], binding["role"]),
            "HERMES_PROVIDER_ID": binding["provider"],
            "HERMES_PROVIDER_LABEL": binding["provider_label"],
            "HERMES_ENDPOINT": binding["endpoint"],
            "HERMES_MODEL": binding["model"],
            "HERMES_CONTEXT_LENGTH": binding["context"],
            "HERMES_COMPRESSION_THRESHOLD": binding["threshold"],
            "HERMES_COMPRESSION_TARGET_RATIO": binding["target"],
            "HERMES_COMPRESSION_PROTECT_LAST_N": binding["protect"],
            "HERMES_ROLE_INSTRUCTIONS_PATH": binding["role_path"],
            "HERMES_FLOW_INSTRUCTIONS_PATH": binding["flow_path"],
        }
    )
    return environment


def run_setup(setup: Path, args: list[str], environment: dict[str, str]) -> int:
    return subprocess.run([str(setup), *args], env=environment, check=False).returncode


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", required=True)
    parser.add_argument("--role-bindings", required=True)
    parser.add_argument("--setup-script", type=Path, required=True)
    parser.add_argument("--binding-writer", type=Path, required=True)
    parser.add_argument("--binding-python", required=True)
    parser.add_argument("--binding-registry", type=Path, required=True)
    parser.add_argument("--project-scope", required=True)
    parser.add_argument("setup_args", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    if not args.setup_script.is_file() or not os.access(args.setup_script, os.X_OK):
        fail("HERMES_RUNTIME_UNAVAILABLE", f"setup script is not executable: {args.setup_script}", 1)
    if not args.binding_writer.is_file():
        fail("HERMES_RUNTIME_UNAVAILABLE", f"binding writer was not found: {args.binding_writer}", 1)

    setup_args = args.setup_args[1:] if args.setup_args[:1] == ["--"] else args.setup_args
    bindings = parse_bindings(args.role_bindings, args.group)
    environments = [(binding, role_environment(dict(os.environ), binding)) for binding in bindings]

    print(f"HERMES_WORKFLOW_PREFLIGHT: group={args.group} agents={len(bindings)}", flush=True)
    failed_profiles: list[str] = []
    for binding, environment in environments:
        status = run_setup(args.setup_script, ["--validate-only"], environment)
        if status:
            failed_profiles.append(binding["profile"])
    if failed_profiles:
        print(
            f"HERMES_WORKFLOW_PREFLIGHT_FAILED: group={args.group} agents={len(bindings)} "
            f"failed_agents={len(failed_profiles)} failed_profiles={','.join(failed_profiles)}; "
            "all provider/model errors are listed above; no workflow profiles were changed.",
            file=sys.stderr,
            flush=True,
        )
        return 1

    completed: list[str] = []
    for binding, environment in environments:
        status = run_setup(args.setup_script, setup_args, environment)
        if status:
            print(
                f"HERMES_WORKFLOW_PARTIAL_FAILURE: group={args.group} "
                f"failed_profile={binding['profile']} "
                f"completed_profiles={','.join(completed) or 'none'}; "
                "binding receipt was not written.",
                file=sys.stderr,
                flush=True,
            )
            return status
        completed.append(binding["profile"])

    writer_command = [
        args.binding_python,
        str(args.binding_writer),
        "--path",
        str(args.binding_registry),
        "--group",
        args.group,
        "--project-scope",
        args.project_scope,
    ]
    for profile in completed:
        writer_command.extend(("--profile", profile))
    writer = subprocess.run(writer_command, check=False)
    if writer.returncode:
        print(
            f"HERMES_WORKFLOW_RECEIPT_FAILED: group={args.group} "
            f"completed_profiles={','.join(completed)}; all profiles were configured but readiness was not recorded.",
            file=sys.stderr,
            flush=True,
        )
        return writer.returncode

    print(
        f"HERMES_WORKFLOW_READY: group={args.group} agents={len(completed)} "
        f"all_agents_ready=true profiles={','.join(completed)} binding={args.binding_registry}",
        flush=True,
    )
    print(
        "HERMES_RUNTIME_NOTE: while Hermes Desktop is open, it may run one local Python backend per active profile; "
        "identify it by the --profile argument.",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
