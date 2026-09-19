# Install

AI commands for the initial installation and minimum generic bootstrap of software, operating systems, and connected
devices.

An installer stops when the selected capability is present, starts successfully, and passes its bounded smoke test. It
does not apply personal, client, profile, workflow, project, use-case, data-access, or ongoing operating configuration.
That tuning belongs to the capability's normal command under `connect`, `data`, `system`, or another appropriate category.

Each installation target lives under this category as its own command package.

## Commands

- [`grapheneos`](grapheneos/) — install and verify GrapheneOS on a supported connected Pixel. Currently draft/placeholder.
- [`chatgpt`](chatgpt/chatgpt.command.md) — physical ChatGPT desktop application lifecycle through the trusted host installer and update channel.
- [`hermes`](hermes/hermes.command.md) — physical Hermes application lifecycle through the reviewed public Hermes installer.
- [`infisical`](infisical/infisical.command.md) — package-owned Infisical stack installation and verification.
- [`infisical-smtp`](infisical-smtp/infisical-smtp.command.md) — narrow SMTP overlay reconciliation for an explicitly selected existing Infisical Compose stack.
- `codex` — Codex CLI only; it is distinct from the `chatgpt` desktop application command.

Use the canonical command IDs in configuration. Human requests may say “GPT” or “ChatGPT,” which resolve to `chatgpt`;
“Hermes” resolves to `hermes`. Agent, bot, workflow, group, and project lifecycle stays in the
corresponding platform command.
