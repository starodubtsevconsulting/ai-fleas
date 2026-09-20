# Financial Insights workflow

Use for explicitly requested internal financial sense-making: organize financial records, preserve source evidence,
understand cash activity, and provide bounded financial observations for human or Personal Governor decisions.

This workflow is not professional accounting, tax, legal, investment-advisory, or bookkeeping advice. Report evidence,
uncertainty, assumptions, and missing records rather than silently converting incomplete data into facts.

## Portable record model

A configured project may use:

```text
<project>/
  <year>/
    <quarter>/
      In/
      Out/
      Statements/
  .ai-workflow-suite/workflows/financial-insights/state.yml
```

`In` holds incoming-value evidence, `Out` outgoing/vendor evidence, and `Statements` period account activity.
Entries beginning with `_` are reserved/private by convention and are not discovered as financial entities or report
sources. Profiles map this logical structure to their authorized storage; the public workflow never prescribes real
organization names or machine paths.

## Document intake

Evidence-preserving intake follows:

`source -> recognize/classify -> structured extraction -> review -> canonical persistence -> reconciliation`

PDF text, OCR, vision, statement adapters, and extraction are profile-authorized commands/tools, not separate reasoning
agents. Filename or metadata alone is not sufficient evidence when document content is available. Ambiguous
classification, period, ownership, totals, currency, destination, or collisions remain review-pending. Never silently
overwrite canonical records.

Filesystem-present records are legitimate inputs. Reconciliation reuses the same classification, extraction,
provenance, collision, and review rules and is idempotent for already canonical records.

## Operational agents

- **Financial Analyst** — cash flow, trends, anomalies, scenarios, and sourced evidence for buy/sell/spend/retain
  questions. It distinguishes observed records from assumptions and does not make the human's strategic decision.
- **Records / Bookkeeping Agent** — intake, classification, completeness, reconciliation, and orchestration of
  authorized statements/taxes/PDF/OCR/extraction commands.
- **Financial Reviewer** — independent provenance, missing-data, arithmetic/period, assumption, and evidence review of
  material conclusions.

Development roles may exist while building this workflow but are not the ordinary operational financial team.

## Personal Governor boundary

The Personal Governor may request bounded financial evidence for decisions with a financial dimension. Financial
Insights returns sourced facts, calculations, assumptions, uncertainty, scenarios, and missing evidence. The Governor
combines them with human-owned goals, opportunity cost, capacity, and other authorized workflow evidence.

Financial Insights does not receive unrelated private Governor memory merely because the Governor asked the question.
Material conclusions requiring independent review go to a separate Financial Reviewer; same-context self-review does
not satisfy that gate.

## Commands and privacy

Load only commands needed for the request. Portable commands include `statements` and `taxes`; profiles may authorize
additional extraction/OCR/document capabilities without changing this contract.

Keep real corporation identities, records, credentials, provider configuration, account identifiers, and
machine-specific paths in private profiles/stores. Public examples use fictional/sanitized values.
