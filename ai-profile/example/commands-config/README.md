# Example profile-wide command configuration

> **EXAMPLE ONLY:** Files in this directory are intentionally committed to demonstrate complete configuration shapes.
> They are fictional and non-operational. Copy the required shape into a real AI Profile, populate it locally, and keep
> the operational file ignored by Git.

Reusable command definitions live in the monorepo `ai-commands/` catalog. This `commands-config/` folder contains only profile-owned configuration selected by an explicit `commands[].config` reference. The different name is intentional: profile configuration is not a command definition.

The source-control example binds the provider-neutral `source-control` command to the reusable `git` provider command. Authentication and the populated Git identity remain local.

## Secret-service example

The example profile binds `secrets` to [`secrets/config.example.yml`](secrets/config.example.yml). That file selects `provider: infisical`; the profile has no second provider setting. Its fictional `dev` mapping shows the complete route:

```text
Cloudflare command needs EXAMPLE_CLOUDFLARE_API_TOKEN
  -> secrets command maps it to example.dev.integration.api-token
  -> Infisical dev /example/integrations, key api_token
  -> value is passed only to the Cloudflare child process
```

The Cloudflare target configuration names the same `EXAMPLE_CLOUDFLARE_API_TOKEN` variable through `CLOUDFLARE_API_TOKEN_ENV`. It must not assign a token value itself. Both `secrets` and `cloudflare` appear in `dev.workflow.md`'s command permissions. An activated workflow can validate the secrets configuration, check provider access, and run the read-only consumer check with `secrets validate`, `secrets status`, and `secrets run cloudflare -- token-check`. The runner must supply the selected profile, workflow, commands root, and secrets config as its profile-aware context; see the [secrets command contract](../../../ai-commands/connect/secrets/secrets.command.md).

To reproduce this with a private profile, create an Infisical project and `dev` environment, put the actual API token at the configured path and key, grant a machine identity only the reads it needs, and replace the fictional endpoint, project ID, and paths in the private config. Keep Universal Auth credentials in the owner-only `bootstrap_file` (`INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET`). If Cloudflare Access protects the endpoint, keep its service-token pair in a separate owner-only `access_bootstrap_file`. Neither file belongs in Git. Back up existing local credentials to an encrypted, access-controlled location and verify recovery before migration. Remove a local credential assignment only after the secret-backed consumer check succeeds; retain the backup until the normal command path has been verified.

For a profile with no secret service, point its `secrets` binding to [`secrets/config.none.example.yml`](secrets/config.none.example.yml), which contains only `provider: none`. Validation succeeds, while provider status and secret-backed runs stop with `PROVIDER_DISABLED`; no plaintext fallback occurs. If no workflow needs the secrets command, remove its binding and workflow permission instead. Keep consumer commands out of the workflow until they have another authorized credential route.

The `hermes-agents/config.yml` file demonstrates a realistic but non-operational Hermes Agents binding. The provider
catalog uses recognizable hardware classes to show that a provider identifies the serving host rather than one temporary
workload; its endpoints remain documentation-only addresses and contain no operational host information. The selected
profile still resolves the actual command catalog through `ai_commands_root`; `${AI_COMMANDS_ROOT}` is not replaced with
a machine path in committed examples.

The `install/config.yml` file demonstrates a reusable SSH alias, model-storage volume, pinned preset selection, and a
machine-inventory reference. Its companion inventory uses realistic capacity and GPU values, but its identity and network
target are reserved documentation values. Refresh an operational inventory with the `machine-profile` command rather than
editing observed values by hand.

Copy the structure into a private operational profile and replace only supported values. Keep credentials, private network endpoints, installation paths, and host-specific adapter mechanics out of this public example.

The `lodgify/config.example.env` template also belongs to the profile layer. Copy it to an ignored operational profile, populate it there, and pass the resolved path as `AI_COMMAND_CONFIG_PATH` or `LODGIFY_CONFIG_PATH`. Never place the populated file in `ai-commands/lodgify/`.
