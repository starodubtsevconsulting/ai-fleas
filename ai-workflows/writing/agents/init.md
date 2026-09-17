# Writing managed-agent initialization

Managed initialization is distinct from merely loading the Writing workflow. It requires a direct human request, a
verified profile and `writing` workflow, an exact `<profile-id>-writing`-style logical project, a nonempty profile-authorized
selected project subset, and a compatible selected platform. The GPT adapter must verify the existing saved project,
load [agents.yml](../agents.yml) and its role binding, and create the complete roster through the
[`gpt-agents` command](../../../ai-commands/system/gpt-agents/gpt-agents.command.md). Missing or conflicting scope,
identity, roster, project, or host capability blocks all agent mutation.

Initialization never publishes, schedules, edits an article, creates the article archive, or creates the saved Codex
project. Readiness requires exact returned task receipts and readiness tokens for Admin, Judge, Writer, Reviewer, and
Release Coordinator. A plain chat title is not an agent receipt.
