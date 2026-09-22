# Workflow Router runtime contract

The workflow file is the declarative program. It defines the ordered stages, the role assigned to each stage, transition
conditions, and exception paths. The Workflow Router is the runtime that executes that program.

The Router is neither a workflow nor a workflow Agent. It is hidden orchestration infrastructure. A host may realize it
as a process, service, state machine, or—when a task/chat is the only execution primitive—a dedicated orchestration task.
That representation never makes the Router a team role or grants it domain authority.

## Runtime scope and authority

One Router runtime belongs to exactly one `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`. Every event
must repeat those coordinates exactly. A missing or mismatched coordinate is `BLOCKED_ROUTER_SCOPE`; the Router must not
read the payload or change runtime state.

The authoritative `*.workflow.md` owns stages, role assignments, transitions, and recovery. An executable projection may
compile those declarations into a state-machine definition, but it must cite the authoritative workflow source and
cannot add a stage, role, route, capability, or exception policy.

## Workflow execution

### Universal human entry

Any exact initialized workflow endpoint may be the human-facing entry point. The human does not need to address Admin
or a visible Router first. At ingress, the host resolves the addressed task's trusted workflow binding and attaches a
Router-owned correlation to the turn.

The receiving endpoint checks the request against the workflow's declared capabilities. When its role owns the exact
capability, that endpoint handles the request in the corresponding stage and returns its terminal result to the Router.
When another role owns the capability, the addressed endpoint performs no substitute work: the host Router resolves and
dispatches the workflow-declared owner. Undeclared capabilities and capabilities that map ambiguously to more than one
stage fail closed instead of being routed by title, conversational similarity, or Router judgment.

This ingress-and-return mechanism is common to every workflow. Individual workflows still own their capabilities,
stages, role assignments, transitions, evidence requirements, and terminal events. Admin remains available for
initialization, inspection, and authorized recovery; it is not an ordinary workflow entry or relay requirement.

Whether the addressed endpoint owns the work or the Router dispatches another endpoint, every completed endpoint turn
returns to the same hidden Router runtime. The Router validates the terminal result and follows the workflow's declared
transition. Endpoints never contact one another.

For a normal workflow event, the Router runtime:

1. validates exact workflow scope and the expected current stage;
2. selects one transition declared by the workflow for that stage and event;
3. resolves the next stage's declared role to one exact initialized runtime instance;
4. dispatches a bounded handoff containing only required artifact, evidence, and handoff references;
5. records the next stage and accountable role; and
6. appends one concise transition record.

The Router therefore runs the workflow and routes execution from one assigned role to the next. It does not encode a
separate worker-to-worker topology: the workflow declares who owns each stage, while the platform binding resolves that
role to an exact instance at runtime.

Operationally, the reusable runtime performs one deterministic lookup chain:

```text
(current stage, returned event) -> declared transition -> next stage -> stage owner role -> bound runtime instance
```

For example, a Writing workflow may declare `review + changes_required -> correction` and assign `correction` to
Writer. The generic Router reaches Writer because of those declarations and the host's receipt-backed Writer binding,
not because its implementation contains a Reviewer-to-Writer special case. Another workflow can use the same runtime
with entirely different stage names, events, roles, and transitions.

The Router never consumes artifact bodies merely because a reference exists. A transition may require a particular
reference kind, but interpreting its content remains with the assigned role.

A workflow may place a retry policy on a transition and identify the bounded reference kinds that prove progress. The
Router counts dispatch attempts carrying the same declared progress references and stops at the workflow's ceiling.
This guard is mechanical and workflow-neutral: it prevents an endpoint pair from repeatedly returning the same revision
without hard-coding role names or asking the Router to judge artifact content. A new progress reference starts a new
attempt sequence.

Role resolution and dispatch are transactional. The host adapter must return an exact instance whose workflow
coordinates and role match the next stage. Missing identity, failed delivery, or mismatched scope leaves the current
stage and history unchanged; a successful dispatch commits the transition and its target instance receipt.

Queue acceptance alone is not successful dispatch. For an idle saved task, the host must resume the exact bound task,
start a turn, and observe target-matching `turn.started` evidence before promoting a pending delivery receipt. Completion
and failure remain distinct receipt states. A bounded reference is transferable only when the receiving endpoint can
resolve it to a durable artifact without reading the sending endpoint's conversation.

Each dispatch carries one Router-owned `correlationId`, exact stage, exact role, and exact recipient instance. The
endpoint must acknowledge with `COPY THAT` and return those three identity fields byte-for-byte in its terminal result.
It must not shorten, normalize, regenerate, or substitute the correlation. Missing acknowledgement or any correlation,
stage, or role mismatch is `BLOCKED_ROUTER_RESULT_IDENTITY`; the Router preserves the current state and does not advance.
The host, not the endpoint, remains authoritative for the run and attempt correlation.

`blocked`, `depleted`, and `unclear` are exception events. They use the workflow's declared exception path, normally to
Manager, and preserve the interrupted stage as the resume point. The Router does not invent recovery, replace a worker,
reinterpret acceptance, or choose among ambiguous domain outcomes.

## Runtime state and history

Inspectable runtime state contains only:

- exact workflow coordinates and Router runtime ID;
- current stage, assigned role, exact assigned runtime instance when dispatched, status, and optional resume stage;
- bounded reference identifiers/URIs and reference kinds; and
- append-only history entries containing sequence, event, from/to stage, from/to role, disposition, and exception.

History excludes artifact bodies, chat transcripts, credentials, and cross-profile memory. A failed validation leaves
both current state and history unchanged. Retention and persistence belong to the selected profile/platform adapter.

User-facing workflow roles remain visible agents and technical workers may remain headless. The portable contract is the
runtime behavior above, not its host-specific UI representation.
