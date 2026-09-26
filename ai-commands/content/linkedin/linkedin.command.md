# linkedin.command

## Purpose

Use `linkedin` to prepare and verify an unpublished LinkedIn Article through the authenticated browser session. With a separately enabled workflow grant, Release Coordinator may schedule an accepted exact revision through LinkedIn's native UI. Do not require LinkedIn API access.

## Configuration

The active workflow must authorize `linkedin` and bind a workflow-owned config:

```yaml
schema_version: linkedin-command-config.v1
mode: draft-only
surface: article
account_profile_url: https://www.linkedin.com/in/REPLACE
archive_project_ref: path/to/article-project.yml
```

Verify the signed-in profile against `account_profile_url`; never infer identity from an open tab. V1 supports the Article surface, not short feed posts. Reuse an existing draft when identifiable. Browser UI is the provider interface; inspect live labels rather than relying on coordinates.

Follow [LinkedIn article draft](skills/linkedin-article-draft/SKILL.md). Authorized future scheduling follows [LinkedIn article schedule](skills/linkedin-article-schedule/SKILL.md). Neither skill grants immediate publication.
