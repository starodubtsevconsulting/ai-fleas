# Development Workflow

The development workflow follows the common [agent rules](../agents.md), the workflow [team policy](agents/team.md), and reusable role definitions in [`../_common/roles/`](../_common/roles/).

This file owns orchestration only: workflow order, applicable gates, and the supporting guides used by each step. Role permissions, responsibility ownership, communication boundaries, and lifecycle rules remain in their authoritative agent and team contracts and are not repeated here.

The workflow proceeds through the steps below in order. When one step completes successfully, it continues to the next applicable step without waiting for additional human instruction. A step cannot start until the required evidence from the previous applicable step exists.

## Workflow

1. Manager resolves the ticket and required agents.
2. Designer / Reviewer defines requirements, acceptance criteria, and implementation design.
3. Coder implements the product and test changes. Use the:
   - [coding.md](guides/coding.md)
   - [domain-driven-design.md](guides/strategies/domain-driven-design.md)
   - [test-driven-development.md](guides/strategies/test-driven-development.md)
4. Command Runner runs the required automated validation.
5. Designer / Reviewer independently reviews the implementation.
6. UI Acceptance Tester performs independent visible acceptance when UI behavior is affected.
7. Designer / Reviewer accepts the completed assignment when all required checks pass.
8. Command Runner performs delivery or deployment only when explicitly requested and authorized. Use [delivery.md](guides/delivery.md).
9. Manager closes the ticket after all required evidence exists.
