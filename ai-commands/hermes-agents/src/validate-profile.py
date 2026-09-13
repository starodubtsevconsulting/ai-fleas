#!/usr/bin/env python3
"""Validate one resolved Hermes profile before any mutation."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlparse


SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
SAFE_MODEL = re.compile(r"^[A-Za-z0-9._:/+-]+$")
SAFE_COMMANDS = re.compile(r"^[a-z0-9][a-z0-9_-]*(,[a-z0-9][a-z0-9_-]*)*$")


def fail(code: str, detail: str, status: int = 2) -> "None":
    print(f"{code}: {detail}", file=sys.stderr, flush=True)
    raise SystemExit(status)


def require_file(value: str, label: str, profile: str) -> None:
    if value and (not Path(value).is_absolute() or not Path(value).is_file()):
        fail("HERMES_CONTRACT_UNAVAILABLE", f"profile={profile}; {label} is not a readable absolute file: {value}")


def validate_static(environment: dict[str, str]) -> tuple[str, str, str, str, str]:
    profile = environment.get("HERMES_PROFILE", "")
    provider = environment.get("HERMES_PROVIDER_ID", "")
    model = environment.get("HERMES_MODEL", "")
    endpoint = environment.get("HERMES_ENDPOINT", "")
    workspace = environment.get("HERMES_WORKSPACE", "")
    group = environment.get("HERMES_GROUP", "")
    scope = environment.get("HERMES_SCOPE", "workflow")

    if not SAFE_ID.fullmatch(profile):
        fail("HERMES_INVALID_INPUT", f"unsafe or empty profile ID: {profile or '<empty>'}")
    if not SAFE_ID.fullmatch(provider):
        fail("HERMES_INVALID_INPUT", f"profile={profile}; unsafe or empty provider ID: {provider or '<empty>'}")
    if not SAFE_MODEL.fullmatch(model):
        fail("HERMES_INVALID_INPUT", f"profile={profile} provider={provider}; unsafe or empty model ID: {model or '<empty>'}")
    parsed = urlparse(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or any(character.isspace() for character in endpoint):
        fail("HERMES_INVALID_INPUT", f"profile={profile}; endpoint must be an HTTP(S) URL without whitespace")
    if not Path(workspace).is_absolute() or not Path(workspace).is_dir():
        fail("HERMES_WORKSPACE_UNAVAILABLE", f"profile={profile}; workspace is not an existing absolute directory: {workspace}")
    if group and not SAFE_ID.fullmatch(group):
        fail("HERMES_INVALID_INPUT", f"profile={profile}; unsafe group ID: {group}")

    if scope == "system":
        require_file(environment.get("HERMES_SYSTEM_ROLE_PATH", ""), "system role contract", profile)
        require_file(environment.get("HERMES_SYSTEM_SCHEDULE_PATH", ""), "system schedule contract", profile)
        if not environment.get("HERMES_SYSTEM_ROLE_PATH") or not environment.get("HERMES_SYSTEM_SCHEDULE_PATH"):
            fail("HERMES_CONTRACT_UNAVAILABLE", f"profile={profile}; system role and schedule contracts are required")
    else:
        require_file(environment.get("HERMES_ROLE_INSTRUCTIONS_PATH", ""), "role contract", profile)
        require_file(environment.get("HERMES_FLOW_INSTRUCTIONS_PATH", ""), "flow contract", profile)
        require_file(environment.get("HERMES_AGENT_INSTRUCTIONS_PATH", ""), "agent instructions", profile)
        commands_root = environment.get("HERMES_AI_COMMANDS_ROOT", "")
        workflow_contract = environment.get("HERMES_WORKFLOW_INSTRUCTIONS_PATH", "")
        command_ids = environment.get("HERMES_WORKFLOW_COMMAND_IDS", "")
        if any((commands_root, workflow_contract, command_ids)):
            if not Path(commands_root).is_absolute() or not Path(commands_root).is_dir():
                fail("HERMES_CONTRACT_UNAVAILABLE", f"profile={profile}; AI commands root is not a readable absolute directory: {commands_root}")
            require_file(workflow_contract, "workflow contract", profile)
            if not workflow_contract:
                fail("HERMES_CONTRACT_UNAVAILABLE", f"profile={profile}; workflow contract is required")
            if not SAFE_COMMANDS.fullmatch(command_ids):
                fail("HERMES_INVALID_INPUT", f"profile={profile}; workflow command IDs are missing or unsafe: {command_ids}")

    hermes_bin = Path(environment.get("HERMES_BIN", ""))
    if not hermes_bin.is_file() or not os.access(hermes_bin, os.X_OK):
        fail("HERMES_RUNTIME_UNAVAILABLE", f"profile={profile}; Hermes CLI is not executable: {hermes_bin}", 1)
    if group:
        configurator = Path(environment.get("HERMES_GROUP_CONFIGURATOR", ""))
        if not configurator.is_file():
            fail("HERMES_RUNTIME_UNAVAILABLE", f"profile={profile}; group configurator was not found: {configurator}", 1)
        hermes_python = Path(environment.get("HERMES_EFFECTIVE_PYTHON_BIN", ""))
        if not hermes_python.is_file() or not os.access(hermes_python, os.X_OK):
            fail("HERMES_RUNTIME_UNAVAILABLE", f"profile={profile}; Hermes Python runtime is not executable: {hermes_python}", 1)
    return profile, provider, model, endpoint, workspace


def validate_model(profile: str, provider: str, model: str, endpoint: str) -> None:
    models_url = f"{endpoint.rstrip('/')}/models"
    result = subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--connect-timeout", "3", "--max-time", "10", models_url],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        failure = {
            6: "DNS resolution failed",
            7: "connection failed",
            22: "model-list endpoint returned an HTTP error",
            28: "connection or response timed out",
        }.get(result.returncode, f"curl failed with exit code {result.returncode}")
        detail = result.stderr.strip().replace("\n", " ")
        suffix = f": {detail}" if detail else ""
        fail(
            "HERMES_MODEL_TARGET_UNREACHABLE",
            f"profile={profile} provider={provider} model={model} url={models_url}; {failure}{suffix}; no profile changes were made.",
            1,
        )
    try:
        payload = json.loads(result.stdout)
    except Exception as error:
        fail(
            "HERMES_MODEL_LIST_INVALID",
            f"profile={profile} provider={provider}; endpoint did not return a valid JSON model list: {error}",
            1,
        )
    if not isinstance(payload, dict):
        fail("HERMES_MODEL_LIST_INVALID", f"profile={profile} provider={provider}; model list root must be an object", 1)
    available = {
        str(item.get("id") or item.get("model") or item.get("name") or "")
        for collection in (payload.get("data", []), payload.get("models", []))
        if isinstance(collection, list)
        for item in collection
        if isinstance(item, dict)
    }
    if model not in available:
        advertised = ",".join(sorted(item for item in available if item)) or "none"
        fail(
            "HERMES_MODEL_NOT_ADVERTISED",
            f"profile={profile} provider={provider} model={model}; advertised={advertised}; no profile changes were made.",
            1,
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    profile, provider, model, endpoint, _ = validate_static(dict(os.environ))
    validate_model(profile, provider, model, endpoint)
    if not args.quiet:
        print(f"HERMES_MODEL_TARGET_READY: profile={profile} provider={provider} model={model}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
