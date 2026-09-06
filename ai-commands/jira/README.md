# Jira automation

Command contract: [`jira.command.md`](jira.command.md)

Spec: [`spec.md`](spec.md)
Reusable live read-only scenario: [`jira.scenario.md`](jira.scenario.md)

This command performs reusable Jira mechanics using context already resolved by ai-config. Ticket meaning and formatting
remain owned by the active profile and Manager.

For an example, see [EXAMPLE-8336](https://jira.example.invalid/browse/EXAMPLE-8336).

## What it can do

- Create a Jira ticket.
- Clone an existing ticket into a related follow-up.
- Update an existing ticket's description and optional summary.
- Add a comment with Jira-formatted links and user mentions.
- Print the ticket template configured by the active profile.
- Synchronize the active ai-config Flow plan with Jira Smart Checklist, including completed and pending status.
- Move an ai-config-created or operator-owned Jira ticket to In Progress through a guarded, idempotent subcommand.

It intentionally does not support deleting, archiving, or otherwise destructively modifying Jira issues.

When cloning, the command removes Smart Checklist items copied from the source issue before applying the new ticket
description. The source checklist is left unchanged; the new ticket starts with an empty checklist so unrelated
work-plan items are not inherited.

## How it works safely

The command does not use a Jira MCP server, Jira API, GraphQL, or direct database access. It uses the existing
authenticated Chrome window and drives the visible Jira interface, so the operator can see what it is doing.

For existing-ticket updates, it saves before/after snapshots, verifies that the requested summary and description
persisted, and rejects unexpected changes to other editable fields. A successful submitted update also adds a
timestamped Jira comment linking to the [ai-config repository](https://github.example.invalid/example-org/ai-config)
and the [Jira command](https://github.example.invalid/example-org/ai-config/tree/main/ai-commands/jira), so teammates
can identify how the ticket was improved.

ai-config-created comments carry `/created-with-ai-config`. Submitted ticket creation and clone flows add an
ownership-marker comment. The guarded `set-in-progress` operation requires either that marker from the authenticated
user or a matching reporter, and it can transition only to In Progress. The guarded `delete-owned-comment` operation
refuses deletion unless the comment has that marker and its author matches the authenticated Jira user. The prior
attribution heading is recognized only as a legacy marker for comments created before marker rollout.

Creating, updating, cloning, commenting, or synchronizing Jira requires explicit `--submit`. Without it, supported
flows preview or validate without committing the Jira change.

## Common examples

Print the active profile's Jira ticket template:

```bash
${AI_COMMANDS_ROOT}/jira/jira.command.sh template
```

Update a ticket using a prepared description:

```bash
${AI_COMMANDS_ROOT}/jira/jira.command.sh update EXAMPLE-8336 \
  --description-file /path/to/description.txt \
  --submit
```

Synchronize the active Flow plan with Smart Checklist:

```bash
${AI_COMMANDS_ROOT}/jira/jira.command.sh sync-plan EXAMPLE-8336 --submit
```

Add a comment with mentions and a link:

```bash
${AI_COMMANDS_ROOT}/jira/jira.command.sh comment EXAMPLE-8336 \
  --body "The dev deployment is healthy; targeted validation remains pending." \
  --mention sshapiro \
  --mention schaturvedi \
  --link "Draft PR|https://github.example.invalid/example-org/example-service/pull/504" \
  --submit
```

Move an owned ticket to In Progress:

```bash
${AI_COMMANDS_ROOT}/jira/jira.command.sh set-in-progress EXAMPLE-8399 --submit
```

`--mention USER` renders Jira's `[~USER]` syntax. `--link "LABEL|URL"` renders `[LABEL|URL]`; links must use HTTPS.
Repeat either option as needed. For longer comments, prefer `--comment-file`.

The sync direction is:

```text
ai-config session-plan.md → Jira Smart Checklist
```

Markdown plan checkboxes retain their order and status. The command manages only the clearly marked `AI Flow Plan
(managed by ai-config)` section and preserves checklist content outside it.

## More details

See [jira.command.md](jira.command.md) for complete command behavior, ticket structure, configuration, validation
rules, and safety constraints.
