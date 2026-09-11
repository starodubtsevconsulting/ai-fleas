# Machine Profile

## Purpose

Use `machine-profile` to inspect a local or explicitly selected remote machine and return the same versioned JSON hardware
and operating-system inventory. Other commands may consume this evidence, but machine profiling does not authorize them to
install, remove, or reconfigure anything.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves the private logical-machine catalog. |
| Target | No | Human or profile | `--local`, or a configured remote `--box`; defaults to local. |
| Save choice | No | Human | `--save-profile` refreshes the selected configured box's private inventory snapshot. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| `ai-machine-profile.v1` JSON | Standard output | Stable local/remote machine identity, OS, CPU, memory, storage, GPU, access, and observation metadata. |
| Saved inventory | Private profile | Optional timestamped JSON snapshot referenced by the selected logical box. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `machine-profile/machine-profile.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host verifies workflow authorization and supplies the selected profile-owned machine
catalog as `AI_COMMAND_CONFIG_PATH`.

Committed configuration template: `machine-profile/machine-profile.command.example.config`. Copy it into the selected
profile, reference the copy through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The
committed example is documentation and must never be used as operational configuration.

## Usage

```bash
machine-profile.command.sh --local
machine-profile.command.sh --box <logical-machine> [--save-profile]
```

Inspection is read-only. Saved observations are evidence snapshots, not permanent truth, and should be refreshed before
capacity-sensitive work. Passwords, private keys, tokens and credential contents are never included.

## Tags

`#command` `#machine` `#profile` `#inventory` `#hardware` `#cpu` `#gpu` `#ssh`
