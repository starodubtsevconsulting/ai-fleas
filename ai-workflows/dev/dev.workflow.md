# Development Workflow

The development workflow follows the common [agent rules](../agents.md) and reusable role definitions in [`../_common/roles/`](../_common/roles/).

The workflow proceeds through the steps below in order. When one step completes successfully, it continues to the next applicable step without waiting for additional human instruction. A step cannot start until the required evidence from the previous applicable step exists.

## Team
- Include: [team.md](agents/team.md)

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
8. Command Runner performs delivery or deployment only when explicitly requested and authorized. Use the:
 - [delivery.md](guides/delivery.md)
9. Manager closes the ticket after all required evidence exists.

## Workflow can

* Skip UI acceptance when visible UI behavior is not affected.
* Perform delivery or deployment only when explicitly requested and authorized.
* Initialize, reinitialize, or deactivate its complete configured agent team through the selected platform.

## Workflow cannot

* Skip a required gate or substitute one role's evidence for another role's responsibility.
* Treat implementation, automated tests, screenshots, review, or tracker state as a substitute for required visible UI acceptance.
* Automatically deploy or deliver completed work.
* Let one role inherit another role's responsibilities merely because it coordinates the workflow.
* Connect Judge to other workflow agents; Judge operates independently and communicates only with the human.
