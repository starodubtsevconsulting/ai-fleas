# Cache financial questions with the data

For the [unified record layout](record-organization.flow.md), verified cross-source questions and answers belong in the applicable `_common/qN/summary.md` (or annual summary for matters spanning quarters), not a separate FAQ/knowledge cache file. Legacy mapped FAQs remain readable; migrate only when authorized. Avoid duplicating current status across them. Verified questions and answers belong within the selected profile's authorized financial-data mapping. Reusable worked use cases and methods belong in the workflow. A cached answer contains private financial facts and must not be copied into public instructional examples.

Before reading a cache as an answer, compare its organization/accounts, period, currency, accounting basis, category or tax jurisdiction/program, and coverage with the current request. Read its source citations and verification date. A missing date, unsupported zero, conflicting source, new statement, changed extraction, or different scope requires revalidation. A FAQ is a derived answer, not primary financial evidence; use it as a discovery aid when it cannot establish a current result.

For each cached question, record:

- The exact question and a direct numeric answer, with units and period; include currency for amounts.
- Organization/account scope and paid, invoiced, or other basis.
- For service counts, define the stay-date basis and status evidence; distinguish reservations, served bookings, distinct identified lead customers, and recorded guest-visits. Preserve unknown customer identity and attendance rather than converting them into confident counts.
- For client lists, link the authorized private contact artifact and record its stay basis, booking IDs, identity uncertainty, per-field sources, relay versus personal contact types, and absent versus unexported fields. A placeholder or contact-reveal control is not contact information. Keep real names and contacts out of public examples and evidence.
- For platform income, distinguish pretax booking revenue, gross guest charges, tax pass-through, platform fees, co-host distributions, retained amounts, and settled bank cash. Record the stay/payment/payout period basis, refunds, currencies, and reconciliation status; do not sum differently defined platform fields as one revenue total.
- For mileage, identify the vehicle, endpoints, travel-date basis, included legs, and whether kilometres are logged or estimated. Record estimate assumptions separately; missing journey logs make actual distance unknown rather than zero. A pending cache entry must name the evidence needed to complete it.
- Included rows and original document paths with pages/rows; the arithmetic must reproduce the answer.
- Exclusions, unresolved items, and account/date coverage gaps.
- Verification date and status, such as verified for stated coverage or supported subtotal with gaps. Preserve the difference between inspecting extracted text and visually inspecting source pages.

Create or update the data FAQ only through an authorized write route or an explicit human-authorized data edit. Preserve unrelated content. Correct a stale answer explicitly so that two contradictory answers do not appear equally current; retain historical context where useful. An answer calculation alone does not authorize publishing source records or changing canonical JSON.

Operational use may reuse a cached answer after its scope and sources are revalidated. A blind benchmark must exclude cached answers and evaluator reference answers from the solving agent's permitted inputs, including searches over the data tree. Record that exclusion in the run's configuration and evidence; otherwise label the run as cache-assisted rather than an independent solution. Compare reference answers only after the solving agent returns its result.
