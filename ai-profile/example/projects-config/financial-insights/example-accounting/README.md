# Example Financial Insights project

This is a sanitized logical example. Real profiles provide their own storage mapping and private records.

```text
example-accounting/
  reports/YYYY/
    _common/
      qN/summary.md
      annual/summary.md
    <business>/qN/
      in/
      out/
        _payed/
      statements/
  .ai-workflow-suite/
    workflows/
      financial-insights/
        state.yml
```

The folders describe financial evidence direction, not accounting truth. Recognition and extraction must preserve the source and leave uncertain records review-pending.

Keep validated extracted CSV/JSON beside its source using the source basename;
compose combined extracts on demand. The single `_common/qN/summary.md` owns
quarter coverage, unresolved questions and handover milestones. Every folder
whose name starts with `_` is internal and excluded from ordinary intake and
duplicate-cleanup scans. Read `_common` for applicable summary context and
inspect `_payed` only for an explicitly scoped linked-payment reconciliation;
its name does not prove settlement. See the
[record organization flow](../../../../../ai-workflows/financial-insights/flows/record-organization.flow.md).

The public [profile-owned fictional financial data](../../../data/financial-insights/README.md)
provides an inspectable corporate/year/quarter sample, source generator and
reference facts. It does not activate the placeholder storage mapping or confer
operational authority; real human profiles select their own private records.

The [fictional business-context map](../../../data/financial-insights/business-context.md)
shows how a profile can describe activities, income origins, partners, accounts
and routes as evidence-seeking clues. Its invented confirmations are illustrative,
not verified fixture facts or accounting rules.
