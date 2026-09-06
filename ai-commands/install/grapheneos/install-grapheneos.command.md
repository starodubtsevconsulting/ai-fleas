# Install GrapheneOS

## Purpose

Use `install-grapheneos` to guide and verify an explicitly authorized GrapheneOS installation on a supported device.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Target device, explicit authorization, prerequisites, and active profile. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Installation evidence or an explicit snapshot/blocked result. |

**Status: SNAPSHOT — not runnable until implemented and tested.**

Use `install-grapheneos` to install GrapheneOS on a supported Pixel. For motivation see [`WHY.md`](WHY.md); normative
behavior is defined by [`install-grapheneos.spec.md`](install-grapheneos.spec.md). Because a specification exists,
behavior changes follow [`sdd`](../../sdd/sdd.command.md).

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `install/grapheneos/install-grapheneos.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `install/grapheneos/install-grapheneos.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Interface

```text
install-grapheneos.sh \
  --device <device-id> \
  --backup-confirmed \
  --approve-wipe
```

### Parameters

- `--device <device-id>` — exact target device selected by the caller. The implementation must still verify
model/identity before flashing.
- `--backup-confirmed` — caller asserts that required data has been backed up **or explicitly accepts permanent loss of
any unbacked data**.
- `--approve-wipe` — caller explicitly authorizes the destructive installation operation, including the data wipe
required by bootloader unlocking/initial installation.

`--backup-confirmed` and `--approve-wipe` are intentionally separate. A generic request to continue must never be
interpreted as both assertions.

Missing authorization must produce explicit blocked states such as:

```text
BACKUP_NOT_CONFIRMED
DESTRUCTIVE_OPERATION_NOT_APPROVED
```

The consuming agent/workflow is responsible for obtaining the assertions/authorization through whatever interaction
model it uses. The executable only validates that the required arguments are present before crossing the destructive
boundary.

## Preconditions

- supported Pixel connected through a reliable USB data cable;
- supported bare-metal host;
- current required Android/GrapheneOS tooling available;
- internet access for authoritative release/procedure resolution;
- exact target device selected and verified;
- backup assertion and destructive authorization supplied before any wipe/unlock/flash stage.

Bluetooth, Wi-Fi, or ordinary Android file-transfer pairing are not installation transports.

## Sources

Authoritative:

- [GrapheneOS Web installer](https://grapheneos.org/install/web)
- [GrapheneOS CLI install guide](https://grapheneos.org/install/cli)
- [GrapheneOS GitHub organization](https://github.com/GrapheneOS)
- [GrapheneOS website installer source](https://github.com/GrapheneOS/grapheneos.org/blob/main/static/install/web.html)
- [Android SDK Platform Tools](https://developer.android.com/tools/releases/platform-tools)

Community material may provide troubleshooting context but must never override the current official procedure.

## Execution boundary

The executable is a deterministic capability, not the orchestrating agent. Missing prerequisites must be returned as
explicit blocked/failure states. The consuming workflow/agent decides how to resolve them.

Before destructive execution the implementation must verify the target device, current official procedure/release,
artifact integrity, `--backup-confirmed`, and `--approve-wipe`. It must never guess device identity, bypass security
protections, or report success without verifying the resulting OS and bootloader/security state.

## Suggested agent profile

```yaml
agent_requirements:
  reasoning: high
  autonomy: medium
  tool_use: required
  human_interaction: required
  capabilities:
    - shell
    - web-access
    - structured-failure-handling
    - human-authorization
    - physical-device-coordination
```

## Completion

Complete only when observable evidence confirms the expected GrapheneOS installation and required bootloader/security state.

## Tags

`#command` `#ai-command` `#install` `#android` `#pixel` `#grapheneos` `#privacy` `#device-provisioning` `#sdd`
