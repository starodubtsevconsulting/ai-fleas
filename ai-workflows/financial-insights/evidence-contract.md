# Financial Insights evidence contract

This contract defines the bounded packet Financial Insights may return to a human, Personal Governor, or another
authorized workflow.

## Packet

- question / decision context;
- selected project and period identifiers using profile-safe logical IDs;
- observed facts with evidence references;
- derived calculations and method;
- assumptions supplied by the requester;
- scenarios, when requested;
- unresolved anomalies or reconciliation issues;
- missing evidence / coverage limitations;
- review state and exact reviewed revision when independent review applies.

Do not include unrelated source documents, credentials, raw account identifiers, unrestricted extracted text, or
unrelated Governor/private-profile memory.

## Decision boundary

Financial Insights answers the financial dimension of a question. The Personal Governor may combine this packet with
human goals, opportunity cost, capacity, technical evidence, and other authorized workflow outputs. The packet does not
encode a final buy/sell/spend decision unless the human explicitly asked only for a mechanical financial rule whose
inputs and authority are already defined.
