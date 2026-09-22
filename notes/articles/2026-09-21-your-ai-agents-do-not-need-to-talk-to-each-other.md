# Your AI Agents Do Not Need to Talk to Each Other

*Sometimes the simplest way to coordinate an AI team is to stop making every agent coordinate.*

When I first started designing teams of AI agents, one question seemed unavoidable:

**Who is allowed to talk to whom?**

A Coder might need a Manager. A Reviewer might return work to a Coder. A Designer might ask a specialist for help. Some
roles could initiate a request; others could only reply. Before long, the system had a communication matrix that looked
less like software and more like an organizational chart.

The matrix looked rigorous. It also duplicated something the system already had:

**the workflow.**

## The workflow already knows what happens next

A generic development workflow might look like this:

> Plan → Implement → Validate → Review → Accept → Deliver

Each stage already declares its owner. A planning role owns the plan, an implementation specialist owns the change, a
validation role runs checks, and an independent reviewer owns review. Those are intentionally generic stage owners,
not a claim about the exact role mapping in any particular workflow.

When implementation finishes, the Coder does not need to discover the Reviewer, know its task identifier, or decide how
to contact it. The workflow already declares the next stage and the role assigned to it.

That changes the coordination problem. Instead of teaching every agent how to communicate with every other agent, the
system can teach the workflow runtime how to move a bounded envelope.

At a conceptual level, the implementation role only needs to return something like:

```text
Stage: implementation
Event: completed
Artifact: <reference>
Evidence: <reference>
```

That sketch is deliberately abbreviated. A real Router result envelope must also repeat the profile, workflow, logical
project, and runtime-scope coordinates; Router runtime and workflow-run identities; stage and transition sequence; exact
role and instance identity; and bounded artifact, evidence, and handoff references.

The workflow decides what that event means. The runtime moves execution to the role declared by the next stage.

## The workflow is the program; the Router is the runtime

This distinction helped me name the missing component.

The workflow is declarative. It defines stages, assigned roles, transitions, and exception paths. It says what should
happen.

The **Router** executes that definition. It keeps the current stage, validates an event, resolves the next role to one
exact runtime endpoint, delivers a bounded envelope, and records the transition.

The Router is not another workflow. It is also not another team member.

It does not design, code, review, approve, or manage. It answers three deliberately small questions:

> Where is this workflow run now?

> What declared event just occurred?

> Where does the workflow say execution goes next?

That is runtime behavior, not domain reasoning.

## Do not build another brain

It would be easy to make the Router an expensive reasoning agent.

The Coder finishes. The Router reads the entire implementation, rereads the design, decides whether the code is good,
and eventually concludes that a Reviewer should inspect it.

At that point the Router has become another Reviewer—except now every transition depends on it.

A Router should instead receive the smallest contract-complete result envelope:

```text
profileId: <profile>
workflowId: <workflow>
logicalProjectId: <logical-project>
runtimeScopeId: <runtime-scope>
routerRuntimeId: <router-runtime>
workflowRunId: <workflow-run>
stageId: implementation
transitionSequence: <expected-sequence>
role: <workflow-assigned-role>
instanceId: <exact-runtime-instance>
event: completed
artifactRefs: [<bounded-reference>]
evidenceRefs: [<bounded-reference>]
handoffRefs: [<bounded-reference>]
```

It validates the envelope and consults the workflow definition. Artifact bodies remain with the roles that are
authorized to interpret them.

The intelligence stays where it belongs:

- specialists perform domain work;
- the workflow defines order and ownership;
- the Router advances state.

The less the Router has to understand, the easier it is to test.

## Agents return to the Router, not to one another

This produces a different topology from the usual picture of an “agent team.”

```text
Workflow Router ──assignment──▶ Planner
Planner ──result event────────▶ Workflow Router

Workflow Router ──assignment──▶ Coder
Coder ──result event──────────▶ Workflow Router

Workflow Router ──assignment──▶ Reviewer
Reviewer ──result event───────▶ Workflow Router

Workflow Router ──declared exception transition only──▶ Manager
Manager ──recovery result event───────────────────────▶ Workflow Router

No endpoint-to-endpoint edges
```

The agents do not form a social network. They are independently addressable execution endpoints for roles in a process.

For each dispatch, an endpoint receives one stage assignment from the Router and returns one declared result event to
that same Router. The next endpoint does not receive a story about what happened. It receives a new bounded envelope
containing the references required by its own stage.

This removes a surprising amount of routing policy. The capability and authority matrix remains necessary and
authoritative for what each role may do. What disappears from primary orchestration is a second matrix describing every
possible peer conversation.

Capability answers:

> What may this role do?

The workflow answers:

> Which role owns this stage?

The Router answers:

> Which exact initialized endpoint currently represents that role?

Those are different questions. Keeping them separate makes the system much easier to reason about.

## Exceptional reasoning should remain exceptional

Normal workflows are not always successful. An agent may become blocked, exhaust its context, receive an ambiguous
requirement, or discover that a required artifact is missing.

That does not mean the Router should diagnose the problem.

The workflow can declare exception events such as:

```text
blocked
depleted
unclear
```

Those events transition to a Manager stage while preserving the interrupted stage as the resume point. The Manager can
clarify the plan, arrange capacity, or decide which authorized recovery applies. When recovery completes, the workflow
determines what happens next.

This keeps the separation clear:

**Router owns ordinary state transitions.**

**Manager owns declared exceptional coordination.**

**Specialists own domain decisions and evidence.**

The Manager can understand the plan without spending its time carrying every routine envelope.

## Identity still needs an exact binding

Removing peer communication does not remove the need for identity. In fact, exact endpoint identity becomes more
important because the Router must know that a runtime task really represents the role selected by the workflow.

The portable contract does not prescribe a candidate lifecycle or a readiness-token protocol. It requires something
narrower: before dispatch, the platform binding must resolve the workflow-assigned role to one exact initialized runtime
instance whose role and workflow coordinates match the next stage.

```text
workflow declares next role
           ↓
binding resolves one exact initialized instance
           ↓
verify role and workflow coordinates
      ┌────┴────┐
      │         │
    match     mismatch or missing identity
      │         │
      ▼         ▼
dispatch      keep current stage and history unchanged
confirmed
      │
      ▼
commit transition and target-instance receipt
```

Role resolution and delivery are transactional: only confirmed delivery commits the transition. Missing identity,
failed delivery, or mismatched scope leaves the current stage and history unchanged. A display name is not identity.

## Hidden does not mean impossible to debug

The Router should not appear as another teammate merely because humans need observability.

An optional host- or platform-specific administrative inspector can expose:

```text
Workflow run: <id>
Current stage: review
Assigned role: reviewer
Assigned instance: <runtime-id>
Previous transition: implementation → review
Status: running
```

It can also show failed delivery, rejected events, endpoint receipts, and concise transition history. This inspector is
an infrastructure surface, not the workflow Admin agent, and its availability or presentation is not guaranteed by the
portable Router contract. It makes the runtime observable without turning it into a conversational participant.

The distinction is useful:

**Agents are participants. Infrastructure is inspectable.**

A host may show active roles and Router state in such an inspector, or expose the same state through another
administrative mechanism.

## Keep every Router inside one boundary

A Router moves references and controls which endpoint receives the next stage. It therefore belongs inside one exact
workflow scope.

A runtime should be bound to a profile, workflow, logical project, and runtime scope. Every event repeats those
coordinates. A missing or mismatched coordinate is rejected before the Router reads the payload or changes state.

Two organizations may use the same public workflow definition without sharing runtime state, endpoint bindings,
artifacts, or history. Reuse belongs in the workflow contract. Isolation belongs in each runtime instance.

This is not merely an implementation detail. The component responsible for moving context is precisely the component
that must be strict about which context it can see.

## Maybe agents need less organization

Specialized roles still need boundaries. Reviews still need independence. Dangerous effects still need explicit
authority. Work still needs evidence.

But orchestration can be much simpler than a web of agents talking to one another.

You may not need every agent to know every other agent.

You may not need a communication matrix that recreates an artificial organization.

You probably do not need an intelligent manager reasoning about every ordinary transition.

You need a declarative workflow. You need explicit, reference-based handoffs. You need specialists with narrow
authority. And between them, you need something intentionally boring that knows what happens next.

That is the Router.

The less domain judgment it performs, the easier it is to verify.

---

## Sources and provenance

This article is an original synthesis of a locally verified AI Fleas design proposal recorded in
`ai-workflows/_common/runtime/workflow-router.md`, `ai-workflows/dev/dev.workflow.md`,
`ai-workflows/dev/agents/shared-execution-routing.md`, and `ai-workflows/_common/policy/access-matrix.md`. As of public
repository commit [`8fc7a1886c29b0befff776794abb8d808cfa55fe`](https://github.com/starodubtsevconsulting/ai-fleas/tree/8fc7a1886c29b0befff776794abb8d808cfa55fe),
the Router contract was not published and the public versions of the other files still described the older
architecture. The article therefore presents a local, unpublished design—not the current public architecture—and uses
no private profile, client, organization, machine, task, credential, or operational runtime data.
