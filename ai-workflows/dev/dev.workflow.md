# Development Workflow

The development workflow follows the common [agent rules](../agents.md), the workflow [team policy](agents/team.md), and reusable role definitions in [`../_common/roles/`](../_common/roles/).

This file owns orchestration only: workflow order, applicable gates, and the supporting guides used by each step. Role permissions, responsibility ownership, communication boundaries, and lifecycle rules remain in their authoritative agent and team contracts and are not repeated here.

The executable projection is [dev.workflow-map.json](dev.workflow-map.json), with a generated [Mermaid view](dev.workflow-map.mmd). Map events represent the completion evidence and applicability decisions owned by the numbered steps and linked flow exits. Manager recovery returns to the recorded interrupted stage; a human planning or demo decision remains pending until explicitly resolved.

The Router uses these stage-specific capability IDs to select one entry stage and one owner. They refine the numbered steps and linked flows; they do not expand the permissions in the [role capability matrix](agents/role-capability-ownership.csv).

| Stage | Capability ID | Owner |
| --- | --- | --- |
| `target_resolution` | `target_resolution` | Manager |
| `planning` | `requirements` | Designer / Reviewer |
| `implementation` | `implementation` | Coder |
| `verification` | `verification_coordination` | Designer / Reviewer |
| `test_execution` | `mechanical_execution` | Command Runner |
| `debugging` | `debugging_diagnosis` | Designer / Reviewer |
| `independent_review` | `technical_review` | Designer / Reviewer |
| `ui_acceptance` | `visible_ui_acceptance` | UI Acceptance Tester |
| `final_acceptance` | `final_acceptance` | Designer / Reviewer |
| `demo` | `demo_coordination` | Designer / Reviewer |
| `delivery` | `source_control_mechanics` | Command Runner |
| `deployment_verification` | `deployment_verification` | Designer / Reviewer |
| `deployment_debugging` | `deployment_debugging` | Designer / Reviewer |
| `closure` | `ticket_closure` | Manager |
| `complete` | `completion_record` | Manager |
| `recovery` | `recovery_coordination` | Manager |

The common [Workflow Router runtime](../_common/runtime/workflow-router.md) may execute these ordered steps. This file is
the authoritative program: each step declares the role that performs it, and applicable flows declare finer-grained
role assignments. The Router resolves each declared role to an exact runtime instance, dispatches the next step, and
routes `blocked`, `depleted`, or `unclear` to Manager with the interrupted step preserved. It does not review work,
select a recovery, or replace verified identity, delivery, and communication contracts.

The workflow proceeds through the steps below in order. When one step completes successfully, it continues to the next applicable step without waiting for additional human instruction. A step cannot start until the required evidence from the previous applicable step exists.

## Entry and resume status

Before the first mutation in a new or resumed assignment, the human-facing workflow endpoint reports:

- the verified profile, workflow, logical project, saved-project ID, and operating role;
- which roles use the registered roster, which Admin emulates, and which use real execution delegates;
- the current numbered workflow step or direct-administration phase;
- the plan or recovery point, including verified completed evidence and unresolved work; and
- the next applicable gate, owner, and expected proof.

An emulating Admin names the roles it is emulating and never presents emulated work as independent review, Judge
approval, Command Runner execution, or UI acceptance. Read-only questions may use a compact status. Missing trusted
identity or scope blocks mutation instead of silently entering an implementation phase.

## Admin execution through the configured Coder route

Apply this route in either case: the human directly asks Admin to delegate a coding task, or the human
asks Admin to do Dev work and the selected profile sets `execution_delegates.dev.coder.routing_policy: all-coder-work`.
Under that policy, route every Coder-owned implementation task, including small tasks, until the profile policy changes.

For each routed task:

1. Admin MUST state which roles it emulates and identify the selected Coder route before the first mutation.
2. Before step 3, Admin MUST settle the authorized project, work target, requirements, file scope, allowed effects, and
   completion evidence.
3. Admin MUST resolve preferred `execution_delegates.dev.coder` and run its declared launcher with
   `check --project <authorized-project-id>`. A failed
   check blocks the Coder task. Admin MUST NOT fall back to a GPT roster Coder.
4. Admin MUST send the bounded implementation assignment with that launcher's
   `run --project <same-project-id> "<assignment>"` action and wait for its terminal
   result. Admin MUST NOT edit the same assigned files while Coder is working.
5. Admin MUST inspect the returned work and evidence. For a proposal-only route, Admin applies accepted code to the
   visible checkout and inspects the resulting diff. Testing, independent review, UI acceptance, and delivery remain
   separate gates. A failed or missing result blocks progression.

This route is neither Router dispatch nor utility-subagent work. A profile may authorize Designer / Reviewer to use
the same bounded Coder route while retaining ownership of design and independent review.

## Workflow

1. Manager resolves the work target, ticket when applicable, and required agents.
2. Designer / Reviewer defines requirements, acceptance criteria, and implementation design through the
   [planning flow](flows/planning.flow.md).
3. Coder implements the product and test changes. Use the:
   - [coding.md](guides/coding.md)
   - [domain-driven-design.md](guides/strategies/domain-driven-design.md)
   - [test-driven-development.md](guides/strategies/test-driven-development.md)
   Update affected durable documentation through the [documentation flow](flows/documentation.flow.md).
4. Designer / Reviewer coordinates required verification through the [testing flow](flows/testing.flow.md);
   Command Runner runs automated checks. Failed gates enter the [debugging flow](flows/debugging.flow.md).
5. Designer / Reviewer independently reviews the implementation and applicable documentation.
6. UI Acceptance Tester performs independent visible acceptance when UI behavior is affected, coordinated through
   the [testing flow](flows/testing.flow.md).
7. Designer / Reviewer accepts the completed assignment when all required checks pass, including the [demo flow](flows/demo.flow.md) when the plan, human request, acceptance needs, or delivery context calls for demonstration. Demo is an applicability-based acceptance step: common for user-visible/client-facing changes, optional when it adds no useful evidence beyond existing verification.
8. Command Runner performs delivery or deployment only when explicitly requested and authorized. Use
   [delivery.md](guides/delivery.md), including its canonical source-control provenance gate, and the
   [deployment flow](flows/deployment.flow.md) when applicable.
9. Manager closes the ticket when applicable after all required evidence exists.
