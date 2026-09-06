# sms.command

## Purpose

Use `sms` to prepare or send an explicitly authorized text message to an exact recipient.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Message, recipient reference, authorization, and profile-owned provider configuration. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Command result | Caller, configured artifact path, or authorized external system | Provider delivery receipt or explicit blocked/failure result. |

#command #ai-command #sms

- send an SMS to the configured phone number (used by workflows/policies, e.g. pomodoro notifications)

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `sms/sms.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `sms/sms.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags



## Implementation

- `sms.command.sh` sends via Twilio (true SMS)
- configuration:
  - env vars (preferred): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - or profile-owned configuration resolved through `AI_COMMAND_CONFIG_PATH`
  - recipient:
    - `--to "<number>"`, or
    - `SMS_DEFAULT_TO`, or
    - the profile config key `user-phone-number: ...`, or
    - an explicit `--recipient-config <path>` file

## Usage

```bash
${AI_COMMANDS_ROOT}/sms/sms.command.sh --message "Pomodoro: 5m left"
${AI_COMMANDS_ROOT}/sms/sms.command.sh --to "+15145551234" --message "Break: 1m left"
${AI_COMMANDS_ROOT}/sms/sms.command.sh --healthcheck
```
