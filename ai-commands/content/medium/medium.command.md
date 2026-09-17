# medium.command

## Purpose

Use `medium` to prepare and verify an unpublished Medium draft from an authorized article. It is a destination
adapter, not the generic writing or permanent-memory command. Never publish, submit, or schedule a post.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active profile and workflow | Yes | Host activation | Must authorize `medium` as a destination command. |
| Profile-owned defaults | Yes | `AI_COMMAND_CONFIG_PATH` | `medium-command-config.v1` and default safety mode. |
| Workflow-owned override | Yes for article preparation | Active workflow destination binding | Explicit config path and archive project reference for that workflow. |
| Article | Yes | Authorized archive or explicit human source | Canonical text, metadata, and assets to prepare. |
| Existing draft URL | When present | Article metadata or human | Reuse the intended draft rather than making a duplicate. |

## Outputs

- Unpublished Medium draft with reviewed title, subtitle, body, links, visuals, and topics.
- Draft URL, selected topics, any unresolved issues, and archive metadata read-back.
- No publication, submission, scheduling, or alteration of an already-published post.

## Entry point and configuration

The active workflow must list `medium` in its commands and destination bindings. Resolve the profile-owned
`commands[].config` for profile-wide defaults and the active `destinations[].config` for the workflow-specific
override. Both paths are relative to the selected profile root; do not use committed examples as operational
configuration. Profile-wide defaults:

```yaml
schema_version: medium-command-config.v1
mode: draft-only
```

Active writing destination's separate config:

```yaml
schema_version: medium-command-config.v1
mode: draft-only
account_profile_url: https://medium.com/@REPLACE_WITH_YOUR_HANDLE
archive_project_ref: path/to/registered/article-project.yml
```

Apply the workflow override only while that exact workflow is active; no other workflow inherits its archive or
account selection. Verify that `archive_project_ref` is one of the active workflow's registered projects and points
to the intended article archive. Require `account_profile_url` to identify the intended Medium account and verify
that the signed-in account's profile link matches it before any draft mutation. Reject missing or conflicting
bindings rather than inferring them from a vault label, cwd, currently open browser tab, display name, or article
draft URL. A publication is a separate destination choice; do not infer one from the account. Configuration is a
routing constraint, not permission to publish.

Read and follow the command-owned [Medium draft skill](skills/medium-draft/SKILL.md) for editor-specific preparation
and verification. Use the selected profile's article archive for durable source and draft metadata. If editor access,
assets, or permissions fail, preserve the archived source and report the unfinished step.
