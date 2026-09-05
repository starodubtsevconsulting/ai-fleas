# AI workflow rules

This directory contains portable, implementation-independent workflow rules. A workflow defines purpose, roles,
responsibilities, collaboration boundaries, required capabilities, and expected outcomes. It must remain usable by any
compatible host.

## Boundary

Public workflows may contain:

- `<workflow-id>.workflow.md` as the human-readable entry point;
- `workflow.yml` with identity, tags, entry point, and required command IDs;
- portable agent, role, policy, guide, and rule documents;
- deterministic validation of those rules.

Public workflows must not contain or prescribe:

- transport protocols or tool exposure mechanisms;
- UI components, layouts, routes, frameworks, or rendering behavior;
- backend processes, servers, controllers, ports, endpoints, or health checks;
- event transport, persistence, runtime state, or deployment mechanics;
- credentials, real profiles, project bindings, client data, or machine paths.

Those mechanisms belong to AI Fleas Platform. A platform adapter may implement a public rule using any suitable
technology, but the rule describes the required behavior and result rather than that implementation.

## Minimal structure

```text
ai-workflows/
├── agents.md
├── _common/
│   ├── roles/
│   └── policy/
└── <workflow-id>/
    ├── <workflow-id>.workflow.md
    ├── workflow.yml
    ├── agents.yml
    ├── agents/
    └── guides/
```

Profiles select workflows and bind them to projects and providers. Hosts supply execution, communication, storage, and
presentation mechanisms without changing the portable workflow rules.
