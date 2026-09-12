# Contributing to AI Fleas

AI Fleas is an open working project. Contributions can include code, workflow improvements, harness validation, benchmark results, documentation, or reproducible evidence from hardware/model configurations that are not available to the maintainer.

## Start with an issue

1. Pick an open GitHub Issue that matches something you can reproduce or improve.
2. Read the linked specification, benchmark report, workflow, or role contract.
3. Keep the change focused and preserve portable contracts unless the issue explicitly changes them.
4. Run the relevant deterministic checks and practical/agent acceptance scenario where applicable.
5. Submit a pull request with the result and evidence.

Benchmark and reproduction issues are intentionally self-contained and are a good entry point if you are unsure where to start.

## Choose the correct layer

- Put reusable behavior and deterministic capability contracts in `ai-commands/`.
- Put platform-neutral domain rules, roles, and workflow manifests in `ai-workflows/`.
- Put sanitized profile structure and examples in `ai-profile/`.
- Put public host bindings in `platforms/` only when they implement the adapter contract without private configuration.
- Keep launchers, private profiles, credentials, machine paths, client data, runtime state, and private integrations out of this repository.

The dependency direction is one way: platform implementations consume AI Fleas. Portable rules must not depend on a private platform.

## Contribution shape

Keep each change focused and document the user-facing outcome, authority boundary, inputs, outputs, failure behavior, and observable completion evidence. Executable behavior needs proportionate deterministic tests. Examples must contain placeholders rather than credentials, private identifiers, or real local paths.

Commands that need environment-specific values receive them from the selected profile or ignored local configuration; they must not infer them from a company name, nearby directory, URL, or prior conversation. Workflows describe required behavior and capabilities without prescribing transports, servers, UI frameworks, or provider-specific mechanics.

## Benchmark contributions

Follow [`notes/benchmarks/local-models/methodology.md`](notes/benchmarks/local-models/methodology.md) and update the relevant hardware report when practical.

Include enough information to reproduce the result:

- exact hardware and OS/runtime versions
- exact model and quantization
- configuration/commands and context size
- model and peak memory usage
- prompt-processing and generation throughput
- TTFT and task/request wall time where applicable
- GPU/accelerator utilization where measurable
- Hermes/agent tool-use result where applicable
- limitations or differences from the existing baseline

A clean reproduction on different but comparable hardware is useful; identify the hardware precisely rather than presenting it as the same result.

## Validate before review

Run checks relevant to the changed files. At minimum, workflow changes must pass:

```sh
bash ai-workflows/validate-public-boundary.sh
```

Also run `git diff --check` and the tests owned by every changed command or adapter. For workflow/harness behavior, provide practical acceptance evidence where applicable rather than relying only on implementation or unit tests.

In the pull request, explain:

- what changed
- why
- how it was verified
- any remaining limitation or hardware/runtime dependency

A contribution does not need to solve a large part of the project. A benchmark result, reproduction, documentation correction, or one verified compatibility improvement is useful.
