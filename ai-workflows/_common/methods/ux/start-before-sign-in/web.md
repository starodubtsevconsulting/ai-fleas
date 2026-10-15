# Web derivative: Start before sign-in

## Inherits

Apply the common [Start before sign-in design method](../start-before-sign-in.md), [UX strategy](../../../strategies/ux/action-first-outcome-visible.md), and [UX policy](../../../policy/action-first-ux.md). This derivative supplies browser implementation guidance, not a separate policy or a claim that an application already implements it.

## Document-intake example

Offer **Choose or drop a document** before login. Selection stages the file locally. Then request sign-in/signup, return to the pending document, obtain the required workspace/business context, and explicitly save. Show distinct selected-locally, saving, saved, and processing/review states only when true.

Do not promise extraction, payment recognition, accounting conclusions, or processing merely because a file was selected or saved.

## Implementation guidelines

- Use an accessible file picker as the baseline on desktop and mobile web; drag and drop is an enhancement. Give unsupported type/size and storage errors at selection time.
- Prefer memory-only staging when the supported authentication flow preserves it. Persistent browser staging needs a demonstrated continuity requirement and an explicit data-handling design. Define the storage mechanism and lifetime before implementation. Browser memory works only for transitions that preserve it. For a full-page authentication redirect or supported reload recovery, use suitable browser-held storage, such as IndexedDB, when allowed by the product's data-handling design. Do not describe browser storage as durable, encrypted, or private merely because it is local.
- Define a finite expiry and a visible discard control. Do not impose the same duration on every product. Handle quota limits, blocked storage, private-browsing behavior, and unavailable file data without claiming the selection was preserved.
- Keep file bytes and document content out of URLs, authentication return parameters, analytics, and logs. Do not send them to the server before authentication under this method's default. Validate any return route against the application's authorized same-origin destinations.
- Use an opaque journey reference when needed to reconnect local pending state after authentication. A reference is not authorization. Define multiple-tab/pending-task behavior so one task cannot silently replace another.
- Before showing or committing restored input, enforce the common account-switch/logout/shared-device rules. Ask for the destination context only when required and verify account/tenant authorization on the server. Selection before login does not bypass authenticated upload validation.
- Clear expired or discarded state and clear completed state only after a verified result. Handle cancelled login, failed redirect, server failure, uncertain completion, and retries with recovery and duplicate-effect protection.
- If browser limits prevent continuity, explain it and provide an explicit fallback. Do not silently discard a file or require another selection after promising preservation.

## Verification and future guidance

Test supported phone and desktop browsers through the real authentication transition, including reload when promised. Include invalid input, expiry, discard, storage failure, cancellation, multiple pending journeys, account switching/logout, successful save, and a recoverable/uncertain failure. Verify that input is not transmitted before authentication and that the resumed input reaches only the authorized destination.

Use the shared [UX review method](../action-first-review.md) and existing workflow owners. Layout examples, component recipes, and framework-specific implementations may be added later without redefining this method.
