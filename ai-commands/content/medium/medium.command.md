# medium.command

## Purpose

Use `medium` to prepare and verify an unpublished Medium draft from an authorized article. With a separately enabled
`draft-and-schedule` workflow binding, Release Coordinator may schedule an accepted exact revision for a future slot
through Medium's native UI. On an explicit human request, Release Coordinator may also create and verify a Medium
Publication through the separate guarded Publication skill. Never publish immediately or submit a story merely because
a Publication was created.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active profile and workflow | Yes | Host activation | Must authorize `medium` as a destination command. |
| Profile-owned defaults | Yes | `AI_COMMAND_CONFIG_PATH` | `medium-command-config.v1` and default safety mode. |
| Workflow-owned override | Yes | Active workflow destination binding | Explicit config path, mode, account, and archive project reference for that workflow. |
| Article | Yes | Authorized archive or explicit human source | Canonical text, metadata, and assets to prepare. |
| Existing draft URL | When present | Article metadata or human | Reuse the intended draft rather than making a duplicate. |

## Outputs

- Unpublished Medium draft with reviewed title, subtitle, body, links, visuals, and topics.
- Draft URL, selected topics, any unresolved issues, and archive metadata read-back.
- For an enabled Release Coordinator: verified scheduled status, date/time, account, draft URL, and archive read-back.
- For an explicitly requested Publication setup: verified Publication name, URL, owner role, avatar, and description.
- No immediate publication, submission, or alteration of an already-published post.

## Entry point and configuration

The active workflow must list `medium` in its commands and destination bindings. Resolve the profile-owned
`commands[].config` for profile-wide defaults and the active `destinations[].config` for the workflow-specific
override. Both paths are relative to the selected profile root; do not use committed examples as operational
configuration. Profile-wide defaults:

```yaml
schema_version: medium-command-config.v1
mode: draft-only
```

Active writing destination's separate config defaults to draft-only:

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
routing constraint. `draft-and-schedule` is valid only when the active workflow destination also uses that mode and
its release policy explicitly enables `release-coordinator`, requires human acceptance of the exact final article
revision, and states that no separate per-item scheduling approval is required. The profile-wide default remains
`draft-only`; another workflow does not inherit this grant. A cadence target never initiates scheduling by itself.
Neither mode permits immediate publication or submission.

Read and follow the command-owned [Medium draft skill](skills/medium-draft/SKILL.md) for editor-specific preparation
and verification. Use the selected profile's article archive for durable source and draft metadata. If editor access,
assets, or permissions fail, preserve the archived source and report the unfinished step.
For authorized future scheduling, Release Coordinator follows the separate
[Medium schedule skill](skills/medium-schedule/SKILL.md), which includes a desktop navigation map, and verifies
Medium's scheduled state before reporting success.
For explicitly requested Publication creation or configuration, Release Coordinator follows the
[Medium Publication skill](skills/medium-publication/SKILL.md). Publication creation never follows implicitly from
draft preparation, target resolution, or scheduling.
