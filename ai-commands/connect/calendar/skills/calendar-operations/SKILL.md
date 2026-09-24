---
name: calendar-operations
description: Read and update an authorized calendar through the selected profile's calendar command. Use for agendas, availability, conflict checks, planning reconciliation, and exact event changes; prefer structured provider connectors over browser UI.
---

# Calendar operations

Use this skill only through an initialized caller whose selected profile authorizes the `calendar` command. This skill
guides execution; it does not install, connect, or activate a provider and does not grant calendar authority.

## Resolve the calendar capability

1. Load the provider-neutral [`calendar` command contract](../../calendar.command.md) and the active profile's resolved
   command configuration. Obtain the configured provider, account/calendar identity, timezone, and allowed operations
   from configuration rather than chat history or an open browser tab.
2. Prefer the configured provider's structured connector, MCP, API, or command adapter. Do not route calendar work
   through an unrelated provider merely because its tools are available.
3. Treat a provider that is installed or configured but has no callable tools in the current runtime as unavailable.
   Check whether the active profile or a direct human instruction authorizes browser fallback. Without that authority,
   report `BLOCKED_CALENDAR_PROVIDER_UNAVAILABLE` with the missing capability and the smallest useful recovery action,
   such as attaching the connector or starting a task whose tool set includes it.
4. When browser fallback is authorized, use a browser surface that can reliably complete and verify the operation. An
   external browser may be used when the internal browser is unavailable, incompatible, or unreliable. Verify the
   signed-in account, exact calendar, and current event state before mutation; do not treat an ambient open tab as
   provider or account authorization.

## Read before planning or changing

- Resolve relative dates in the configured calendar timezone and use explicit instants for provider calls.
- Read the smallest time window and calendar set needed for the request.
- Reconcile existing events, conflicts, fixed commitments, and duplicates before proposing or creating blocks.
- Keep provider event identifiers and URLs when available so later verification and durable evidence can refer to the
  same event.

## Apply an authorized mutation

Before writing, resolve the exact calendar, title, start, end, timezone, recurrence, participants, visibility, and
description fields that materially affect the request. Preserve fields the human did not ask to change. Invitations,
RSVPs, shared-event edits, recurrence changes, cancellations, and deletions require authority for that exact effect.

Search for an equivalent existing event before creation when a retry or prior partial attempt is possible. Apply one
bounded change, then read the event back through the structured provider. Success requires a provider-confirmed event
identity plus the verified calendar, title, start, end, and timezone. If confirmation is ambiguous, inspect current
provider state before retrying so the operation is not duplicated.

## Personal Governor use

When the caller is the Personal Governor, also follow the
[`calendar-governance` policy](../../../../../ai-workflows/_common/policy/personal-governor/calendar-governance.md): apply
Governor provenance only where that policy calls for it, preserve externally owned events, and use the calendar as the
authoritative surface for exact current scheduling. Persist calendar-derived planning or historical evidence to the
authorized memory only after the provider result is verified; a draft or proposed event is not calendar evidence.
