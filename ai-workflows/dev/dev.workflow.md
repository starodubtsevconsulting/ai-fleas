# Development workflow

Visible agent team: [team.md](agents/team.md).
Agent instantiation: [agents.yml](agents.yml).
Team capability, communication, and lifecycle policy: [team.md](agents/team.md).
Elastic capacity mechanics: [elastic-agent-pool.md](agents/elastic-agent-pool.md).
Workflow agents: [agents.md](../agents.md).

Use this only for an explicitly requested development workflow. Ordinary work
uses the cost-first `AGENTS.md` instructions.

## Agent binding

This workflow binds the exact roles selected by [`agents.yml`](agents.yml) directly to their complete reusable
definitions under [`../_common/roles`](../_common/roles/). It supplies the Dev project, Team policy, routing, command
map, lifecycle context, and any explicit Dev override during initialization. There is no
intermediate `dev/agents/<role>.md` binding layer; `agents/` contains workflow infrastructure only.

### Judge override

The Dev Judge operates only inside the initialized Dev workflow instance. It must not contact or use Designer/Reviewer,
Manager, Coder, Command Runner, UI Acceptance Tester, Proxy Coder, or any substitute to review, approve, relay, validate,
publish, execute, or supply evidence for Judge work. It reports only to the human; the Dev dependency map therefore has
no edge to or from Judge. Protected publication remains a direct Judge action only after every common-role gate and exact
human authorization pass.

After a Dev governance change, Judge runs these focused commands on the exact diff before disclosure:

- `node --test ai-workflows/dev/agents/diagram-first-validator.test.mjs`
- `node --test ai-workflows/dev/agents/visible-role-routing.test.mjs`
- `bash ai-workflows/workflow-agents.test.sh`

## Required delivery gates and role mapping

```mermaid
flowchart TD
  Intake["Manager: ticket resolution and required staffing"] --> Spec["Designer/Reviewer: requirements, acceptance criteria, and specification"]
  Spec --> Design["Designer/Reviewer: implementation design and exact Coder packet"]
  Design --> Implement["Coder: product and test-source implementation"]
  Implement --> Automated["Command Runner: focused and automated validation commands"]
  Automated --> Review["Designer/Reviewer: independent technical review"]
  Review --> UiDecision{"Decision: visible UI behavior affected?"}
  UiDecision -->|Yes| Ui["UI Acceptance Tester: independent visible acceptance"]
  UiDecision -->|No, with reason| Accept["Designer/Reviewer: assignment acceptance"]
  Ui --> Accept
  Accept --> DeliveryDecision{"Decision: delivery or deployment explicitly requested?"}
  DeliveryDecision -->|Yes| Delivery["Command Runner: authorized delivery or deployment mechanics"]
  DeliveryDecision -->|No| Close["Manager: evidence-gated ticket closure"]
  Delivery --> Close
```

This is a specification-driven development flow: ticket context and staffing precede the specification; the accepted
specification and design govern implementation; implementation is proven through automated validation, independent
technical review, and conditional visible acceptance before delivery or closure. The development workflow owns this
order and maps each gate to its executing role. A coordinating role does not inherit another gate owner's capability.
Designer/Reviewer records the applicable gates before implementation, dispatches each gate to its mapped initialized
visible role, and advances only after receiving the matching terminal receipt.

| Gate                                                                            | Required owner       | Required evidence                                                                                              |
| ------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Ticket resolution and required staffing                                         | Manager              | Exact ticket ID, lifecycle facts, and initialized worker task IDs.                                             |
| Requirements, acceptance criteria, and implementation design                    | Designer/Reviewer    | Exact specification, scope, acceptance criteria, and implementation packet.                                    |
| Product and test-source implementation                                          | Coder                | Changed paths and implementation receipt.                                                                      |
| Focused, unit, integration, build, and automated end-to-end execution           | Command Runner       | Exact commands, results, and artifacts returned to the verified caller.                                        |
| Independent technical review                                                    | Designer/Reviewer    | Evidence-based review decision against the design and automated results.                                       |
| Visible end-user acceptance when visible UI behavior is affected                | UI Acceptance Tester | Matching ticket/change receipt with tested URL or build, visible journey, observations, result, and artifacts. |
| Assignment acceptance                                                           | Designer/Reviewer    | Every applicable preceding receipt, or an explicit reason a conditional gate is not applicable.                |
| Delivery or deployment mechanics, only when explicitly requested and authorized | Command Runner       | Exact registered command, authorization, result, state change, and cleanup evidence.                           |
| Ticket closure                                                                  | Manager              | Verified implementation, validation, review, conditional UI acceptance, and authorization evidence.            |

Automated end-to-end output, generated screenshots, Coder evidence, or Designer/Reviewer interaction never substitutes
for the UI Acceptance Tester receipt when visible UI behavior is affected. Designer/Reviewer must not execute automated
tests or visible acceptance itself. A missing, stale, foreign, failed, or mismatched required receipt blocks advancement
at the current gate; later gates and ticket closure must not proceed.

There is currently no Deployer role. Delivery and deployment are conditional rather than automatic, and their mechanical
execution maps to Command Runner only after the human explicitly requests and authorizes that effect. Designer/Reviewer
owns neither deployment execution nor permission to infer it. Manager maintains ticket and staffing lifecycle at the
entry and closure boundaries without becoming a proxy between the delivery roles.

## Helper prompts

The profile is supplied from outside this reusable workflow. See
[Project sources and profiles](../README.md#project-sources-and-profiles). Under the conventional logical-project name
`<profile-id>-dev`, the segment before the final hyphen is the profile ID and `dev` is this workflow ID.

| User prompt                                                                             | Scope resolution                                                     | Expected result                                                      |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Initialize <profile-id>-dev workflow` or `Initialize <profile-id>-dev workflow agents` | Resolve the externally supplied profile and validate workflow `dev`. | Create the complete declared team only when none is active.          |
| `Initialize agents` from a task already bound to `<profile-id>-dev`                     | Use the task's verified logical-project binding.                     | Create the complete declared `<profile-id>-dev` team.                |
| `Initialize dev workflow` from an unbound task                                          | Workflow is known but profile is missing.                            | Ask which profile and perform zero mutation.                         |
| `Reinitialize <profile-id>-dev workflow`                                                | Resolve the exact externally bound logical project.                  | Archive the complete active team, then create a fresh complete team. |
| `Archive <profile-id>-dev workflow`                                                     | Resolve the exact externally bound logical project.                  | Archive the complete active team and create nothing.                 |
| `Delete` or `remove all <profile-id>-dev agents`                                        | Treat delete/remove as archive aliases.                              | Archive the complete active team; preserve history.                  |

Case, spaces, and the conventional omitted hyphen may be normalized only when they resolve to exactly one configured logical
project. Misspellings that could identify more than one scope are `BLOCKED`. A task
may omit the profile only when its runtime identity is already bound to exactly one validated logical project.

## Router

- For explicit Codex role-chat setup, read
  [workflow agent initialization](agents/init.md) and its
  [live test](agents/init-live-test.md).
- For an explicitly authorized isolated capacity test, use
  [Elastic Agent Pool live acceptance](dev-elastic-agent-pool.live-test.md).
- For implementation or bug fixes, follow the required delivery gates above and read `guides/coding.md` only when the
  implementation gate begins.
- For an explicit testing task, apply the matching validation or visible-acceptance gate above and read
  `guides/testing.md` only.
- For a commit, push, PR, release, or deployment request, read
  `guides/delivery.md` only.
- Never preload guides. If the action changes, load the next one then.
