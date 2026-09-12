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

## Composition

Keep workflow context small and composable. Each rule has one authoritative owner; other documents reference it instead
of restating it.

- `<workflow-id>.workflow.md` owns workflow order, gates, and which supporting documents apply.
- `agents/team.md` owns the workflow roster, responsibility ownership, communication, and lifecycle policy.
- `_common/roles/` owns reusable role behavior and intrinsic role boundaries.
- `guides/` owns task-specific procedures and strategies that are loaded only when relevant.
- `agents.md` owns rules shared by every agent-enabled workflow.

A workflow entry point should therefore describe orchestration, not copy role permissions, team policy, or guide content.
If the same operational rule appears in more than one place, keep it in its authoritative document and replace the other
copies with a reference.

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
