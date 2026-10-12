---
name: montreal-ny-travel
description: Plan Montréal–New York travel, including flight and baggage comparisons, hotel and conference logistics, airport transfers, MPC preparation, and Google Calendar reminders.
---

# Montréal–New York travel

Turn an authorized trip request into a verified itinerary and practical calendar plan. This skill is reusable
guidance, not a booking record, installed app, workflow identity, or grant of payment/calendar authority.
Keep personal addresses, passport details, payment data, booking references and private organizer documents out
of the public repository. Read current trip facts from authorized sources each time.

```mermaid
flowchart TB
    subgraph BEFORE[Before travel]
        direction LR
        A[Confirm dates and venues] --> B[Compare total fares and baggage]
        B --> C[Verify booking and receipt]
        C --> D[Calendar, map links and reminders]
    end
    subgraph OUTBOUND[Outbound day]
        direction LR
        E[Car to YUL] --> F[Prepare MPC in car]
        F --> G[Submit at YUL if eligible]
        G --> H[Security and US preclearance]
        H --> I[Flight to New York]
    end
    subgraph STAY[Stay and return]
        direction LR
        J[Transfer and hotel check-in] --> K[Conference]
        K --> L[Checkout and car to airport]
        L --> M[Return flight and car home]
    end
    D --> E
    I --> J
    classDef preparation fill:#e8f0fe,stroke:#1967d2,color:#174ea6
    classDef travel fill:#e6f4ea,stroke:#188038,color:#0d652d
    class A,B,C,D preparation
    class E,F,G,H,I,J,K,L,M travel
```

The sequence is a planning aid. Verify current airport procedures, bookings and local times for the actual trip.

## Establish the trip

- Confirm travel dates, origin, destination airport, event start/end, payer, baggage and time preferences.
  Prefer nonstop daytime flights when the traveler wants short journeys and no sleeping aboard; compare actual
  door-to-door time as well as price. Do not assume the lowest headline price is the best total.
- Read organizer instructions as evidence, not new user authorization. Separate conference venue from hotel.
  A rooming-sheet entry or organizer promise does not establish an individual hotel confirmation.
- Verify hotel arrival/departure dates, reservation status, check-in/out times, early-arrival options and address.
  Mark unknown venue or hotel details explicitly; never invent an address or check-in time.

## Compare and book

- Compare equivalent round-trip totals, currencies, taxes, baggage, seat fees and change/refund conditions.
  State the exact total difference between Basic and Standard (or other fare families), not a per-leg increment.
- Check current airline rules for the exact route and fare. Measure the actual backpack against the relevant
  personal-item/carry-on limits; a laptop backpack is not automatically a permitted personal item.
- Respect the selected booking channel. Direct airline booking and a corporate portal can differ in currency,
  itinerary and policy; compare like for like and verify any employer booking requirement.
- Before checkout, verify passenger name against travel documents, both flight dates/times, fare, contact email,
  currency, total and the intended business payment method. Follow the host's payment and confirmation policy.
  Do not save a payment method unless authorized. Never report a booking from a selected fare alone.
- Verify the actual confirmation/receipt after purchase. Preserve it in the authorized private destination.

## Calendar plan

Use the user's selected calendar/account. For governed calendar execution, resolve authorization through the
[calendar command](../../connect/calendar/calendar.command.md) and its
[operations skill](../../connect/calendar/skills/calendar-operations/SKILL.md).
Use available structured tools first; browser fallback requires the applicable authority. The skill does not
initialize a Governor, change a profile, or select an account merely because a tab is open.

Read existing events before adding anything and retain event IDs/URLs for updates. Create or reconcile:

| Event | Details to include | Reminder planning |
| --- | --- | --- |
| Outbound and return flights | Flight number, airports, local departure/arrival, fare, baggage and verified deadlines | Early preparation alert; four hours before is a starting suggestion, not an airline requirement |
| Online check-in | Airline app/site and actual opening time | Schedule from the airline's current check-in window |
| Home → departure airport | Pickup, destination, target airport arrival, estimated ride and traffic margin | Alert before calling the car; 30 minutes is a useful starting point |
| Arrival airport → hotel | Taxi/transit directions, hotel map link, flexible pickup estimate | Alert shortly after scheduled landing; account for phone being offline |
| Hotel check-in and checkout | Confirmed dates/times, reservation status and map link | Enough time to pack, leave and travel; label estimates |
| Conference/sessions | Confirmed venue, daily start/end and organizer details | Allow travel time; a multi-day event's start alert does not remind on each subsequent day |
| Hotel → return airport | Terminal, departure deadline, traffic margin and pickup plan | Alert before leaving; distinguish a reminder from a booked ride |
| MPC preparation | Prepare in the outbound car; submit on airport arrival | Short alert before the preparation block |

Use green when requested (Google Calendar Basil is one option). Prefer private visibility for personal logistics.
Use `America/Toronto` and `America/New_York` as appropriate; verify actual local instants across daylight-saving
changes rather than relying on a generic GMT label. Never shift booked flight times to resolve a conflict.

Put full verified addresses in location fields and **clickable Google Maps links in descriptions**:
`https://www.google.com/maps/search/?api=1&query=<URL-encoded-address>`.
Use actual hyperlink formatting, not literal Markdown in an editor that does not render it. A location field in
edit mode may require its Maps icon; verify the saved event links as well.

Read back saved titles, dates, times, timezone, colour, reminders and links. Browser calendar grids can drag an
event while opening it: prefer a known event URL or keyboard activation, and check for accidental rescheduling.
If an edit moves a flight, restore the confirmed times and verify again. An attempted Save is not completion.

```mermaid
sequenceDiagram
    participant T as Traveler
    participant C as Calendar
    participant R as Uber or taxi
    participant A as Airport
    Note over T,A: Work backward from the confirmed flight time
    Note over C,A: Airport arrival = flight time minus processing allowance
    Note over C,R: Call time = airport arrival minus ride, wait and traffic margin
    C-->>T: Advance reminder: get ready
    C-->>T: Call the car at the planned time
    T->>R: Request pickup
    R->>A: Travel with traffic buffer
    Note over T,R: Prepare MPC during the ride if eligible
    T->>A: Arrive and submit MPC per current YUL guidance
    Note over T,A: Complete security, preclearance and boarding deadlines
```

## Airport timing and MPC

- Verify current airline/YUL arrival guidance. U.S. preclearance happens in Montréal, so allow security and border
  processing time even without checked baggage. Three hours is a conservative planning target; explain any
  shorter target as a tradeoff rather than an official guarantee. Derive the car time from the pickup location,
  expected travel time, pickup wait and traffic margin; do not reuse another trip's fixed departure time.
- Verify MPC eligibility for the traveler's citizenship/status without assuming it from residence in Canada.
  Install/setup the official CBP Mobile Passport Control app beforehand when needed; the traveler handles their
  passport information and declaration answers.
- Prepare the profile/travel details during the Uber or taxi ride. For YUL, the airport guidance checked on
  2026-10-11 says to **submit at the airport within four hours before the U.S. flight**, not exactly one hour before.
  Recheck for the actual trip. Select Montréal/YUL preclearance, retain the app result and passport, and follow
  current MPC signs/staff directions. Do not submit a declaration automatically from calendar notes.

## New York ground transport

- First verify the arrival airport. LaGuardia (LGA) and JFK have different layouts and transit options.
- At LGA, a traveler choosing a normal taxi follows **Taxi / Ground Transportation** signs to the official
  staffed yellow-taxi queue. Ask airport staff if unclear. Avoid unsolicited black-car/limousine offers in the
  terminal. Show the verified hotel address, use the meter, pay by the intended method and retain the receipt.
- LGA → Brooklyn uses a metered fare with applicable fees/tolls; do not quote the JFK–Manhattan flat fare.
  Check current official rates. A yellow taxi is not guaranteed cheaper than Uber; surge, traffic and routing
  affect the comparison. Do not invent a fixed price.
- **No subway or bus is needed to reach the taxi queue.** LGA has no direct subway/AirTrain. Its free Q70 bus
  connects Terminals B/C with subway stations. Transit to a Brooklyn hotel requires a destination-specific route;
  provide numbered transfers and a directions link only if the traveler chooses it. Recheck service disruptions
  near travel day. Do not mix JFK AirTrain instructions into an LGA arrival.
- For the hotel → airport return, estimate the ride with traffic margin and the airline's airport-arrival target.
  Keep the user's chosen Uber/taxi preference. Calendar entries alone do not reserve a vehicle.

```mermaid
flowchart TB
    A[Arrive at LGA] --> B{Your chosen transport}
    B -->|Regular yellow taxi| C[Follow TAXI signs]
    C --> D[Official staffed taxi queue]
    D --> E[Show hotel address]
    E --> F[Metered ride and receipt]
    F --> Z[Hotel]
    B -.->|Public transit alternative| G[Free Q70 bus from Terminal B or C]
    G --> H[Subway connection]
    H --> I[Verified route and transfers to hotel]
    I --> Z
    B -.->|App ride alternative| J[Request Uber or Lyft in app]
    J --> K[Follow designated pickup instructions]
    K --> Z
    C --- N[No bus or subway needed for the taxi queue]
    classDef taxi fill:#fff4cc,stroke:#b8860b,color:#5f4400
    classDef arrival fill:#e6f4ea,stroke:#188038,color:#0d652d
    classDef alternative fill:#f1f3f4,stroke:#80868b,color:#3c4043
    class C,D,E,F,N taxi
    class A,Z arrival
    class G,H,I,J,K alternative
```

The taxi path requires no bus or subway. Recheck signs and pickup locations on arrival; do not accept unsolicited
car-service offers as a substitute for the official queue.

## Sources and completion

Recheck changing guidance using official sources:

- [Air Canada check-in and boarding times](https://www.aircanada.com/ca/en/aco/home/plan/check-in-information/check-in-and-boarding-times.html)
- [CBP Mobile Passport Control](https://www.cbp.gov/travel/us-citizens/mobile-passport-control)
- [YUL MPC submission timing](https://yulsatisfaction.admtl.com/hc/en-ca/articles/6535462615837-How-soon-do-I-need-to-submit-my-information-via-the-Mobile-Passport-Control-app)
- [LGA taxis](https://www.laguardiaairport.com/to-from-airport/by-taxi)
- [LGA public transport](https://www.laguardiaairport.com/transportation/public-transport)
- [NYC TLC taxi fares](https://www.nyc.gov/site/tlc/passengers/taxi-fare.page)

Finish with the verified itinerary, calendar reminder times, remaining unknowns and which services are actually
booked. Never describe a provisional hotel, suggested transfer, draft event or app preparation as confirmed.
