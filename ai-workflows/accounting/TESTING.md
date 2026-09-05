# Accounting test ownership

Accounting owns two distinct automated gates.

- `./accounting-frontend/app.sh --standalone-test` is the **Accounting standalone workflow-runner suite**. It tests the
Accounting backend, source recognizers and extraction/recovery, workflow-center queries, frontend workflow surface, and
standalone startup contracts. A failure here identifies a workflow-internal regression.
- `./accounting-frontend/app.sh --launcher-smoke` is the **Accounting main-launcher smoke E2E**. It creates an isolated
config bundle, project, registry, and ports; starts the real host API; then loads the Accounting manifest through the
public launcher API. It proves `stopped → starting → running`, real Accounting backend and MCP readiness, health and
`/api-json`, command/project discovery, a nonblank initial Workflow Center model, bounded unload, and cleanup when MCP
is running but the backend ready route fails. The fixture derives the shipped manifest; only test-local port and
backend command location are changed, and the MCP entry is the same canonical source file via an absolute path (not a
substitute). A failure here identifies host-to-Accounting compatibility.

The launcher smoke deliberately does not duplicate extraction or browser acceptance. Generic launcher supervisor tests
remain launcher-owned infrastructure evidence; they do not prove Accounting remains loadable. Desktop UI acceptance
remains a separate gate.
