# Answer a scoped financial record question

## Outcome

From one human question, the Bookkeeper discovers the authorized records and returns the requested facts with original-source citations and explicit unknowns. This flow covers narrow questions such as a remittance amount, its reporting period, due date, scheduled payment date and payment status. Use the [spending flow](spending-question.flow.md) for broader transaction discovery and totals.

The selected profile supplies scope and available tools. Harness and model are configuration. A runner may capture evidence and grade the answer, but must not supply the reference answer or choose the documents for the agent.

## Ordered method

1. **Select and read the guide.** Read applicable rules, then search the selector rows in the [worked-use-case index](../walkthroughs/README.md) with bounded output rather than loading the entire growing index. Select the closest example and read it in bounded chunks before inspecting financial data, continuing until its relevant procedure is covered. Reading only the index is not completion of this step. Record the selected guide and the decisions relevant to the request. Use its method, never its fictional facts. Do not load every example. Keep documentation reads within the same output budget as data reads.
2. **Set scope and dates.** Resolve taxpayer or organization, program, requested reporting period, as-of date and allowed source sections. A Q3 liability may be stored in Q4 because its submission or payment occurs then. Keep reporting period, operational filing bucket, notice date, deadline, scheduled execution and posted settlement separate. Inspect adjacent periods only within the authorized mapping.
   Every discovery root must remain inside the exact authorized sections. Parent or sibling listings are not implicitly permitted by a broader profile mapping or guidance document. When settlement evidence would require access outside the selected root, stop discovery and return payment unproven with that coverage limit; do not search the parent after the requested facts are established.
3. **Inventory exact paths.** Follow the [record organization flow](record-organization.flow.md), including relevant authorized `_common` summaries as derived discovery aids despite generic underscore filters. List one allowed section at a time, at most 20 entries per batch with a continuation checkpoint. Preserve the full relative path, including nested period directories, and source/sidecar pairing. Open paths returned by the inventory rather than reconstructing filenames. When a path fails, re-list its last verified parent, correct the path from observed entries and resume; do not guess repeatedly or expand scope.
4. **Read bounded structured facts.** Read one or two adjacent CSV/JSON records per call, returning only relevant fields plus source paths. Keep each tool result within the task's output budget; absent a smaller configured limit, target at most 5,000 characters. A large sidecar needs field selection or smaller batches, not whole-file concatenation. Missing JSON does not remove the original document; use relevant CSV fields when available and preserve legacy JSON names. Record the exact paths read and preserve unknowns.
5. **Check material fields against sources.** Verify the amount, reporting period, deadline, scheduled date and status that determine the answer against the original source, one page at a time. Use the configured mechanical extractor first. Inspect the original page visually when a field is ambiguous, image-only, misaligned or conflicting and a supported visual capability exists. Record text extraction and visual checking separately. If a required source field cannot be checked, identify it as unresolved rather than silently trusting the sidecar.
6. **Classify obligation and settlement separately.** An amount due, notice recommendation, submitted request and confirmed payment are different facts. “To be processed” and a future execution date establish a scheduled request, not settlement. Confirm paid status from a posted bank match or an authoritative received-payment record, retaining account/taxpayer scope and reference matching privately. A filename containing “paid” is insufficient. Do not derive a new payable amount from credits or overpayments without supported allocation. Missing settlement evidence means payment unproven, not proof that no payment occurred.
7. **Answer and stop.** Lead with the requested amount/currency and direct date/status facts in a short natural-language answer. Cite original relative paths and pages; include material ambiguity and inspected coverage. Do not reproduce full tax identifiers, account numbers or addresses. State explicitly whether original verification was mechanical or visual when relevant. Finish when the actual answer and limits are delivered; successful discovery or a valid JSON object alone is not completion.

### Enforce the output unit

Verify the selected reader's actual parameter units. A `read` tool's `offset` and `limit` may count **lines**, not characters: `limit: 4500` does not enforce a 4,500-character result. For a character budget, use the configured mechanical reader to return `text[start_char:start_char + 4000]`, plus a small continuation offset. Keep character and line offsets distinct; do not pass a character offset to a line reader. For byte budgets, slice encoded bytes without breaking UTF-8 characters. Reserve space for source labels and tool-added text within the task's result limit. Continue from the exact returned offset until the relevant content is covered; do not read the remainder unbounded after the first chunk. Apply this to guidance and data alike.

Fictional bounded recipe: a 6,200-character guide returns characters 0–3,999, then 4,000–6,199, with the next character offset recorded after each batch. A line-based reader may be used only when the returned character/byte size is independently bounded. If a tool still exceeds the budget, record the violation and use the correctly bounded reader next; successful financial extraction does not erase it.

## Checkpoints and recovery

Maintain a compact private checkpoint: question/scope, selected guide read, last completed inventory batch and cursor, exact candidate paths, verified fields, unresolved fields, source method, and next bounded action. When a tool fails, preserve the failure and resume from the last verified path or page **inside the authorized root**. Re-listing a parent outside that root is not permitted recovery or completeness checking. Do not restart broad discovery, invent missing values or stop before returning already-supported facts. If a capability or scope boundary blocks completion, return the supported answer with the specific remaining gap.

Use [data FAQ caching](data-faq-cache.md) only with authorized writing and provenance. Exclude cached answers and evaluator references from blind test inputs. Canonical source mutation, payment execution and calendar creation require their own authorized effects; a lookup grants none of them.

## Fictional acceptance scenarios

| Scenario | Evidence and expected behavior |
| --- | --- |
| Q3 liability filed in Q4 | The indexed tax example is opened first. Exact nested inventory finds an obligation for July–September under a Q4 filing section. Source p1 confirms CAD 720, due October 15, scheduled October 14, status To be processed. Answer those facts without changing the reporting period to Q4 or claiming payment. |
| Path recovery | A read omits a nested period folder and fails. Re-list the last verified parent, use its returned full relative path, read the paired records and continue. Preserve the error; numerical correctness alone does not erase the procedural deviation. |
| Missing payment proof | Original source confirms CAD 720 due and a submitted request, but no settlement evidence is in scope. Return the amount and schedule with payment unproven and a bounded coverage note. Do not report zero, paid, or a speculative net amount. |

These scenarios are invented instructional acceptance cases, not executed results.

## Evaluation dimensions

Grade separately: **answer accuracy** (amount, dates, period, status and citations), **guide compliance** (selected example actually read and relevant decisions applied), and **scope/tool compliance** (allowed paths, bounded outputs, honest verification and no unauthorized effects). A correct number does not prove every method step was followed. Record actual elapsed time, tool failures and available token metrics separately; never substitute those metrics for financial correctness.
