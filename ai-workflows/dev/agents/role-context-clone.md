# Role context replacement

Context replacement is a lineage transaction for one logical agent. Manager records the authoritative predecessor,
creates exactly one successor through the selected platform adapter, transfers only authorized bounded context, verifies
the successor's identity and readiness, updates every permitted identity projection, and deactivates the predecessor
last. Failure keeps the healthy predecessor authoritative and the candidate non-dispatchable. Labels, ordering, age, or
similarity never resolve lineage.

A platform-specific scheduled trigger may resume an open transaction, but it follows this same ledger and authority. It
must remain quiet when there is no meaningful lifecycle change and report ambiguous or failed reconciliation without
guessing.
