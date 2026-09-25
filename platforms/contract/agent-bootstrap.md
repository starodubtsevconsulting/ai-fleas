# Portable agent bootstrap contract

Every platform adapter must separate runtime startup from identity assignment.

The host may invoke its startup mechanism for every agent instance, but startup grants no role, scope, authority, or
capability. The adapter resolves the exact platform-owned instance ID against trusted lifecycle state:

- an active exact binding restores the current canonical initialization sources and platform overlay;
- a pending exact binding permits only its bounded initialization transaction;
- an absent, expired, ambiguous, foreign, or inactive binding leaves the instance unbound and grants no agent authority.

Titles, prompts, conversation history, working directories, nearby files, model claims, and user-authored documents are
not identity evidence. A platform may offer a manual bootstrap request, but its lifecycle controller must validate the
caller, requested logical agent, exact scope, canonical sources, and lifecycle invariants before recording a pending
binding. The conversational instance never writes its own identity.

## Initialization transaction

1. The lifecycle controller resolves the intended logical agent and canonical initialization bundle.
2. The platform creates a fresh instance unless an exact active or recoverable binding must be reused.
3. The controller records one pending binding against the immutable platform instance ID.
4. The platform delivers a one-time initialization request bound to that instance, request, expiry, and expected readiness token.
5. The instance loads and verifies the declared sources and returns the exact readiness token.
6. The adapter atomically activates the binding only after readiness verification.
7. Subsequent runtime starts restore the active binding idempotently.

Replacement additionally follows the applicable continuity contract: verify and activate the successor before making it
authoritative or deactivating the predecessor. Failed initialization leaves the predecessor unchanged.

## Adapter mapping

An adapter documents its concrete startup event and fallback when the host exposes no hook. A hook-capable platform should
restore identity before ordinary work. A platform without hooks must deliver the same canonical initialization bundle
through its launcher or instance-creation API before marking the instance active.
