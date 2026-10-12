#!/usr/bin/env python3
"""Read-only optional Hermes compatibility preflight; never starts inference.

Transport metadata is private input. Results deliberately omit URLs, paths and
credentials. An unavailable safe adapter is a blocked observation, not a run.
"""
import argparse
import json
import re
from pathlib import Path


def check(config):
    """Check the installed source contract without importing its runtime.

    Expected private keys: source_root, context_window, output_tokens. Optional
    provider/model/base_url are never echoed or used to contact an endpoint.
    """
    result = {"adapter": "hermes-cli", "status": "blocked", "inference_started": False,
              "native_image_cli": False, "context_window": config.get("context_window"),
              "output_tokens": config.get("output_tokens")}
    context = config.get("context_window")
    output = config.get("output_tokens")
    if (type(context) is not int or type(output) is not int
            or context <= 0 or output <= 0 or output > context):
        return {**result, "reason": "invalid-explicit-context-budget"}
    try:
        source = Path(config["source_root"]).resolve(strict=True)
        parser = (source / "hermes_cli/_parser.py").read_text()
        routing = (source / "hermes_cli/cli_single_query.py").read_text()
        init = (source / "agent/agent_init.py").read_text()
        metadata = (source / "agent/model_metadata.py").read_text()
    except (KeyError, OSError, TypeError):
        return {**result, "reason": "installed-source-contract-unavailable"}
    native = ('add("--image"' in parser and '"image_url"' in routing
              and "decide_image_input_mode" in routing)
    result["native_image_cli"] = native
    floor = re.search(r"^MINIMUM_CONTEXT_LENGTH\s*=\s*([\d_]+)\s*$", metadata, re.M)
    if not native or not floor or "def _enforce_minimum_context" not in init:
        return {**result, "reason": "installed-source-contract-unrecognized"}
    minimum = int(floor.group(1).replace("_", ""))
    result["minimum_context_window"] = minimum
    if context < minimum:
        return {**result, "reason": "context-below-hermes-minimum",
                "detail": "Keep the actual server context; do not inflate metadata or relabel the provider."}
    return {**result, "reason": "isolated-native-image-execution-not-verified",
            "detail": "Native CLI exists, but isolated settings, tools and fallback suppression remain unverified."}


def run(config, prompt, image, runroot):
    """Fail closed until isolation and image routing have runtime evidence.

    Accepts the intended runner interface; reads no financial inputs, writes no
    artifacts and launches no subprocess when compatibility is blocked.
    """
    return check(config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", required=True)
    parser.add_argument("--config", required=True, help="Private inert transport metadata JSON")
    args = parser.parse_args()
    try:
        config = json.loads(Path(args.config).read_text())
        result = check(config) if isinstance(config, dict) else {"status": "blocked", "reason": "invalid-config"}
    except (OSError, ValueError):
        result = {"status": "blocked", "reason": "invalid-config"}
    print(json.dumps(result, sort_keys=True))
