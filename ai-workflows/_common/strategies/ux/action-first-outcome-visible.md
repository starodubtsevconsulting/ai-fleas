# UX strategy: Action-first, outcome-visible

## Objective and policy

Help people understand a product through a useful action and a concrete view of what they obtain. This strategy implements the [understandable action and value policy](../../policy/action-first-ux.md).

## Platform scope

The strategy applies across web, desktop, mobile, and other interfaces. Select applicable design methods with platform-specific implementation guidance; the strategy's intent remains shared.

## Approach

- **Lead with a useful action.** Make the starting task prominent and available with the minimum necessary context. Where identity or setup is required, request it at the relevant step and preserve progress where feasible.
- **Make the outcome visible.** Place a representative product view, worked example, real content, or interactive demonstration near the action or in the next natural section. Make the benefit understandable without requiring the visitor to imagine it from a feature list.
- **Explain progressively.** Introduce terminology, setup, and detailed help when they become useful. Keep optional background available; keep essential decision information at the decision point.
- **Keep the next step clear.** Give each stage a clear primary action, understandable feedback, and a way to recover. Secondary paths may serve different user goals without competing equally for attention.

## Context and tradeoffs

Choose the presentation from the user's task and expected result. This strategy does not prescribe an upload control, chart, color palette, carousel, or fixed page layout. Reading useful content can itself be the first action; a representative item and an obvious continuation may suffice.

Required orientation or consent may precede a consequential action. Compare proposed simplification against the policy before removing explanation. Treat a change in approach as a design decision with a reason, rather than silently dropping a policy outcome.

## Design methods

Use [Start before sign-in](../../methods/ux/start-before-sign-in.md) when a useful, safe preparatory action can precede authentication. Its [web derivative](../../methods/ux/start-before-sign-in/web.md) specifies browser mechanics. Native desktop/mobile derivatives and layout guidance can follow concrete use cases; do not claim they are implemented merely because the common method exists.

## Application and evaluation

Apply the [review method](../../methods/ux/action-first-review.md) through the existing workflow. Evaluate how easily a person can identify the next action, recognize its benefit, and complete the affected journey. Record observed usability feedback separately from reviewer inspection; do not invent conversion targets or claim comprehension from a screenshot alone.

Profiles select this strategy through their existing instructions/specification. Selection is an instruction-level default, not a new runtime configuration key or proof that a running agent reloaded it.
