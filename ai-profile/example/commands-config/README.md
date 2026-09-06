# Example profile-wide command configuration

> **EXAMPLE ONLY:** Files in this directory are intentionally committed to demonstrate complete configuration shapes.
> They are fictional and non-operational. Copy the required shape into a real AI Profile, populate it locally, and keep
> the operational file ignored by Git.

Reusable command definitions live in the monorepo `ai-commands/` catalog. This `commands-config/` folder contains only profile-owned configuration selected by an explicit `commands[].config` reference. The different name is intentional: profile configuration is not a command definition.

The source-control example binds the provider-neutral `source-control` command to the reusable `git` provider command. Authentication and the populated Git identity remain local.

The `hermes-app/config.yml` file demonstrates a realistic but non-operational Hermes App binding. Its provider, model, endpoint, profile name, and context settings are intentionally generic. The selected profile still resolves the actual command catalog through `ai_commands_root`; `${AI_COMMANDS_ROOT}` is not replaced with a machine path in committed examples.

Copy the structure into a private operational profile and replace only supported values. Keep credentials, private network endpoints, installation paths, and host-specific adapter mechanics out of this public example.

The `lodgify/config.example.env` template also belongs to the profile layer. Copy it to an ignored operational profile, populate it there, and pass the resolved path as `AI_COMMAND_CONFIG_PATH` or `LODGIFY_CONFIG_PATH`. Never place the populated file in `ai-commands/lodgify/`.
