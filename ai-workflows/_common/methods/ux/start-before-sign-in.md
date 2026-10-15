# UX design method: Start before sign-in

## Relationship and scope

This platform-neutral design method applies the [Action-first, outcome-visible strategy](../../strategies/ux/action-first-outcome-visible.md) under the [UX policy](../../policy/action-first-ux.md). It can serve web, desktop, mobile, or other interfaces where a useful preparatory action is possible before authentication. It is conditional, not a requirement to move every action before login.

The [UX review method](action-first-review.md) validates the resulting journey. This document defines the experience; platform derivatives define implementation guidance.

## Applicability decision

Identify a meaningful first action that needs neither account access nor an irreversible effect: selecting a document, preparing a draft, or choosing an input, for example. Distinguish preparation from account-dependent execution.

If the platform cannot safely preserve that preparation, or authorization is needed before any useful action, use the minimum necessary sign-in/orientation step first. Record the reason and resume the intended task after login. Do not simulate a usable control that only leads to an unrelated signup wall.

## Common sequence

1. **Start the task.** Offer a specific useful action and explain what will happen. Indicate when the next step requires sign-in.
2. **Stage the input.** Preserve the selection or draft temporarily under an explicit storage, retention, and discard policy. Show its name or a suitable summary and status. Local preparation does not imply upload, persistence, processing, or completion.
3. **Request identity when required.** Ask for sign-in/signup to continue at the first account-dependent step. Preserve the pending task through the supported authentication transition.
4. **Restore the pending task.** After successful sign-in, show the staged input, current identity, and required destination/context. Ask only for missing context; do not require the same selection or typing again.
5. **Complete deliberately.** Obtain the confirmation required by the task, then perform the authorized save or processing step. Verify the result and show a truthful success or recoverable failure.
6. **Release temporary state.** Clear it after confirmed completion, explicit discard, or expiry. Failed operations retain recoverable state only within the declared policy. Retries must not create duplicate persistent effects.

## Continuity and privacy

Define behavior for sign-in cancellation/failure, account switching, logout, interrupted navigation, expiry, and retry. Bind pending state to the intended journey; do not automatically transfer it into a different account or destination. Do not expose a previous user's staged input to a later user on a shared device. Offer discard and explain expired/unrecoverable state before asking for replacement input.

Authentication and authorization checks still precede protected reads, uploads, processing, and account writes. The default is local preparation with no input transmission before authentication; a different product flow needs an explicit data-handling design and appropriate user authorization.

## Platform derivatives

A derivative must reference and inherit this common method, name its platform and applicability, and specify input controls, temporary storage, authentication continuation, cleanup, and recovery. It must identify any supported and unsupported transitions. It adds mechanics without copying or weakening the common contract.

- [Web implementation guidance](start-before-sign-in/web.md) — defined now.
- Desktop and mobile guidance — deferred until a concrete application journey justifies their mechanics. This method may already apply there, but no native implementation is claimed.

Layout patterns and reusable components can be linked later when supported by real implementations. They are not prerequisites for adopting this method.

## Acceptance

Through the selecting workflow, exercise the first action, authentication continuation, context selection, completion, cancellation, expiry, retry, and account-isolation behavior relevant to the change. Record observed state at each boundary and any unsupported case. Use the [review method](action-first-review.md); a demonstration alone is insufficient proof of persistence or processing.
