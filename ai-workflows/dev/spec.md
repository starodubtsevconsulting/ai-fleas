# dev.workflow Spec

## Purpose

Define the operating rules for `dev.workflow.md`.

## Rules

- Keep workflow scope, command mapping, and UI expectations aligned with the workflow markdown.
- Keep workflow-specific command panel mappings focused on commands useful in that workflow.
- Use project, command, and workflow specs as selectable context in the Spec panel.

## UI Behavior

- When this workflow is selected, show this spec in the Spec panel unless the user selects a project or command afterward.
- Clicking the Spec panel title opens this file in the central dialog.
- The standalone development workspace includes a read-only Changes tab for inspecting the loaded project's Git status and file diffs.
- In launcher-hosted mode, Files and Changes remain available whenever the open
  Work Session has a scoped development project, including while the launcher's
  transient project selection is empty. The selected catalog project takes
  precedence when available.

## Code Paths

- `ai-launcher/apps/ui/src/app/workflow-iframe-project-context.mapper.ts` maps launcher
  catalog or Work Session project state into iframe host context.
- `ai-workflows/dev/dev-frontend/src/dev-workflow-app.component.ts` renders the
  Terminal, Files, and Changes workspace tabs from that host context.
