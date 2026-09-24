# Development: delivery

- Inspect the current change and repository state before delivery.
- Before creating or renaming a branch, committing, pushing, or opening/updating a pull request, load the registered
  [source-control command](../../../ai-commands/connect/source-control/source-control.command.md) and its selected
  [Git provider contract](../../../ai-commands/connect/git/git.command.md). Their workflow-role provenance rule is a
  delivery gate, not an optional naming preference: a new branch uses
  `<initiating-role>/<short-kebab-description>`; execution-technology, model, provider, or generic-AI prefixes are
  invalid. A direct human-created workstream uses `human/`.
- Do not switch branches, stash work, commit, push, open a PR, or deploy unless
  the user explicitly requests that action.
- Use concise imperative commit messages and report validation performed.
- Keep secrets and local configuration out of commits and deployment output.
- Before push, use the registered push helper to require a clean worktree, fetch the resolved remote default base, and
  rebase the feature branch onto it. Dirty state, refresh failure, or rebase conflict blocks publication.
- A commit, push, or draft PR does not establish completion. Read the active session plan and Definition of Done, record
  the next unfinished applicable verification gate, and do not declare readiness while one remains unresolved.
- Before each authorized delivery effect, report the current Dev phase, plan/recovery point, completed evidence, and
  next gate. A pull request inherits the already-validated head branch; PR creation never excuses or repairs an invalid
  new-branch prefix.
- Designer/Reviewer performs semantic review directly; Command Runner must not substitute for review reasoning.
