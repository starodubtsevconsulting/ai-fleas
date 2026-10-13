# Worked use case: bookings and clients served

Fictional instructional example; every reservation, observation, path, and count below is invented, not executed evidence.

**Request:** “How many bookings and clients did the chalet serve in Q2 2027?”

**Plan:** resolve the authorized business and reservation sources; distinguish stays served from reservations created or payments received; scan the whole period; deduplicate reservations; separately calculate bookings, lead customers, and recorded guest visits. If the request leaves “clients” ambiguous, return these named measures instead of silently treating them as interchangeable.

1. **Discover the right records.** Read the profile's folder rules and inventory the mapped chalet incoming reservation records, platform exports, direct booking register, cancellations, and occupancy/completion evidence. Statements and payout records corroborate payments; a payout is not an additional booking. Include adjacent quarters and historical rows inside later exports: export date and folder location do not establish stay date.
2. **Declare the service basis.** For this example, a served booking is a reservation with documented actual occupancy overlapping April 1–June 30, using the half-open stay interval `[check-in, check-out)`. A March 30–April 2 stay therefore qualifies; a June 30–July 3 stay qualifies only if occupancy is supported. A reservation made in Q2 for August does not qualify. State this basis, since arrival-based and checkout-based reports give different results; never silently combine their totals. Cross-quarter bookings can appear in two quarterly overlap reports and must be deduplicated for a yearly total.
3. **Read sources and normalize.** Pair originals with sidecars, using the actual schema. Retain platform, reservation ID, source page/row, lead customer identifier, arrival/departure, status, adults, children, infants, and pets separately. Verify missing/conflicting facts against the source. A generated placeholder name cannot establish customer identity. A sidecar `pageCount` is not proof of full extraction: inspect the original page count and remaining pages when inconsistent. Do not equate a confirmed future booking or payment with completed attendance.

| Reservation key | Stay / supported status | Lead customer | Recorded people | Decision |
| --- | --- | --- | ---: | --- |
| `platform-a / EX-A01` | Mar 30–Apr 2 / occupied | customer X | 2 adults + 1 child | Include: 1 booking, 3 guest-visits |
| `platform-a / EX-A02` | May 10–12 / completed | customer X | 2 adults | Include: repeat customer, 2 guest-visits |
| `direct / EX-D01` | Jun 20–23 / completed | customer Y | 4 adults + 1 infant; 1 pet | Include: 1 booking, 5 guest-visits; pet separate |
| `platform-b / EX-B01` | Jun 5–7 / cancelled | customer Z | 2 adults requested | Exclude: no service |
| `platform-b / EX-B02` | Jun 15–17 / documented no-show | customer W | 2 adults requested | Exclude: payment alone is not service |
| `platform-a / EX-A03` | Jun 30–Jul 3 / confirmed, attendance unknown | unknown | 3 requested | Review pending; do not count as served |
| `platform-a / EX-A04` | Aug 2–5 / reserved in May | customer V | 2 requested | Exclude: stay outside Q2 |

The invented source ledger cites `2027/chalet/Q2/in/platform-a/export.pdf` p1 rows 1–2 for A01/A02, `in/direct/register.pdf` p1 row 1 for D01, `in/platform-b/export.pdf` p1 rows 1–2 for B01/B02, and `2027/chalet/Q3/in/platform-a/export.pdf` p2 rows 1–2 for A03/A04. A later payout summary repeats A01/A02 and adds no bookings.

4. **Deduplicate and reconcile identities.** Use platform plus reservation ID for source duplicates; identical names or amounts alone are insufficient. Investigate cross-platform migrations using linked identifiers and dates. Merge repeat lead customers only with reliable identity evidence; preserve uncertain identity separately. Never count a placeholder such as “Guest” as one shared customer. A lead customer is not every person in the party, and guest-visits are not distinct individuals across stays. Unless actual attendance is documented, label party totals as recorded guests for the supported stays, not independently verified people present.
5. **Calculate and answer with coverage.** Three supported reservations produce **3 served bookings**, **2 distinct identified lead customers**, and **10 recorded guest-visits** (`3 + 2 + 5`), comprising 8 adult visits, 1 child visit, and 1 infant visit. Record 1 pet separately. A03 remains review pending; if occupancy is later confirmed it changes the count. Complete all platform/direct-source batches before claiming comprehensive coverage. Missing direct bookings or completion evidence makes this a supported subtotal.

**Answer:** “The supplied records support **3 chalet bookings served in Q2 2027**, representing **2 distinct identified lead customers** and **10 recorded guest-visits**, including one infant; pets are separate. One further quarter-overlapping reservation lacks attendance confirmation. This uses actual-stay overlap, not booking creation or payout date.” Attach the normalized source ledger and missing-source/status list.

**Recover:** if the only source is a reservation export without completion evidence, report reservations scheduled for the period separately from confirmed served stays. If customer identities are absent, return the supported booking count and explain why distinct clients cannot be established. When authorized, retain the scoped answer in the one quarter summary under the [FAQ cache contract](../flows/data-faq-cache.md); keep customer identities and real source facts private.
