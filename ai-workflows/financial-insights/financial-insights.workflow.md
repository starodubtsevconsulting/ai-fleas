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

## Record lookup

For a request to find an existing invoice, receipt, bill, or statement, first resolve the selected project and its
canonical storage from the active profile. Search that storage using the requested period, entity, record direction,
and topic, allowing for the project's actual folder layout and synonymous filenames. When the year is omitted, search
the current year first, then broaden the search; report the year of any match rather than assuming it. Inspect the
candidate document when its content is available, and return its exact location with any unresolved ambiguity.

Admin follows this lookup route when handling an authorized Financial Insights request directly or emulating a
configured workflow role. A saved-project label or visible folder alone does not establish workflow scope; use the
verified profile and project binding.

Finding a record does not finish its processing. For a PDF already present in canonical storage, check whether it has
a valid structured sidecar. If not, use a profile-authorized implementation of the `financial-records` contract to
recognize its content and period, propose a canonical name and destination, extract schema-versioned fields with
provenance, and review the proposal and extracted values. Normalize the file and publish its JSON sidecar only through
the authorized persistence path after eligibility and collision checks. Skip an already canonical PDF with a valid
sidecar. Leave uncertain, incompatible, or colliding records unchanged and report what needs review. The portable
command contract alone is not an executable processor. The current UI staged intake supports open-quarter `In` PDFs;
do not assume its Add or normalization path supports an existing `Out` record. If no authorized processor supports the
record's section, report processing as pending rather than rename or extract it ad hoc.

The target execution boundary for recognition, normalization, extraction, and reconciliation is one executable
`financial-records` command with profile-authorized adapters. Both no-UI agents and the platform backend should call
that command so they use the same classification, naming, extraction, and collision rules. Until that implementation
and backend integration exist, the portable contract describes the desired behavior; it does not grant access to the
platform's private driver or make unsupported sections processable.

## Document intake

Evidence-preserving intake follows:

`source -> recognize/classify -> structured extraction -> review -> canonical persistence -> reconciliation`

PDF text, OCR, vision, statement adapters, and extraction are profile-authorized commands/tools, not separate reasoning
agents. Filename or metadata alone is not sufficient evidence when document content is available. Ambiguous
classification, period, ownership, totals, currency, destination, or collisions remain review-pending. Never silently
overwrite canonical records.

Filesystem-present records are legitimate inputs. Reconciliation reuses the same classification, extraction,
provenance, collision, and review rules and is idempotent for already canonical records.

Agent access and durable mutations follow [`versioned-data.md`](versioned-data.md): Analyst/Reviewer are read-only;
Records / Bookkeeping proposes changes through a version-controlled publisher. Existing human-facing UI storage/write
behavior remains compatible until separately migrated and acceptance-tested.

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

Load only commands needed for the request. Portable commands include `statements`, `taxes`, `financial-records`, and `financial-analysis`; profiles may authorize
provider-specific extraction/OCR/document adapters behind those contracts. Governor-facing outputs follow
[`evidence-contract.md`](evidence-contract.md).

Keep real corporation identities, records, credentials, provider configuration, account identifiers, and
machine-specific paths in private profiles/stores. Public examples use fictional/sanitized values.
