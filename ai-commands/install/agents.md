# Install command AI context

This file extends the common [`ai-commands/agents.md`](../agents.md) contract for the top-level `install` command.

The System agent must load and follow the common command-agent contract first. Everything below is additional install-specific context. If a rule here conflicts with the common contract, the stricter authority, confirmation, validation, or safety rule applies.

This file does not create a new agent. The active profile/platform System agent remains the agent identity and temporarily enters the `install` command scope.

## Initialization

When `install` is AI-powered, System must additionally load:

1. `install.command.md` — authoritative install command contract and authority boundary.
2. `install.command.yml` — AI execution declaration.
3. The active AI Profile, selected platform binding, and resolved profile-owned command configuration.
4. The available child install commands under `ai-commands/install/` and only the child contracts relevant to the requested target.

System should inspect current installation state before proposing mutation when the command supports a status or check operation.

## Install-specific behavior

System is the interactive orchestration and recovery layer for the install command. Deterministic child commands remain the mechanics that perform actual installation work.

System may:

- resolve installation wording and aliases to the exact child install command;
- explain available install/status/update/uninstall choices;
- inspect profile/platform context needed by the selected install target;
- invoke deterministic install child commands through the command runtime;
- choose another already-authorized install subcommand or recovery step when the contract defines it as the correct recovery path;
- guide the human through installation-specific manual actions;
- report the actual deterministic command result and any material recovery performed.

System must:

- keep `install.command.md` as the install-specific authority boundary;
- use child install commands as deterministic mechanics rather than creating separate AI agents for them;
- load only the context needed for the selected install target;
- preserve profile scope and platform scope throughout the invocation;
- never claim a fix or successful installation until the deterministic validation/smoke test succeeds;
- stop and report unsupported AI-command execution while `install.command.yml` remains `ai.powered: false` or while the AI command runtime is unavailable.

## Install-specific recovery

In addition to the common recovery rules, install recovery may include fixing command-authorized local prerequisites, correcting generated command-scoped state, re-running idempotent setup, selecting an appropriate deterministic install subcommand, or adapting execution to observed environment state when `install.command.md` permits it.

Self-recovery does not authorize arbitrary machine changes. Anything destructive, security-sensitive, externally consequential, credential-related, or otherwise confirmation-gated remains subject to the same command rules and human authorization as deterministic execution.

## Restrictions

System must not:

- silently substitute another install target or implementation;
- treat a child install command as independently AI-powered;
- modify profile, platform, workflow, or provider configuration unless the selected install contract explicitly authorizes that change;
- perform unrelated product, development, review, ticket, or workflow-agent work while in install scope.

## Completion

After the requested install operation finishes, System reports the final state, including any recovery steps that materially changed execution, and exits the temporary `install` command scope. The System agent itself remains the persistent System agent for the active `(profile, platform)` binding.
