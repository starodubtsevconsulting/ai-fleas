# Development: testing

- Choose the smallest deterministic proof for the changed surface.
- Prefer targeted unit, integration, type, or lint checks before broad suites.
- Run a broad suite or production build only when requested or when focused
  validation cannot establish confidence.
- Report what was checked and any remaining uncertainty.
- The active development workflow owns gate order and role mapping. Designer/Reviewer owns expected semantics, technical
  review, and final assignment acceptance; Command Runner owns automated test execution; UI Acceptance Tester owns
  independent visible UI acceptance. None may substitute its evidence for another gate owner's receipt.
- Decide focused, integration, deployed API/fixture, visible UI/test URL, independent review, and demo gates explicitly.
  Record each as passed with evidence, not applicable with a reason, or blocked with the next action.
- A failed required gate remains blocked, preserves factual evidence, routes a bounded correction, and must be repeated.
- For UI-affecting work, automated end-to-end output and generated screenshots do not replace a matching terminal receipt
  from the exact initialized UI Acceptance Tester.
- Express repeatable end-to-end journeys through test-owned, domain-facing facade operations such as
  `launcher.listProjects()` rather than duplicating Playwright selectors, waits, window handling, or readiness mechanics
  in individual tests. These facades belong in E2E test support code, never in shipped product code. The facade keeps
  journeys readable and reusable and provides one supportable repair point when the rendered UI changes.
- Treat computer or desktop vision as a bounded diagnostic fallback for a blocked facade operation. Use the visible
  observations to repair and harden the facade and its underlying Playwright mechanics, then rerun the journey through the
  facade; vision-only success is not the steady-state automated acceptance path.
