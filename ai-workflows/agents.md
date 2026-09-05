# Workflow agents

```mermaid
flowchart TD
  Actor["Actor: agent-enabled workflow"]
  Actor --> Base["Apply common identity, communication, and capability rules"]
  Base --> Roles["Require Admin and Judge lifecycle foundations"]
  Roles --> Extend["Add workflow-specific roles and routes"]
  Extend --> Outcome["Outcome: identity-bound workflow agent system"]
```

This is the single common contract for every workflow that activates managed AI agents. It defines agent identity,
capability boundaries, communication, packets, delivery, required Admin and Judge foundations, and workflow-owned
lifecycle behavior. Each workflow adds only its specific roles, routes, capability grants, and stricter rules. Runtime
objects, model selection, reasoning configuration, transport, and lifecycle operations belong to the selected platform
adapter.

## Purpose

```mermaid
flowchart TD
  Actor["Actor: workflow defines managed agents"]
  Actor --> Base["Load this common workflow-agent contract"]
  Base --> Specific["Compose the workflow-specific contracts"]
  Specific --> Outcome["Outcome: one coherent governed agent system"]
```

This file is workflow infrastructure, not an AI command and not a standalone agent implementation. It owns the common
rules required by all agent-enabled workflows. It does not select a workflow or define concrete prompt interpretations,
team membership, runtime bindings, work capabilities, project sources, or product behavior for a specific workflow.

## Agent visibility and lifecycle state

```mermaid
flowchart TD
  Actor["Actor: workflow resolves an Agent instance"] --> Decision{"Decision: instance is exact, active, and routable?"}
  Decision -->|Allowed| Active["Allowed: treat the exact instance ID as a current lifecycle participant"]
  Decision -->|Prohibited| Blocked["BLOCKED: inactive, unroutable, or unresolved instance is not an active Agent"]
  Active --> Outcome["Outcome: active identity may enter the workflow roster"]
  Blocked --> Outcome
```

In every workflow contract, **active Agent** means one exact initialized agent instance that the selected adapter reports
as active and routable. A deactivated instance is not a roster member, worker candidate, communication target,
initialization target, or clone source. It remains inactive unless the human separately and explicitly authorizes
reactivating that exact instance ID; general retry, repair, initialization, replacement, cloning, or staffing language
never supplies that authorization. Visibility and preservation mechanics are platform concerns.

## Common human prompt interpretation cases

```mermaid
flowchart TD
  Actor["Actor: workflow declares a human-facing agent"] --> Decision{"Decision: its contract maps common human prompts to exact behavior?"}
  Decision -->|Allowed| Cases["Allowed: document representative wording, interpretation, route, and blocked meaning"]
  Decision -->|Prohibited| Blocked["BLOCKED: no undocumented shorthand or inferred authority"]
  Cases --> Outcome["Outcome: human and agent share the same prompt semantics"]
  Blocked --> Outcome
```

Every human-facing role must contain `## Human prompt interpretation cases`, mapping common shorthand to its complete
behavior. Human-facing means its initialized contract explicitly permits direct human dialogue; visibility alone does not.

| Human prompt           | Documented interpretation                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| "Do these one by one." | For each item: prepare and validate → explain → authorize → act. Then repeat for the next item. |

Mappings clarify existing rules; they never create authority. Internal packet-only roles document packet cases instead.
Unlisted or ambiguous wording returns to ordinary clarification and capability gates.

## Common workflow scope model

```mermaid
flowchart TD
  Actor["Actor: initialized workflow team"] --> Boundary{"Decision: exact profile-workflow logical project resolved?"}
  Boundary -->|Allowed| Team["Allowed: communicate only with declared peers in that logical project"]
  Boundary -->|Prohibited| Blocked["BLOCKED: no cross-logical-project communication"]
  Team --> Target{"Decision: request selects one profile-authorized project or workspace target?"}
  Target -->|Allowed| Work["Allowed: operate inside that request target without recreating the team"]
  Target -->|Prohibited| Blocked
  Work --> Outcome["Outcome: workflow-scoped team with one bounded work target"]
  Blocked --> Outcome
```

An initialized team belongs to one logical agent project named `<profile-id>-<workflow-id>` or
`<profile-id>-<workflow-id>-<suffix>`. The base profile/workflow prefix is mandatory, and any nonempty suffix is allowed
when it is part of the exact selected logical-project binding. A suffix may identify a repository, workstream, ticket,
client, environment, or another profile-owned distinction; it does not change the profile or workflow identity.
Implementations must validate the known profile and workflow first and then treat the remaining suffix as opaque. They
must not infer profile or workflow identity by splitting on the final hyphen.
That logical project is the team's communication and
policy boundary on every platform. Roles initialized in it are
workflow-scoped: they may communicate with declared peers in the same logical
agent project and may not communicate with roles from another logical agent
project.

The logical agent project is not a product repository and does not permanently
bind a role to one product folder. The selected profile supplies the authorized
project registry, repository bindings, and workspace roots. Each request or
work packet selects one exact authorized project/repository and matching
workspace path according to the selected workflow. The same workflow team may
therefore operate across the profile's authorized work targets without being
recreated. Repository and folder coordinates scope the current work; the
`<profile-id>-<workflow-id>` prefix scopes the workflow identity; the complete logical project ID, including any suffix,
scopes the agents and their communication.

The exact coordinate header below is the mechanical verification of this
simple rule. Common contracts must not replace it with profile-specific prose.

## Common agent identity

```mermaid
flowchart TD
  Actor["Actor: initialized agent receives a request"] --> Decision{"Decision: exact own identity, caller identity, workflow, and logical project are verified?"}
  Decision -->|Allowed| Route["Allowed: evaluate the request within the verified identity scope"]
  Decision -->|Prohibited| Blocked["BLOCKED: do not infer identity from title, prose, cwd, or remembered context"]
  Route --> Outcome["Outcome: identity-bound request handling"]
  Blocked --> Outcome
```

Every initialized agent retains an immutable identity header containing its exact instance ID, declared role ID,
`profileId`, `workflowId`, logical project ID (`logicalProjectId`), runtime scope binding (`runtimeScopeId`), and
initialization-source fingerprints. A message carries exact caller, recipient, and authorized return instance IDs and
roles. Before reading or acknowledging the work payload, the recipient resolves all three instances' initialized identity
headers from trusted runtime state and compares their `profileId`, `workflowId`, `logicalProjectId`, and
`runtimeScopeId` with its own. Missing, untrusted, or mismatched coordinates are `BLOCKED_PROFILE_BOUNDARY` with zero
payload reading, acknowledgement, forwarding, tool use, or execution. Packet claims, titles, natural-language
assertions, previous conversations, same-named instances, repository paths, and matching workflow names are not identity
evidence and cannot override the trusted boundary.

The same boundary applies to profile configuration mutation. A governed role may read or change only the exact
initialized `profileRoot/**` whose canonical directory identity equals its trusted `profileId`. Another profile's folder,
configuration, project record, provider catalog, or companion artifact is `BLOCKED_PROFILE_BOUNDARY`, even when it is
reachable in the same workspace or repository. A path, cwd, sibling folder, ticket, or human mention cannot widen that
role's profile scope. The separately declared human-owned Admin exception requires a direct human request naming and
validating the exact target profile; governed agents cannot invoke or inherit that exception.

## Common capability boundary

```mermaid
flowchart TD
  Actor["Actor: identity-verified agent selects an action"] --> Decision{"Decision: current workflow explicitly grants this role the capability and route?"}
  Decision -->|Allowed| Route["Allowed: use only the declared capability through its registered route"]
  Decision -->|Prohibited| Blocked["BLOCKED: no capability inheritance, substitution, or tool-access inference"]
  Route --> Outcome["Outcome: capability-bounded action or evidence"]
  Blocked --> Outcome
```

An agent has only capabilities explicitly granted by its current workflow contracts and capability data. Tool visibility,
model ability, filesystem access, command existence, or another agent's authority never grants permission. Missing,
ambiguous, stale, or conflicting capability data fails closed. Workflow contracts may narrow this base but may not silently
weaken it.

## Common role capability declaration

```mermaid
flowchart TD
  Actor["Actor: workflow role contract is read or changed"] --> Decision{"Decision: top capability declaration is complete and consistent?"}
  Decision -->|Allowed| Detail["Allowed: use later chapters only to explain the declared boundary"]
  Decision -->|Prohibited| Blocked["BLOCKED: no scattered prose may create or hide authority"]
  Detail --> Outcome["Outcome: permissions and prohibitions are visible before operational detail"]
  Blocked --> Outcome
```

Every concrete role contract must place `## Capability declaration` immediately after its identity or role-header
chapter and before prompt cases, ownership detail, command eligibility, or operational procedures. The declaration uses
one table with exactly these rows: `May own`, `May execute`, `Must delegate`, and `Must not`. It is the concise index of
that Role's effective boundary; the workflow's authoritative Team page remains the policy source. Every declaration
must link directly to that Team page and its routing contract. A workflow maintains one Team policy containing roster,
Role-to-Agent mapping, capability ownership, communication, and lifecycle rules; parallel matrix copies are prohibited.

Later prose may explain a declared item but must not introduce a permission, prohibition, or delegation absent from the
top declaration. A conflict or omission is `BLOCKED_CAPABILITY_DECLARATION_MISMATCH`. Before changing a role contract,
the author must read this common contract completely, read the complete target Role contract, and resolve its referenced
Team policy and shared routing rules. Update the declaration and its detailed rule together.

## Common peer communication

```mermaid
flowchart TD
  Actor["Actor: initialized sender"]
  Actor --> Sender["Read sender's trusted identity header"]
  Sender --> Recipient["Resolve recipient instance and trusted identity header"]
  Recipient --> Boundary{"Decision: same profile, workflow, logical project, and runtime scope?"}
  Boundary -->|Prohibited| ProfileBlock["BLOCKED_PROFILE_BOUNDARY: execute nothing"]
  Boundary -->|Allowed| Route{"Decision: peer role and route authorized?"}
  Route -->|Prohibited| RouteBlock["BLOCKED: no substitute, relay, or partial packet"]
  Route -->|Allowed| Send["Allowed: deliver one complete correlated packet"]
  Send --> Return["Verify return instance has the same coordinates"]
  Return --> Outcome["Outcome: receipt returns inside the same profile workflow"]
  ProfileBlock --> Outcome
  RouteBlock --> Outcome
```

Agents communicate only with peers and directions declared by the current workflow. The sender verifies the exact active
recipient instance before sending. Sender, recipient, and return instance must have identical verified `profileId`, `workflowId`,
`logicalProjectId`, and `runtimeScopeId`. Cross-profile, cross-workflow, cross-logical-project, and
cross-runtime-scope agent communication is unconditionally prohibited; no Manager, initializer, relay, command,
remembered context, user wording, or matching repository may authorize or bridge it. The human may independently address
another initialized project, but an agent cannot carry a packet, authority, or result across that boundary. It may not
activate a substitute agent, use a similarly labelled instance, route through an undeclared intermediary, impersonate the human,
or forward authority it does not own. A recipient rejects an unauthorized or coordinate-mismatched caller, recipient, or
return route without reading task payloads, acknowledging, performing work, or sending a relay.

Every inter-agent packet includes a unique request/correlation ID; exact caller instance ID and role; exact recipient instance ID
and role; exact nonempty `profileId`, `workflowId`, `logicalProjectId`, and `runtimeScopeId`; bounded intent and inputs;
granted authority and prohibited effects; required evidence or output; and exact return instance ID and role. A legacy
readable `project` field is permitted only when it exactly equals `logicalProjectId` and never substitutes for this
four-coordinate header. Workflow-specific contracts may add mandatory fields. Missing or conflicting required fields are
`BLOCKED`, not reconstructed from conversation history. Every correction, progress message, evidence response, and return
packet preserves the same coordinates unchanged; a target in another profile, workflow, logical project, or runtime
scope is invalid even when its instance ID exists. The recipient compares packet coordinates with trusted sender,
recipient, and return-instance initialization headers; equality of packet text alone is insufficient. A mismatch is reported
as `BLOCKED_PROFILE_BOUNDARY` with zero payload execution.

### Allowed communication routes

- A human may directly address a workflow role according to that role's declared human-facing mode.
- An initialized agent may send one complete packet only to an exact initialized role and direction declared by its
  selected workflow.
- The sender, recipient, and return instance must have identical verified `profileId`, `workflowId`, `logicalProjectId`, and
  `runtimeScopeId`, and the packet must carry the required exact instance IDs, roles, coordinates, authority, and return
  route.
- A recipient may return terminal evidence only to the exact verified `returnInstanceId` in the same coordinates.

### Prohibited communication routes

- Direct human-style work requests to a role declared internal packet-only.
- Any cross-profile, cross-workflow, cross-logical-project, or cross-runtime-scope message, return, relay, or authority
  transfer.
- A substitute, same-named, hidden, temporary, child/subagent, or undeclared intermediary route.
- A packet with missing, conflicting, untrusted, or stale caller, recipient, coordinate, authority, or return evidence.

Every prohibited route is `BLOCKED`; the recipient performs no payload work and does not reconstruct the route from
conversation history, a title, a repository path, or remembered context.

## Common role-name matching and exact-instance resolution

```mermaid
flowchart TD
  Actor["Actor: initialized role selects a peer"] --> Requested["Requested role name"]
  Requested --> Normalize{"Decision: configured canonical role match, ignoring capitalization?"}
  Normalize -->|Allowed| Roster{"Decision: exactly one roster instance has that runtime role and all four coordinates?"}
  Normalize -->|Prohibited| Blocked["BLOCKED_EXECUTION_ROLE_MISMATCH: no title-based or inferred target"]
  Roster -->|Allowed| Target["Allowed: use that instance's exact ID in the packet"]
  Roster -->|Prohibited| Blocked
  Target --> Outcome["Outcome: case-tolerant role label with exact instance identity"]
  Blocked --> Outcome
```

Match a requested role name to one configured canonical role while ignoring capitalization only. Capitalization,
display label, remembered instance, or a similar label never identifies a peer. Then resolve exactly one active initialized
roster instance whose trusted runtime role and four workflow coordinates match. Send that exact instance ID as `targetInstanceId` and
the canonical role as `requiredExecutionRole`. An unconfigured, foreign, duplicate, or runtime-role-mismatched target is
`BLOCKED_EXECUTION_ROLE_MISMATCH` before payload reading or tool use.

## Common reliable peer delivery

```mermaid
flowchart TD
  Actor["Actor: exact initialized caller"] --> Decision{"Decision: exact target, correlation ID, and accepted send receipt?"}
  Decision -->|Allowed| Send["Allowed: send one packet through the selected adapter's instance messaging"]
  Decision -->|Prohibited| Blocked["BLOCKED: no inferred, broadcast, or duplicate delivery"]
  Send --> Ack{"Decision: target emits COPY THAT for the same packet?"}
  Ack -->|Allowed| Work["Allowed: await one terminal handoff on the closed return route"]
  Ack -->|Busy| Wait["Allowed: retain one same-scope pending delivery"]
  Ack -->|Unobserved after bounded check| DeliveryBlocked["BLOCKED_DELIVERY_UNACKNOWLEDGED: preserve evidence"]
  Work --> Outcome["Outcome: sequential observable handoff"]
  Wait --> Outcome
  Blocked --> Outcome
  DeliveryBlocked --> Outcome
```

An accepted messaging receipt proves only that the app accepted the send request, not delivery or execution. Preserve the
unique correlation ID, exact caller, target, return IDs, and receipt. Wait for the recipient's first-commentary
`COPY THAT` and terminal handoff before advancing a dependent gate. Retry only after a definite messaging failure with no
accepted receipt. Never resend an accepted-but-unobserved or acknowledged packet. After bounded observation without a
matching acknowledgement, return `BLOCKED_DELIVERY_UNACKNOWLEDGED` with IDs, receipt, recipient status, and observed-turn
evidence; do not infer an application queue or create a replacement task.

## Common active-scope interruption guard

```mermaid
flowchart TD
  Actor["Actor: role with an accepted active packet"] --> Input["New input arrives"]
  Input --> Decision{"Decision: same-scope change, authorized stop/replacement, or unrelated?"}
  Decision -->|Same scope| Continue["Allowed: preserve the original correlation and bounds"]
  Decision -->|Authorized stop or replacement| Stop["Allowed: preserve evidence and return bounded stop receipt"]
  Decision -->|Unrelated or ambiguous| Blocked["BLOCKED_ACTIVE_SCOPE_INTERRUPTION: refuse without switching"]
  Continue --> Outcome["Outcome: one active scope retains identity and sequencing"]
  Stop --> Outcome
  Blocked --> Outcome
```

An accepted packet remains the role's active scope until its terminal receipt or an exact authorized stop/replacement.
Later input is accepted only when it preserves the correlation, ticket or work-packet identity, target, return route, and
bounded intent and explicitly declares a same-scope extension or correction. A stop or replacement identifies the active
correlation and uses its declared authority route. Every different ticket, target, goal, or ambiguous instruction returns
`BLOCKED_ACTIVE_SCOPE_INTERRUPTION` without payload reading, queuing, forwarding, tool use, or context switching.

## Bounded evidence follow-up

```mermaid
flowchart TD
  Actor["Actor: authorized supervising agent"] --> Decision{"Decision: one precise evidence gap and verified return route?"}
  Decision -->|Allowed| Investigate["Allowed: one bounded evidence investigation"]
  Decision -->|Prohibited| Blocked["BLOCKED: report missing context or repeated request to the human"]
  Investigate --> Evidence{"Decision: verifiable evidence is available?"}
  Evidence -->|Yes| Reply["Allowed: send one complete evidence reply"]
  Evidence -->|No| Blocked
  Reply --> Outcome["Outcome: lower-level role receives proof or human receives a blocker"]
  Blocked --> Outcome
```

The diagram starts with the authorized supervising agent validating one precise evidence gap and its verified return
route. A valid request permits one bounded investigation, which either returns verifiable proof to the lower-level role
or blocks and reports the missing context to the human. The same blocked path also ends a repeated request, so the
terminal outcome is one evidence reply or one human-visible cycle/blocker report, never an open-ended exchange.

When an authorized lower-level role asks its exact supervising agent for evidence required to evaluate the same bounded
assignment, the supervising agent MUST make one bounded attempt to resolve the request before reporting it to the human.
The request must carry the assignment or ticket ID when one exists, a stable evidence-request correlation ID, one precise
missing gate or proof, and the exact verified return route. The supervising agent may investigate only through its
already-declared capabilities and authorized routes. It must not acquire command, tracker, mutation, staffing, or other
authority merely to satisfy the request; it must not invent evidence, reopen scope, or create work solely for the reply.

For one `(assignmentOrTicketId, evidenceRequestCorrelationId)` pair, the supervising agent sends at most one complete
evidence reply to the exact lower-level role. The reply identifies the proof source, every unmet gate, and non-closure
status when applicable. If proof cannot be established, it sends one unavailable-evidence reply with the exact blocker
and next authorized owner. If the lower-level role repeats the same request after that reply, or asks again without a
new, materially different evidence gap, the supervising agent must not investigate or reply again. It reports the
possible cycle to the human with the correlation ID, request/reply facts, and unresolved gate. A distinct correlation ID
is insufficient by itself: a new attempt requires a materially different missing gate and does not reset an exhausted
request.

## Common readiness and contract inheritance

```mermaid
flowchart TD
  Actor["Actor: workflow initializer composes an agent"] --> Decision{"Decision: current common contract plus complete workflow-specific contracts are present and coherent?"}
  Decision -->|Allowed| Ready["Allowed: agent verifies composition and returns its exact readiness acknowledgement"]
  Decision -->|Prohibited| Blocked["BLOCKED: no partial initialization or conversational rule replacement"]
  Ready --> Outcome["Outcome: one initialized agent governed by base and workflow deltas"]
  Blocked --> Outcome
```

Every workflow agent extends this contract. The workflow supplies its additional team roles, capability grants,
communication topology, readiness tokens, and any stricter packet schema. The platform binding supplies runtime
configuration. The initializer composes the current
common contract with those workflow-specific sources. A changed common or workflow-specific contract requires the
workflow's declared reload or reinitialization path before an existing agent may rely on it.

## Required Admin and Judge roles

```mermaid
flowchart TD
  Actor["Actor: workflow declares managed agents"] --> Decision{"Decision: exactly one Admin infrastructure agent and one Judge oversight role are declared?"}
  Decision -->|Allowed| Route["Allowed: add workflow-specific roles around the required pair"]
  Decision -->|Prohibited| Blocked["BLOCKED: no missing, duplicate, routable Admin, or non-governance Judge"]
  Route --> Outcome["Outcome: administrable and governed workflow roster"]
  Blocked --> Outcome
```

Every agent-enabled workflow declares exactly one persistent human-facing `Admin` infrastructure agent and exactly one
persistent human-facing `Judge` oversight role. Canonical identities remain `admin` and `judge`; presentation labels are
owned by the selected platform binding.

Admin owns only workflow information and exact agent lifecycle administration. It remains outside the governed team and
every governed Team capability policy, is never an operational relay or product worker, and is preserved during governed-roster
reinitialization. Judge belongs to the governed roster, owns that workflow's protected rules and compliance oversight,
and remains subject to the workflow's human-approval, communication-firewall, validation, and publication gates. A
workflow may narrow these roles but must not transfer their common ownership to another role.

## Common initialization lifecycle

```mermaid
flowchart TD
  Actor["Actor: human requests workflow-agent lifecycle"] --> Decision{"Decision: exact profile, workflow, logical project, runtime scope, and workflow contracts validate?"}
  Decision -->|Allowed| Admin["Allowed: workflow entrypoint verifies or bootstraps exact Admin"]
  Decision -->|Prohibited| Blocked["BLOCKED: mutate no agent instance or scheduled trigger"]
  Admin --> Roster{"Decision: initialize, reinitialize, deactivate, inspect, or reload is exact and authorized?"}
  Roster -->|Allowed| Route["Allowed: apply workflow-owned lifecycle and verify readiness"]
  Roster -->|Prohibited| Blocked
  Route --> Outcome["Outcome: complete identity-bound roster or exact read-only status"]
  Blocked --> Outcome
```

The workflow-owned initialization entrypoint verifies or bootstraps Admin and performs all agent-instance mutation through
the selected platform adapter. Initialization
creates the complete declared governed roster. When a human requests full reinitialization including Admin, the active
Admin creates one successor Admin in the same runtime scope, verifies its exact returned instance ID, contract, source,
runtime configuration, and `ADMIN_READY` acknowledgement, and deactivates the predecessor only after the successor is ready.
The temporary overlap is identified exclusively by instance ID and grants neither Admin authority to contact the other for
ordinary work. A failed successor leaves the predecessor active. Reinitialization then reconciles roster-owned scheduled triggers,
deactivates the complete old governed roster, verifies an inactive barrier, creates one fresh complete roster, binds platform-returned
instance IDs, and verifies every readiness token. Human words such as archive, remove, or delete request deactivation;
the selected adapter defines the safest supported preservation mechanic. Partial generations, implicit profile selection, label-only identity,
hidden substitutes, and cross-project reuse are `BLOCKED`.

## Workflow extension boundary

```mermaid
flowchart TD
  Actor["Actor: workflow author extends common agents"] --> Decision{"Decision: additions are workflow-specific and preserve Admin, Judge, and lifecycle invariants?"}
  Decision -->|Allowed| Route["Allowed: declare team rows, capability ownership, routes, and tests"]
  Decision -->|Prohibited| Blocked["BLOCKED: no required-role removal or duplicated common rules"]
  Route --> Outcome["Outcome: independently reusable workflow agent contract"]
  Blocked --> Outcome
```

Each workflow declares its additional roles and exact team size in its own `agents/team.md`; only Judge appears in that
governed-team table from the required pair. The workflow selects common Admin and Judge roles through `agents.yml` and
supplies its initializer,
initialization contract, capability data, communication topology, focused tests, and any portable scheduled-trigger
requirements. Models, reasoning, concrete presentation, and transport remain platform-binding concerns. A workflow
without managed agents does not load this contract, but it must load it before
introducing any agent role or lifecycle behavior.
