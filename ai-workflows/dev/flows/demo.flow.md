# Demo flow

## Purpose

[Dev](../dev.workflow.md), acceptance when the plan/human request calls for a walkthrough or human confirmation.

## Entry

Known audience/outcome, candidate/environment, expected observations, prerequisite proof, and authorized setup/cleanup.
Demo is optional and does not replace tests or independent UI acceptance.

## Steps

1. Designer/Reviewer defines applicability and user outcomes; uses the existing [demo](../../../ai-commands/utility/demo/demo.command.md)
   package guidance.
2. Command Runner supplies required setup results and fixture provenance, reusing valid technical proof.
3. Designer/Reviewer specifies ordered actions, expected observations, limitations, and step recovery points.
4. Coder writes the product-owned walkthrough when it is a deliverable; returns the document matching that intent.
5. Designer/Reviewer coordinates human observations and records explicit confirmation where required.

## Exit

Return to the invoking acceptance checkpoint with demonstrated observations or a pending owner/action. A script,
automated success, or silence is not human acceptance. Preserve passed observations and fixture provenance; debug
same-scope failures, repeat affected proof, and resume at the failed step.
