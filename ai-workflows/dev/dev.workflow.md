# Development Workflow

The development workflow follows the common [agent rules](../agents.md), the workflow [team policy](agents/team.md), and reusable role definitions in [`../_common/roles/`](../_common/roles/).

This file owns orchestration only: workflow order, applicable gates, and the supporting guides used by each step. Role permissions, responsibility ownership, communication boundaries, and lifecycle rules remain in their authoritative agent and team contracts and are not repeated here.

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

## Admin execution with a real Coder delegate

Apply this route in either case: the human directly asks Admin to delegate a coding task to Hermes coder, or the human
asks Admin to do Dev work and the selected profile sets `execution_delegates.dev.coder.routing_policy: all-coder-work`.
Under that policy, route every Coder-owned implementation task, including small tasks, until the profile policy changes.

For each routed task:

1. Admin MUST state which roles it emulates and identify any real delegate before the first mutation.
2. Before step 3, Admin MUST settle the authorized project, work target, requirements, file scope, allowed effects, and
   completion evidence.
3. Admin MUST resolve preferred `execution_delegates.dev.coder` and run its declared launcher with
   `check --project <authorized-project-id>`. A failed
   check blocks the Coder task. Admin MUST NOT fall back to local Coder emulation or a GPT roster Coder.
4. Admin MUST send the bounded implementation assignment with that launcher's
   `run --project <same-project-id> "<assignment>"` action and wait for its terminal
   result. Admin MUST NOT edit the same assigned files while Coder is working.
5. Admin MUST inspect the returned diff and evidence, name Coder as real delegated execution, and keep testing,
   independent review, UI acceptance, and delivery as separate gates. A failed or missing result blocks progression.

This Admin-to-Coder route is neither Router dispatch nor utility-subagent work. It grants no peer route to workflow Agents.

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
