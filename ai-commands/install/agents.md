# Install command AI context

This file defines how the existing System agent prepares itself when the top-level `install` command is invoked in AI-powered mode.

It does not create a new agent. The active profile/platform System agent remains the agent identity and temporarily enters the `install` command scope.

## Initialization

When `install` is AI-powered, System must load:

1. `install.command.md` — authoritative command contract and authority boundary.
2. `install.command.yml` — AI execution declaration.
3. The active AI Profile, selected platform binding, and resolved profile-owned command configuration.
4. The available child install commands under `ai-commands/install/` and only the child contracts relevant to the requested target.

System should inspect current installation state before proposing mutation when the command supports a status or check operation.

## Behavior

System is the interactive orchestration and recovery layer for the install command. Deterministic child commands remain the mechanics that perform actual installation work.

System may:

- interpret the human's installation intent conversationally;
- resolve aliases to the exact child install command;
- explain available install/status/update/uninstall choices;
- inspect profile/platform context needed by the selected install target;
- invoke deterministic install child commands through the command runtime;
- inspect command output, exit status, logs, and other command-authorized evidence when an operation fails;
- diagnose likely installation failures from that evidence;
- guide the human through required manual actions when automation cannot safely complete them;
- retry safe and idempotent operations when the failure has been understood and the retry remains within command authority;
- choose another already-authorized subcommand or recovery step when the contract defines it as the correct recovery path;
- ask for confirmation when the install contract or child command requires it;
- report the actual deterministic command result and any recovery performed.

System must:

- keep `install.command.md` as the authority boundary;
- use child install commands as deterministic mechanics rather than creating separate AI agents for them;
- load only the context needed for the selected target;
- preserve profile scope and platform scope throughout the invocation;
- treat errors as input for diagnosis and recovery rather than immediately abandoning the installation;
- distinguish safe self-recovery from operations that require explicit human authorization;
- never claim a fix or successful installation until the deterministic validation/smoke test succeeds;
- stop and report unsupported AI-command execution while `install.command.yml` remains `ai.powered: false` or while the AI command runtime is unavailable.

## Error handling and recovery

When a deterministic install step fails, System should:

1. Capture the concrete failure evidence available to the command.
2. Explain the failure briefly in terms relevant to the requested installation.
3. Determine whether the next step is a safe automatic recovery, a deterministic diagnostic subcommand, or a human action/confirmation.
4. Apply the smallest authorized recovery step.
5. Re-run the relevant validation rather than assuming the recovery worked.
6. Continue the installation when validation passes, or report the remaining blocker with useful guidance when it cannot proceed safely.

Self-recovery may include fixing command-authorized local prerequisites, correcting generated command-scoped state, re-running idempotent setup, selecting an appropriate deterministic subcommand, or adapting execution to observed environment state when the command contract permits it.

Self-recovery does not authorize arbitrary machine changes. Anything destructive, security-sensitive, externally consequential, credential-related, or otherwise confirmation-gated remains subject to the same command rules and human authorization as deterministic execution.

## Restrictions

System must not:

- broaden authority beyond the `install` command contract;
- silently substitute another install target or implementation;
- bypass confirmation required for mutation;
- treat a child install command as an independently AI-powered command;
- modify profile, platform, workflow, or provider configuration unless the selected install contract explicitly authorizes that change;
- hide failed attempts, fabricate successful recovery, or suppress useful failure evidence;
- perform unrelated product, development, review, ticket, or workflow-agent work while in install scope.

## Completion

After the requested install operation finishes, System reports the final state, including any recovery steps that materially changed execution, and exits the temporary `install` command scope. The System agent itself remains the persistent System agent for the active `(profile, platform)` binding.
