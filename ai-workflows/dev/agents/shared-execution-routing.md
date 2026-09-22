# Dev workflow runtime routing

The Dev workflow has no agent-to-agent communication topology. Its authoritative workflow and applicable flow files
declare each stage and assigned role. The workflow-scoped [Router runtime](../../_common/runtime/workflow-router.md)
executes those declarations, resolves the assigned role to one exact initialized instance, and dispatches the next
bounded work envelope.

Agents never select, address, or return directly to another workflow Agent. They receive work from the Router and return
one result event to the same Router runtime. Tool or transport availability does not create a peer route.

## Runtime envelope

Every Router dispatch contains:

- exact `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`;
- Router runtime ID, workflow run ID, stage ID, and transition sequence;
- exact target instance ID and workflow-assigned execution role;
- bounded intent, inputs, allowed/prohibited effects, required evidence, and terminal condition; and
- reference-only artifact, evidence, and handoff values.

The recipient validates its exact initialized identity, workflow coordinates, assigned role, stage capability, and
effect boundary before reading the work payload. It returns to the Router runtime—not another Agent—with the same run,
stage, sequence, and coordinates plus one declared event such as `completed`, `blocked`, `depleted`, or `unclear` and
bounded evidence references.

The Router validates the result against the active stage. It then consults the workflow declaration, resolves the next
stage's role from trusted runtime bindings, and dispatches the next envelope. A stale, duplicate, cross-scope, or
undeclared event is blocked without advancing state.

## Capability validation

The [capability-ownership matrix](role-capability-ownership.csv) remains authoritative for what a role may do. Before
dispatch, the Router verifies that the role assigned by the workflow owns the stage's required capability. The matrix
does not say who communicates with whom and grants no transport route.

Workflow `dependencies` describe capability availability only. They may tell the Router that a stage cannot run until a
provider role is available, but they never authorize one Agent to contact another.

## Ticket lookup and mechanical execution

Ticket discovery, implementation, deterministic commands, review, and visible acceptance are workflow stages rather
than peer requests. For example:

1. an intake stage assigned to Designer/Reviewer may emit `ticket-lookup-required` with bounded request references;
2. the workflow transitions to a ticket-discovery stage assigned to Manager;
3. Manager returns `completed`, `blocked`, or `unclear` to the Router with tracker evidence references;
4. the workflow determines the next stage; and
5. when a registered mechanical operation is required, the workflow transitions to a Command Runner stage and later
   returns its evidence to the Router before resuming a decision stage.

Manager never contacts Command Runner, Designer/Reviewer never contacts Coder, and workers never contact Manager. The
same workflow run and Router state connect those stages without creating peer authority.

Evidence capture times must come from an observed clock or provider receipt. Use `capturedAt: null` with an explicit
unavailable reason when no capture time exists. A later transition time must not be presented as the time of an earlier
external read.

## Delivery and failure

Role resolution and dispatch are transactional. The Router commits a transition only after the platform confirms
delivery to the exact scoped instance. Failed resolution or delivery preserves the current stage and history. Definite
transport failures may follow the platform's bounded retry policy; they never authorize a different role, instance,
profile, workflow, project, or runtime scope.
