# Financial Insights evidence contract

This contract defines the bounded packet Financial Insights may return to an authorized human or workflow requester.

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
unrelated private memory.

## Decision boundary

Financial Insights supplies financial facts, calculations, scenarios and limitations. A packet grants its recipient no authority to publish records, direct workflow roles, waive review or change quarter status. It does not encode a final buy/sell/spend decision unless the human explicitly asked only for a mechanical financial rule whose inputs and authority are already defined. External decisions and approvals remain with their authorized owners.
