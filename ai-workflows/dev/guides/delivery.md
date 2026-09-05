# Development: delivery

- Inspect the current change and repository state before delivery.
- Do not switch branches, stash work, commit, push, open a PR, or deploy unless
  the user explicitly requests that action.
- Use concise imperative commit messages and report validation performed.
- Keep secrets and local configuration out of commits and deployment output.
- Before push, use the registered push helper to require a clean worktree, fetch the resolved remote default base, and
  rebase the feature branch onto it. Dirty state, refresh failure, or rebase conflict blocks publication.
- A commit, push, or draft PR does not establish completion. Read the active session plan and Definition of Done, record
  the next unfinished applicable verification gate, and do not declare readiness while one remains unresolved.
- Designer/Reviewer performs semantic review directly; Command Runner must not substitute for review reasoning.
