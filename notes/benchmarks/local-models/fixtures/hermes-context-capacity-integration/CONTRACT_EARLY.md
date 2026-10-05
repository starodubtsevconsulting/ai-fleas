# CAP-E: representation and token semantics

- `CAP-E1`: Use `normalizedText` as the only representation for exact token or phrase decisions.
- `CAP-E2`: `compactText` is advisory and must never prove change approval.
- `CAP-E3`: Matching is case-insensitive.
- `CAP-E4`: `APPROVE` must be a standalone word. `DISAPPROVE`, `APPROVED`, and `APPROVES` are not approval evidence. A separate standalone `APPROVE` remains valid when `DISAPPROVE` also appears.
