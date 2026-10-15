# UX method: Apply and review action-first, outcome-visible UX

## Inputs

Load the selected profile's UX instructions, the [UX policy](../../policy/action-first-ux.md), the [selected strategy](../../strategies/ux/action-first-outcome-visible.md) or explicit alternative, the affected user task/routes, current interface, and delivery scope.

This is a validation method. Applicable design methods, such as [Start before sign-in](start-before-sign-in.md), define the experience; their platform derivatives add implementation guidance. Record the selected platform and methods in the review context.

## Procedure

1. **Establish the task and baseline.** Identify the intended user, useful action, expected result, required context, and current obstacles. Inspect the affected journey on phone and desktop; include supported languages and relevant states.
2. **Choose the design approach.** Apply the selected strategy to decide the entry action, concrete demonstration, explanation timing, and feedback. Record justified exclusions and policy-compliant alternatives. Do not expand a component change into an unrequested site redesign.
3. **Define acceptance and hand off.** Carry the policy outcomes and selected design decisions into the bounded implementation handoff. Name the relevant loading, success, error, recovery, setup/authentication, and progress-preservation checks.
4. **Implement and verify through existing owners.** Use the selecting workflow's implementation, automated checks, review, and independent visible acceptance gates. This method does not assign new capabilities or substitute one role for another.
5. **Record observations.** Record the action attempted and observed result against each applicable criterion, with pass, fail, or not run and the reason/next owner.
6. **Resolve and return.** Correct failed criteria and repeat the affected checks. Return candidate-bound evidence to the parent workflow; do not claim completion while a required gate is unresolved.

## Evidence and output

Record the route, environment, candidate revision, language, viewport, and relevant states. Include:
- whether the first task is visible and can be started without developer explanation or unnecessary setup;
- whether the demonstration communicates benefit and distinguishes current, illustrative, and planned behavior;
- when identity/context and essential decision information appear, and whether recoverable progress survives transitions;
- observed feedback and recovery, accessible labels/non-color meaning, keyboard access, and responsive behavior;
- exclusions, failures, untested behavior, and required independent acceptance receipts.

Screenshots support visual findings but do not prove interaction behavior or user comprehension. Distinguish reviewer inspection from observed usability feedback.

For Dev work, use the existing [UX/UI flow](../../../dev/flows/ux-ui.flow.md) and [review record](../../../dev/guides/ux-ui-review-template.md). Other workflows use their own owners and evidence surface while retaining the same policy and selected strategy. Output is a review record and design decisions, not a new workflow or runtime setting.
