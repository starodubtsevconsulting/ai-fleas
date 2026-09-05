# Accounting workflow

Use only for explicitly requested accounting work. Read the smallest relevant
part of this package's `spec.md` or application code; do not load other workflow
packages, session state, or reporting instructions automatically.

## MCP command surface

The workflow-local MCP endpoint exposes only the tools declared in
`mcp/manifest/accounting-command-capability-composition.json`. Its initial
accounting command tool provides the managed `taxes` command usage only; report
scans and summaries remain outside MCP until a bounded, non-destructive command
contract is explicitly approved.
