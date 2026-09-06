# worktree-bash

## Purpose

Use `worktree-bash` to execute a bounded shell operation in an explicitly selected Git worktree.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Authorized repository command, exact working directory, and workflow context. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Captured shell exit status, output, and resulting repository state. |

Execution route: `command-runner`.

Run a supplied command only from the current resolved Git worktree through the
macOS sandbox backend. The implementation denies network, clears inherited
environment variables, disables shell startup files, fixes the working
directory to the worktree, and permits filesystem writes only below that
worktree plus the required `/dev/null` device. Each invocation receives an
ephemeral command-owned home/temp/cache directory under the operating-system
temporary root and removes it on exit.
Reads required to execute system tools remain available. If the
confinement backend is unavailable, return BLOCKED; never run the payload
without it.

Standard tools receive read-only system-introspection access. The sanitized
PATH may add only the resolved trusted Node toolchain directory
(`/opt/homebrew/bin`, `/usr/local/bin`, or `/usr/bin`) so registered Node/npm
build and test commands can run. This does not grant process control, network
access, or additional filesystem writes.

Local Unix-domain socket binding is allowed only inside the invocation's
ephemeral `TMPDIR`, enabling tools such as `tsx`; TCP and all other network
access remain denied.

Usage: `worktree-bash [--dry-run] [--allow-destructive] [--project-root <path>] -- <bash command> [args...]`.

Run `worktree-bash --self-test` through the registered command entrypoint. The
self-test launches independent sandbox instances; never invoke it as a payload
inside another worktree-bash sandbox because macOS forbids nested sandbox
application.

Rules:

- `worktree-bash` is the registered general fallback for an exact bounded local
  worktree operation when no dedicated command covers it. Prefer a dedicated
  command when one exists; do not create a new command merely to run a safe
  local operation such as `git diff --check`.
- The caller must provide the exact argument vector, worktree purpose, expected
  result, and any cleanup or destructive authorization. This does not permit
  open-ended shell scripts, network access, source editing, or UI acceptance.
- Pass the command and arguments after `--`; do not evaluate them before this
  command receives them.
- `--dry-run` prints the resolved worktree and escaped payload without running
  it.
- `--project-root` adds exactly `<path>/.ai-workflow-suite/**` as a writable
  project-state area. It does not make other files in that project writable.
  The project root must already be an existing, safe directory.
- Recursive deletion and repository-reset/clean payloads are rejected by
  default. `--allow-destructive` may be used only when the exact destructive
  operation and target were explicitly authorized by the caller. Sandbox
  confinement still applies.
- A payload failure returns exit 70. Invalid input returns 64. Missing sandbox
  enforcement returns 69 and `BLOCKED`.
- Do not use this command to access paths, services, or networks outside the
  repository merely because a shell program can name them.

Examples:

```bash
bash worktree-bash/worktree-bash.command.sh -- git status --short
bash worktree-bash/worktree-bash.command.sh -- git diff --check
bash worktree-bash/worktree-bash.command.sh --dry-run -- npm test
bash worktree-bash/worktree-bash.command.sh -- /bin/bash -c 'printf ok > build-proof.txt'
bash worktree-bash/worktree-bash.command.sh --project-root /path/to/project -- /bin/bash -c 'mkdir -p /path/to/project/.ai-workflow-suite'
```

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `worktree-bash/worktree-bash.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `worktree-bash/worktree-bash.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.
