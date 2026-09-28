Modify only `recognizers/snow-removal-contract-recognizer.mjs`.

The current recognizer supports the existing French snow-removal contract path:
- `CONTRAT` + `DÉNEIGEMENT` (or normalized `DENEIGEMENT`) + `VERSEMENT`, or
- `CONTRAT` + `DÉNEIGEMENT` (or normalized `DENEIGEMENT`) + `PAIEMENT`.

Extend the recognizer so English text is also recognized when, and only when, it contains both:
- the phrase `SNOW REMOVAL CONTRACT`; and
- the word `PAYMENT`.

Requirements:
1. Matching is case-insensitive.
2. Preserve the existing French behavior and the existing result contract.
3. For an English match, include evidence flags `snow-removal-contract-keyword` and `payment-keyword` in addition to `service-contract-keyword`.
4. `SNOW REMOVAL CONTRACT` without `PAYMENT` must not match.
5. `PAYMENT` without `SNOW REMOVAL CONTRACT` must not match.
6. Do not modify or create any other file. Do not add tests, fixtures, helpers, or scratch files.
7. Before reporting completion, inspect the changed file and stop.

Return a concise completion message naming the changed file.