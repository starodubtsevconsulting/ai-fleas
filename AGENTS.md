# AI Fleas Rules

This repository is the public rules and contracts layer for AI Fleas. Keep all content portable and safe to publish.

## Boundaries

- Reusable commands live in `ai-commands/`.
- Reusable workflow contracts, roles, and governance live in `ai-workflows/`.
- Profile structure, documentation, validation, and sanitized examples live in `ai-profile/`.
- Do not add launcher, UI, backend, real profile, credential, client, private-provider, absolute-path, or runtime-state data.
- AI Fleas Platform may consume this repository. This repository must never depend on AI Fleas Platform.

## Changes

- Preserve command and workflow IDs and validate their focused tests.
- Treat paths and configuration as portable interfaces rather than machine-specific values.
- Reject duplicate command or workflow IDs rather than relying on directory precedence.
