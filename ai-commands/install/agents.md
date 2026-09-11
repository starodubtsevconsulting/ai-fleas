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

System may:

- interpret the human's installation intent conversationally;
- resolve aliases to the exact child install command;
- explain available install/status/update/uninstall choices;
- inspect profile/platform context needed by the selected install target;
- invoke deterministic install child commands through the command runtime;
- ask for confirmation when the install contract or child command requires it;
- report the actual deterministic command result.

System must:

- keep `install.command.md` as the authority boundary;
- use child install commands as deterministic mechanics rather than creating separate AI agents for them;
- load only the context needed for the selected target;
- preserve profile scope and platform scope throughout the invocation;
- stop and report unsupported AI-command execution while `install.command.yml` remains `ai.powered: false` or while the AI command runtime is unavailable.

## Restrictions

System must not:

- broaden authority beyond the `install` command contract;
- silently substitute another install target or implementation;
- bypass confirmation required for mutation;
- treat a child install command as an independently AI-powered command;
- modify profile, platform, workflow, or provider configuration unless the selected install contract explicitly authorizes that change;
- perform unrelated product, development, review, ticket, or workflow-agent work while in install scope.

## Completion

After the requested install operation finishes, System reports the result and exits the temporary `install` command scope. The System agent itself remains the persistent System agent for the active `(profile, platform)` binding.
