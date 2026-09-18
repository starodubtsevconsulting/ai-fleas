# Demo flow

## Purpose

[Dev](../dev.workflow.md), acceptance when the plan/human request calls for a walkthrough or human confirmation.

## Entry

Known audience/outcome, candidate/environment, expected observations, prerequisite proof, and authorized setup/cleanup.
Demo is optional and does not replace tests or independent UI acceptance.

## Steps

1. Designer/Reviewer defines applicability and user outcomes; uses the portable [demo command](../../../ai-commands/development/demo/demo.command.md) to discover/inspect the project-owned demo package and choose the applicable execution mode.
2. Designer/Reviewer determines whether an existing product-owned demo scenario is sufficient. If not, Coder creates or updates the scenario using the demo contract: semantic Markdown plus deterministic helpers where useful.
3. Command Runner supplies required deterministic setup/fixture results and provenance, reusing valid technical proof.
4. Designer/Reviewer uses `demo inspect` / `demo guide` / `demo run` as applicable to coordinate ordered deterministic and human-visible actions, expected observations, limitations, evidence, and recovery points.
5. When UI-visible behavior is part of the scenario, use an authorized visual/browser/computer-use capability through the demo contract; do not require one UI technology merely for demonstration.
6. Designer/Reviewer records demonstrated observations and explicit human confirmation where required. Automated demo evidence supports but does not impersonate human acceptance.

## Exit

Return to the invoking acceptance checkpoint with demonstrated observations or a pending owner/action. A script,
automated success, or silence is not human acceptance. Preserve passed observations and fixture provenance; debug
same-scope failures, repeat affected proof, and resume at the failed step.
