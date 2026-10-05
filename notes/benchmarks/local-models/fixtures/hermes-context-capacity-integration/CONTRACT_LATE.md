# CAP-L: result contract and preservation

- `CAP-L1`: Preserve the legacy rule: case-insensitive standalone phrase `MAINTENANCE NOTICE` and standalone word `AUTHORIZED` in `normalizedText` are both required. Either alone, plural `MAINTENANCE NOTICES`, `UNAUTHORIZED`, or matching text found only in `compactText` is negative.
- `CAP-L2`: A new positive result is exactly `{ recognizedFamily: true, family: 'workflow-decision', subtype: 'change-approval', evidence: [...] }`.
- `CAP-L3`: The evidence array is exactly this ordered list: `change-request-keyword`, `approval-keyword`, `workflow-decision-keyword`.
- `CAP-L4`: Every negative result remains exactly `{ recognizedFamily: false }`, with no partial fields or evidence.
