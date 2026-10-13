# statements Spec

## Shared record organization

Follow the [Financial Insights record organization flow](../../../ai-workflows/financial-insights/flows/record-organization.flow.md) within the selected profile's authorized mapping. Keep source-adjacent CSV/JSON, preserve existing `.pdf.json` schema conventions and provenance, and use one mapped `_common/qN/summary.md` for current coverage and unresolved work. Compose aggregates on demand instead of retaining duplicate extracts. This contract does not add a generic CSV exporter, change supported operations, or waive persistence gates. Existing command output/checkpoint behavior remains compatible; publication or cleanup needs its authorized route.

## Purpose

Define the operating rules for the `statements` command.

## Command Files

- `statements.command.md`

## Rules

- Keep command behavior aligned with the command markdown contract.
- Keep examples and implementation references current when behavior changes.
- Keep `fs` as the explicit default provider until another provider is deliberately configured.
- Keep the `fs` reports tree identical to the `taxes` filesystem-provider contract.
- Reject an unavailable explicitly selected provider; never silently fall back to `fs`.
- Do not add unrelated behavior to this command; create or use a narrower command instead.

## UI Behavior

- When this command is selected in the Command panel, show this spec in the Spec panel.
- Clicking the Spec panel title opens this file in the central dialog.
