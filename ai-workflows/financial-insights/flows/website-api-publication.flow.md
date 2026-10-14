# Publish validated financial records to websites through APIs

## Purpose and place in the workflow

After the [record intake invariant](record-organization.flow.md#intake-completion-invariant) passes for a source, the Bookkeeper may publish its validated, source-adjacent CSV extraction to an explicitly authorized website. This is a per-source downstream projection, not a second intake path, a database migration, a quarter-closure event, or permission to publish every field to every site. Name normalization, business routing, extraction validation and redundant-copy cleanup must finish first. A blocked source remains pending while independent completed sources may proceed.

The original PDF/image and adjacent CSV/JSON remain canonical evidence under the selected profile. CSV rows supply the tabular payload. The adjacent metadata and original supply the source hash, canonical identity, statement coverage, page/row locator and review state needed to interpret those rows. Do not re-extract a PDF merely to populate a website, infer business identity from a filename, or treat a website record as proof that the original was verified.

## Entry and destination authority

Resolve the exact authorized profile, organization, business, source, quarter and destination website before sending anything. Map the private organization/business identity to the destination's tenant IDs through its authenticated API. Check the destination schema, allowed fields, credentials, requested purpose and permitted write effects. A website's account role alone never grants another tenant's data. Use a dedicated authorized publisher identity or equivalent scoped credential, not the public demo account. Do not put credentials, real account identifiers or private paths in public workflow files, logs or browser URLs.

Financial Insights in the SC umbrella is the initial target. Another SC or independent website is a separate destination with its own field allowlist and API adapter; do not copy raw financial rows there merely because it shares the umbrella. All mutations and readbacks go through the destination's documented HTTPS API. Do not connect to its database, insert rows directly, copy tables, or make a filesystem write into its server data directory.

## Ordered publication method

1. **Select completed sources.** Inspect the scoped catch-up inventory. Require validated normalized name/destination, current CSV bound to the exact source hash, expected columns and row count, date/amount/currency checks, page or stable row locators, and completed or unnecessary duplicate cleanup. Keep stale, ambiguous, OCR-draft and unsupported records out of automatic publication; record their reason and next action in the one quarter summary.
2. **Prepare a bounded projection.** Read the validated CSV and source metadata. Map each row to the target API schema with a stable key made from tenant, source version hash, account or document identity, and source row locator. Preserve signed minor-unit amounts, original currency, dates, source references and review status. Keep invoices/orders/receipts distinct from cash statement entries, and do not turn a booking-hub total into extra income. Do not publish an aggregate total as if it were a source row.
3. **Preflight the destination.** Authenticate, resolve the exact organization and business membership, read existing source/version and row keys through the API, and compare a bounded dry-run diff. Reject unknown tenant mapping, schema mismatch, source collision, changed source bytes, duplicate keys with different values, or a destination that cannot represent an unresolved field without inventing a value. A replacement is a reviewed new source version, never a silent overwrite or deletion.
4. **Write through the API.** Send only approved fields to the appropriate tenant endpoint. Prefer a versioned batch/import API with idempotency key, atomic source-and-row validation, per-row results and explicit draft/verified state. Retry only requests with a proven idempotent contract; after an uncertain timeout, read back before any retry. Never infer success from an HTTP submission alone.
5. **Verify and record the result.** Read back the destination's source version, accepted row keys/count, rejected rows and status through its API. Compare against the CSV and source hash. Record the destination, version/receipt, published row count, skipped/rejected row identities and next action in the applicable `_common/qN/summary.md`; do not create another durable aggregate CSV or status tree. API projection complete does not mark transactions reconciled, package ready, accountant reviewed or quarter closed.
6. **Resume safely.** On a new or corrected source version, re-run preflight and publish only the reviewed delta. Preserve the prior remote version and its audit trail. If the API or authorization is unavailable, leave `website publication pending` with the exact blocker and continue independent work. Do not fall back to direct database access.

## SC Financial Insights API adapter

The SC Financial Insights app exposes authenticated, organization-scoped APIs under `/api/financial-insights`. Its statement upload stores a PDF/PNG/JPEG original in the selected business/year/quarter folder and creates the source and statement together. Its statement batch endpoint validates 1–100 normalized rows before an atomic write. The batch binds row identity to the source SHA-256, account, page and row locator; identical replay returns the same entry IDs, while changed fields at an existing locator are rejected. All imported rows remain **unverified**. The document extraction endpoint separately versions invoice, receipt and estimate proposals; document publication is not a cash statement import.

For a **statement**, use the following bounded route only after the ordered intake method above is complete:

1. Resolve the destination organization, business and account through the authenticated API. Require the account to belong to the selected business and use the statement currency. Do not infer these IDs from a filename or a public demo account.
2. Require a validated source-adjacent CSV with exactly `posted_on,transaction_on,description,signed_amount_minor,currency,page_number,row_locator`, 1–100 rows, signed integer minor units and stable page/row locators. The current generic `statements` command does **not** produce this CSV for every bank format. A missing or incompatible extraction is `website publication pending`; do not invent a converter or send partial rows as a complete statement.
3. Upload the original bytes with `POST /organizations/{organizationId}/statement-uploads` and the documented `X-FI-Account-Id`, `X-FI-Period-Start`, `X-FI-Period-End`, `X-FI-Currency` and URL-encoded `X-FI-File-Name` headers. Read back the returned source and statement through the API. Compare the original download's SHA-256 to the canonical intake original. If the destination already contains an exact source, inspect its statement and rows before attempting another upload; do not create a duplicate on an uncertain response.
4. Run the bounded `sc-services/apps/financial-insights/financial-insights-backend/scripts/publish-statement-entries.mjs` adapter with `--csv`, `--organization`, `--statement` and `--base-url`. Supply its scoped token through `FI_API_TOKEN` from the approved secret environment. The adapter checks the tenant statement/source, downloads and hashes the original, sends one atomic batch, and reads the entries back. It accepts only HTTPS or loopback HTTP. Never place the token, private path, or real account ID in public docs or logs.
5. Compare imported/replayed counts, entry IDs and row keys with the selected CSV. Record the destination and outstanding review state in the existing quarter summary. An API receipt does not verify the source, reconcile cash, or close the quarter.

For an **invoice, receipt or estimate**, use the separate `sc-services/apps/financial-insights/financial-insights-backend/scripts/publish-document-extractions.mjs` only after its original has been uploaded and the extraction has been validated. It publishes source-backed fields as a review proposal, not a verified accounting result. Unsupported document families and ambiguous business routing remain pending.

The API has no reviewed replacement protocol for changed original statement bytes. A changed source hash or changed row at an existing locator requires a new reviewed source and mapping decision; do not silently overwrite the prior projection. The workflow's shared generic extraction-to-CSV adapter and automatic tenant mapping are not implemented for every provider, so this route is executable only for a source that already meets the explicit CSV and mapping prerequisites.

## Fictional acceptance scenarios

| Case | Expected result |
| --- | --- |
| Complete source | A validated fictional statement CSV and matching uploaded original publish once to the authorized tenant; API readback agrees on source hash and row keys. |
| Retry after uncertain response | The publisher reads the API receipt or source version first; replay creates no duplicate entries or documents. |
| Changed source | The publisher rejects the mismatch; a reviewed new-source mapping is required, with the old source retained. |
| Wrong tenant or ambiguous business | No row is sent; the quarter summary identifies the mapping decision needed. |
| Partial CSV | Valid rows are not presented as a complete statement; rejected or missing rows and coverage stay explicit. |
| Unsupported destination | No DB injection or ad hoc endpoint is used; publication remains pending while canonical intake evidence stays intact. |

The SC app's fictional API smoke scenario covers original storage, atomic rejection, retry, conflict and readback. The complete shared workflow remains pending wherever extraction or tenant mapping prerequisites are not met.
