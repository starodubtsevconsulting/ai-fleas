# Worked use case: home–chalet vehicle distance

Fictional instructional example; all dates, distances, observations, and paths are invented, not executed evidence.

**Request:** “How many kilometres did the car travel between home and the chalet in Q2 2027?”

**Plan:** resolve the authorized vehicle and locations; find dated journeys and mileage evidence; distinguish actual recorded kilometres from an estimated route distance; calculate only supported legs in the requested period. Bookings and guest counts do not establish vehicle journeys.

1. **Discover the journey records.** Read the profile's folder rules and inventory the mapped vehicle mileage log, odometer records, calendar/site-visit records, and supporting receipts. Search the quarter and adjacent-period records for legs crossing the quarter boundary. A fuel receipt corroborates a purchase or location but does not establish a trip's kilometres. Do not infer one return journey per booking or assume a person travelled whenever guests stayed.
2. **Declare what will be measured.** Use actual dated travel legs during April 1–June 30 for this example. Retain vehicle, date/time, origin/destination, trip identifier, recorded kilometres or starting/ending odometer, business purpose, and original source page/row. Count outbound and inbound legs separately; a return journey may have different distances because of detours. If multiple vehicles or ambiguous endpoints prevent aggregation, preserve separate totals or unresolved rows.
3. **Normalize and verify the evidence.** Read existing sidecars using their actual schema, checking missing or conflicting fields against the original log. Derive a leg distance from end minus start odometer only when readings refer to that same leg and use consistent units. A gap in an odometer series can include unrelated driving. Preserve personal detours separately when documented; the requested total vehicle distance and a business-use subtotal are different measures.

| Leg / source | Date and route | Recorded distance | Decision |
| --- | --- | ---: | --- |
| `EX-T01-out`, `2027/chalet/Q2/out/vehicle/mileage-log.pdf` p1 row 1 | Apr 10, home → chalet | 80 km (odometer 10,000 → 10,080) | Include |
| `EX-T01-return`, same log p1 row 2 | Apr 11, chalet → home | 82 km (10,080 → 10,162), documented road detour | Include |
| Copy of `EX-T01-out`, vehicle summary p1 | Apr 10 | 80 km | Exclude duplicate; not another leg |
| `EX-T02-return`, Q3 log p1 | Jul 1, chalet → home | 81 km | Exclude from Q2; do not import a full return trip |
| Mapping note, `out/vehicle/route-note.pdf` p1 | Typical one-way route | 79 km estimated | Context only; not logged travel |

4. **Deduplicate and check coverage.** Match trip/leg identifiers, vehicle, timestamps, route, and odometer readings across repeated exports. Similar routes alone do not prove duplication. Inspect the original record for conflicting readings or unexplained negative distances; do not choose a convenient value. Complete all relevant log batches. An outbound leg in Q2 and return in Q3 belong to their respective travel dates; if a single leg crosses midnight at the boundary and has no distance split, keep that allocation unresolved rather than inventing one.
5. **Calculate and answer.** The two included legs produce **162 logged km** (`80 + 82`), covering **2 legs of 1 documented return journey**. This is the supplied log subtotal; comprehensive quarter coverage requires evidence that the log includes every relevant journey. The route estimate does not replace the actual readings. Keep any business-purpose classification separate from the kilometre count and do not infer tax deductibility from this example.

**Answer:** “The supplied records support **162 logged km between home and the chalet in Q2 2027**, comprising one documented return journey. A July return leg is outside Q2, and a duplicate export is counted once. This is a supported subtotal unless the quarter's journey log is complete.” Attach the leg ledger, original citations, and coverage status.

**Human-described visit practice:** if the human explains that cleaning usually requires one visit per booking, use that explicitly attributed practice for a separate conditional estimate, with booking count and route assumptions shown. It does not establish a dated trip ledger. Check cleaning dates, consolidated or extra visits, and quarter boundaries. Dashboard photos may refine or corroborate odometer/leg evidence; incomplete photo coverage does not establish that unphotographed trips never happened.

**Recover:** if only a route distance is available and no journey count is documented, the actual quarter total is **unknown**, not zero. Report the one-way estimate with its source and assumptions separately. If a reliable count exists, an estimated total can be shown as `documented legs × estimated km per applicable leg`, clearly labelled estimated; mixed routes require their own leg estimates. Do not manufacture journeys from reservations, maintenance needs, fuel spending, or a typical visit frequency. When authorized, retain a pending answer in the one quarter summary with the exact missing evidence—dated journey list, vehicle, endpoints, actual distances/odometer or permission to use a stated estimate—under the [FAQ cache contract](../flows/data-faq-cache.md).
