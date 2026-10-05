# CAP-M: decision composition and precedence

- `CAP-M1`: Recognition requires both the exact phrase `CHANGE REQUEST` and the exact word `APPROVE`.
- `CAP-M2`: Either positive signal alone is insufficient.
- `CAP-M3`: A standalone `CANCELLED` vetoes recognition even when both positive signals are present.
- `CAP-M4`: `UNCANCELLED` does not veto recognition. When `UNCANCELLED` and a separate standalone `CANCELLED` both appear, the separate `CANCELLED` still vetoes.
