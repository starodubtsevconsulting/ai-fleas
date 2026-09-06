# Install

AI commands for installing and provisioning software, operating systems, and connected devices.

Each installation target lives under this category as its own command package.

## Commands

- [`grapheneos`](grapheneos/) — install and verify GrapheneOS on a supported connected Pixel. Currently draft/placeholder.
- `gpt-app` — physical GPT/ChatGPT desktop application lifecycle through the trusted host installer and update channel.
- `hermes-app` — physical Hermes application lifecycle through the reviewed public Hermes installer.
- `codex` — Codex CLI only; it is distinct from `gpt-app`.

Use the canonical IDs in configuration. Human requests may say “GPT” or “Hermes,” which resolve to `gpt-app` and
`hermes-app` respectively. Agent, bot, workflow, group, and project lifecycle stays in the corresponding platform command.
