# Answer a spending question

## Outcome and prerequisites

The human makes one request, such as “How much did I spend on AI in Q2?” The
Bookkeeper independently discovers the relevant evidence, calculates a supported
amount, and returns the number with its basis and coverage. The selected profile
supplies the authorized data root, actual folder mapping, available read/extraction
tools, and private evidence location. The harness and model are configuration.

The agent owns planning, file discovery, extraction decisions, reconciliation,
and aggregation. A test runner records and evaluates the run; it must not supply
an evaluator-selected candidate list or calculate the answer for the agent.
Internal checkpoints and bounded batches support recovery within the same request.

## Ordered method

1. **Plan the question.** Resolve organization scope, calendar dates, topic, and
   accounting basis. “Spent” normally means paid cash activity; keep invoiced
   obligations separate. For card purchases, distinguish merchant charges from
   later payments of the card balance; counting both duplicates spending. State
   whether the reported basis is card purchases or bank cash settlement.
   Use the selected profile's date conventions and state
   any necessary assumption. Define what counts as the requested category: AI
   software/services may qualify; general cloud, hardware, or mixed-purpose
   services require content evidence rather than a vendor-name guess.
2. **Discover the storage.** Read applicable rules from the authorized root down
   to the relevant folders. Resolve their actual organization/year/quarter layout
   rather than impose a path template. Spending directs discovery toward `out`
   or its mapped equivalent, plus independent account statements. Enumerate
   relevant organizations and accounts before selecting documents.
3. **Inventory and scan in bounded batches.** Inventory both original documents
   and sidecars. Search outgoing records for category evidence; independently
   inspect statement transaction rows for qualifying vendors without receipts.
   Missing JSON must never make an original PDF disappear from coverage. Record
   which folders, files, accounts, and statement periods were inspected. Open
   neighboring statement periods when their transaction coverage crosses the
   requested boundary. Folder placement is a search aid, not the transaction date.
4. **Read or extract.** Reuse valid structured sidecars, retaining their original
   document links. Check whether a sidecar includes full statement rows or only a
   truncated preview. For missing, incomplete, or conflicting fields, use an
   authorized read-only text/PDF/OCR extractor and keep derived evidence in the
   configured private scratch/evidence location. Leave canonical documents and
   sidecars unchanged. If no extraction capability is available, record the gap
   and continue with other evidence. Text extraction is not visual verification;
   report vision only when source pages were actually supplied and inspected.
5. **Normalize transaction rows.** Create the work table below from document
   content. A statement's headline balance, previous balance, or payment total is
   not an individual vendor charge. Preserve the invoice date, transaction date,
   settlement date, original currency, and account settlement currency separately.
   Resolve a sidecar/source conflict from the original evidence or mark the field
   unresolved; do not trust a primary currency or total merely because it is JSON.
6. **Reconcile and deduplicate.** Match receipts/invoices and statement rows by
   evidence identity, account, amount/currency, vendor, date, and transaction
   reference where available. Count one economic payment once even when represented
   in several documents. A statement-only charge can support cash spending while
   its receipt or tax breakdown remains missing. An invoice alone supports invoiced
   cost, not payment. Preserve independent refunds/credits as signed transactions.
   For upgrades whose receipt already nets the old plan's credit, count the net
   cash receipt once; do not subtract the embedded credit again. Resolve date
   eligibility from the chosen basis, including records filed in the wrong quarter.
7. **Calculate exactly.** Sum included signed transaction amounts using decimal
   arithmetic or integer minor units. Keep currencies separate unless supported
   settlement amounts or an explicit conversion policy permit a combined amount.
   For cash spending, use account settlement currency when supported and retain
   original charge amounts. Show gross paid spending and distinguish tax-exclusive
   cost or recoverable tax when evidence supports those additional measures.
8. **Answer the request.** Lead with the numeric supported total, period, currency,
   and basis. Provide source-linked included transactions and arithmetic, then
   exclusions and unresolved coverage. If evidence is incomplete, label the number
   a supported subtotal and explain what could change it. A technical extraction
   limitation must not silently become zero spending or prevent reporting the
   supported amount already established.

When an authorized data FAQ is available, apply the [data FAQ cache contract](data-faq-cache.md): validate scope, sources, freshness, and coverage before reusing an answer. Cache real Q&A with the data only when writing is authorized. Blind benchmark inputs must exclude cached and evaluator answers.

## Minimal work table

Each row represents a transaction or an explicitly unresolved candidate, with:

| Field | Required meaning |
| --- | --- |
| Evidence | Original relative path and page/row; sidecar path if used |
| Identity | Organization, account/reference if available, deduplication group |
| Classification | Vendor, category, included/excluded/unresolved and reason |
| Dates | Invoice, transaction, and settlement dates when present |
| Amounts | Signed original amount/currency; signed settlement amount/currency |
| Basis | Paid, invoiced, refunded, or payment unproven; tax facts separately |
| Verification | Content inspected, extraction method, conflicts and missing evidence |

No field is invented to satisfy the table. Use explicit unknown values. Keep a
coverage checklist separately so a short candidate table cannot imply complete
quarter coverage.

## Failure and recovery

Bound tool calls by folder/document count and output size. Persist intermediate
inventory and normalized rows privately when supported, then continue from the
last completed checkpoint after a failed batch. A timeout is failed work, not an
excluded transaction. Narrow the next batch rather than repeatedly scanning the
whole tree. If a required tool is unavailable, state the affected coverage and
continue supported work; do not mutate canonical data as a workaround.

Independent review or publication requirements remain governed by the evidence
and versioned-data contracts. Calculating and returning a sourced read-only
answer does not authorize record publication or self-certify independent review.

## Completion scenarios

- One natural-language request plus authorized workflow context produces a
  numeric answer without a human or runner choosing intermediate candidates.
- A qualifying PDF without JSON is discovered and extracted or explicitly listed
  as an unresolved coverage gap.
- A statement-only qualifying charge is considered even when the outgoing folder
  has no corresponding receipt.
- A truncated statement sidecar or incorrect primary total/currency triggers
  source inspection; balances are not counted as vendor spending.
- An out-of-period invoice in the quarter folder is handled by its evidence dates
  and the declared paid/invoiced basis.
- Duplicate invoice/statement evidence and a net upgrade credit each affect the
  total only once; independently settled refunds remain signed transactions.
- Exact row arithmetic reproduces the answer, currencies remain distinguishable,
  and incomplete statement coverage produces a labeled subtotal with a clear gap.
- A run trace records actual tools, sources, model/harness configuration, elapsed
  time, result, and failures privately. A schema-valid intermediate response alone
  does not establish completion of the human's question.
