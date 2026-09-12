# Common agent communication

Agents communicate only with peers and directions declared by the current workflow. Sender, recipient, and return instance
must have identical verified `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`.

Cross-profile, cross-workflow, cross-logical-project, and cross-runtime-scope agent communication is unconditionally
prohibited. No Manager, initializer, relay, command, remembered context, user wording, or matching repository may authorize
or bridge it. The human may independently address another initialized project, but an agent cannot carry a packet,
authority, or result across that boundary.

Every inter-agent packet includes a unique request/correlation ID; exact caller instance ID and role; exact recipient
instance ID and role; exact nonempty `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`; bounded intent and
inputs; granted authority and prohibited effects; required evidence or output; and exact return instance ID and role.

A legacy readable `project` field is permitted only when it exactly equals `logicalProjectId` and never substitutes for
this four-coordinate header. Missing or conflicting required fields are `BLOCKED`, not reconstructed from conversation
history. Corrections, progress messages, evidence responses, and return packets preserve the same coordinates unchanged.

A recipient compares packet coordinates with trusted sender, recipient, and return-instance initialization headers;
equality of packet text alone is insufficient. A mismatch is `BLOCKED_PROFILE_BOUNDARY` with zero payload execution.

## Allowed routes

- A human may directly address a workflow role according to that role's declared human-facing mode.
- An initialized agent may send one complete packet only to an exact initialized role and direction declared by its selected workflow.
- Sender, recipient, and return instance must have identical verified workflow coordinates.
- A recipient may return terminal evidence only to the exact verified `returnInstanceId` in the same coordinates.

## Prohibited routes

- Direct human-style work requests to a role declared internal packet-only.
- Any cross-profile, cross-workflow, cross-logical-project, or cross-runtime-scope message, return, relay, or authority transfer.
- A substitute, same-named, hidden, temporary, child/subagent, or undeclared intermediary route.
- A packet with missing, conflicting, untrusted, or stale caller, recipient, coordinate, authority, or return evidence.

Every prohibited route is `BLOCKED`; the recipient performs no payload work and does not reconstruct the route from
conversation history, a title, a repository path, or remembered context.

## Active-scope interruption guard

An accepted packet remains the role's active scope until its terminal receipt or an exact authorized stop/replacement.
Later input is accepted only when it preserves the correlation, ticket or work-packet identity, target, return route, and
bounded intent and explicitly declares a same-scope extension or correction.

A stop or replacement identifies the active correlation and uses its declared authority route. Every different ticket,
target, goal, or ambiguous instruction returns `BLOCKED_ACTIVE_SCOPE_INTERRUPTION` without payload reading, queuing,
forwarding, tool use, or context switching.

## Bounded evidence follow-up

When an authorized lower-level role asks its exact supervising agent for evidence required to evaluate the same bounded
assignment, the supervising agent MUST make one bounded attempt to resolve the request before reporting it to the human.
The request carries the assignment or ticket ID when one exists, a stable evidence-request correlation ID, one precise
missing gate or proof, and the exact verified return route.

The supervising agent may investigate only through already-declared capabilities and authorized routes. It must not acquire
new authority, invent evidence, reopen scope, or create work solely for the reply.

For one `(assignmentOrTicketId, evidenceRequestCorrelationId)` pair, the supervising agent sends at most one complete
evidence reply to the exact lower-level role. If proof cannot be established, it sends one unavailable-evidence reply with
the exact blocker and next authorized owner. Repeated requests without a materially different evidence gap are reported to
the human as a possible cycle rather than investigated again.
