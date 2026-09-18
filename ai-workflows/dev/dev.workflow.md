# Development Workflow

The development workflow follows the common [agent rules](../agents.md), the workflow [team policy](agents/team.md), and reusable role definitions in [`../_common/roles/`](../_common/roles/).

This file owns orchestration only: workflow order, applicable gates, and the supporting guides used by each step. Role permissions, responsibility ownership, communication boundaries, and lifecycle rules remain in their authoritative agent and team contracts and are not repeated here.

The workflow proceeds through the steps below in order. When one step completes successfully, it continues to the next applicable step without waiting for additional human instruction. A step cannot start until the required evidence from the previous applicable step exists.

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
   [delivery.md](guides/delivery.md) and the [deployment flow](flows/deployment.flow.md) when applicable.
9. Manager closes the ticket when applicable after all required evidence exists.
