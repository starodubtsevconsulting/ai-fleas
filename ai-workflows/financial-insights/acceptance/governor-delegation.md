# Financial Insights Governor delegation acceptance

This acceptance scenario is portable. Platform adapters may realize agents differently.

## Scenario

Human asks Governor to evaluate the financial dimension of a planned purchase.

Example fictional request:

```text
I am considering a CAD 8,000 equipment purchase.
Use Example Accounting, current quarter plus the previous quarter.
Show cash-flow evidence, unresolved records, and the effect of the purchase.
Have the financial conclusion independently reviewed.
```

## Required evidence

- Governor sends only bounded decision context and explicit assumptions.
- A distinct Financial Analyst receives the question.
- A distinct Records / Bookkeeping Agent supplies record/completeness evidence through portable commands.
- Analyst produces an evidence-contract packet with observed facts, calculations, assumptions, currency/period,
  provenance, missing evidence, and scenario result.
- A distinct Financial Reviewer receives the exact packet revision and returns findings.
- Any material revision is re-reviewed where affected.
- Governor receives the reviewed financial packet and performs cross-workflow reasoning separately.
- No real credentials, account identifiers, unrestricted raw documents, or unrelated Governor memory cross the
  workflow boundary.

## Degraded platform

If the platform cannot route to distinct agents, Governor/Analyst may emulate useful passes only when authorized, but
must mark the independent-review gate pending. Emulation never satisfies this acceptance scenario's distinct-agent
requirement.
