## Tags

#command #ai-command #bug-fix #regression #testing

if user aks to fix something, it is a bug fix, so:

- if we are working in this `ai` tooling repo: treat it as a **local meta project** (dev tooling that runs on the
user's machine), so assume it is **not** a prod issue unless the user explicitly says it is prod
- otherwise, ask if it is prod bug; if it is we have to report to /docs/[app]/prod-issues about it,
  with 1. symptoms 2. cause 3. impact 4. proposal to fix 5. prevention plan
- if it is not prod bug (or not critical),
  ask if it is a regression,
- the `plan.md` has to link the prod issue report too.

when critical:

- we have first to reproduce it, unit tess, integration and e2e
- we are not trying to fix it IF we did not reproduce it first!
- as we did reproduce and fixed, we have to update docs/design etc to make sure we would not screw it again.
