# Search discoverability guide

Use this guide as Stage 1 of the [search discoverability flow](../flows/search-discoverability.flow.md) when a human asks to make **one named public site** discoverable in Google Search. The flow includes a [human-readable registration and execution diagram](../flows/search-discoverability.flow.md#where-it-is-registered-and-how-to-run-it) and continues into the [live-site acceptance guide](live-site-acceptance.md) as Stage 2 and the [buyer-journey and optimization guide](site-buyer-journey.md) as Stage 3. The flow determines order and owners; the guides supply the checklists and run records. Follow the selected project's normal authority, coding, review, delivery, and deployment rules. Mark already-satisfied work not applicable with evidence.

For bounded SEO Phase 1 or maintenance, select the flow's bounded entry and the `seo-audit` mode below;
the full three-stage sequence is not automatically required.

Google decides whether and when to index a page. The achievable result is a site that can be crawled and understood, a verified Search Console property where access is available, and recorded evidence of what Google currently sees.

To reuse the full flow, ask: **“Run the search discoverability flow, including live-site acceptance and buyer-journey optimization, for `<public site URL>` in `<authorized project>`. Use `<known owner/account>` for search verification and preserve the working site.”** The operator fills the input table from the current project and account, executes applicable steps, then follows Stages 2 and 3. If access or a necessary public fact is missing, complete independent steps and name the exact blocker.

## Inputs to resolve

Record these before changes. Unknown values stay unknown; do not infer them from a nearby repository or account.

| Input | Record |
| --- | --- |
| Public origin and priority URLs | Exact `https://` origin and the pages intended for search |
| Authorized project | Repository, visible checkout, branch, deployment target, and applicable project rules |
| Site owner and access | Who controls hosting, DNS, Google Search Console, and any other search account |
| Audience and offer | Who the site serves and what each priority page should help them do |
| Public proof | Links and verified maturity labels for cited work; no invented client results |
| Languages and location | Only what the owner confirms and can maintain |
| Conversion | A working contact or purchase path and what counts as a qualified inquiry |

If a fact needed for a public claim is missing, draft neutral copy or leave that claim unpublished. Account verification, DNS changes, deployment, and profile edits use the authority and approval already established for the exact site and account. A search-property login does not authorize unrelated account access.

## Work plan and evidence checklist

Copy this checklist into the selected site's work record. Mark each item `done`, `not applicable` with a reason, or `pending` with an owner and next action. Keep proof beside the item; a successful command or submitted form is not proof of the resulting public state.

### Scope and positioning

- [ ] Resolve the exact site, project, branch, production target, rules, account owner, priority pages, and tracker item.
- [ ] Confirm the first audience, offer, desired inquiry, language/region, and which public projects may be cited. Label live work, open source, experiments, and client results accurately; keep unconfirmed claims out of published copy.
- [ ] Capture the current homepage and services message, public project/profile links, and contact path. Preserve working site functions during changes.

### Technical SEO foundation and verification

Use [`seo-audit`](../../../ai-commands/development/seo-audit/seo-audit.command.md) as the single technical
checklist and evidence contract. Select `initial` for setup, `regression` after relevant website changes, or
`post-deployment` for live read-back. Record its route matrix and acceptance evidence in the selected site's work record.
It covers metadata, canonical URLs, locales, image alternatives, sitemap/robots/private routes, structured data,
production builds, browser refresh/slow-JS/no-JS behavior, and Google-rendered content. Preserve the producing
workflow's role ownership and authorization gates. Scope broader stages separately for bounded SEO maintenance.

### Search account setup

- [ ] Check for an existing Google Search Console property in the authorized owner account. Choose the correct domain or URL-prefix scope and verification method. If DNS is selected, save only the required record, check public DNS, and read back **Ownership verified**. Do not save verification token values in a public work record.
- [ ] Reuse an existing canonical sitemap submission; submit only if needed and authorized in Search Console; read back submission status, processing/success state, and discovered page count. Distinguish an accepted sitemap from indexed pages.
- [ ] If Bing is in scope, check for an existing Bing Webmaster property, verify it using a working method, and submit the same canonical sitemap. If a live meta tag is not accepted, inspect the effective fetched URL and use an authorized alternative such as DNS CNAME; verify DNS and Bing's ownership result. Record Bing processing separately from Google success.
- [ ] Open Search Console's property Messages after verification and during follow-up. Record each message's title, date, affected property, type, and disposition: informational, actionable, or awaiting evidence. Treat a new-property welcome note as informational; it does not prove an indexing issue. For warnings, use the linked Search Console report and a live-site check to confirm the affected URLs before fixing or dismissing anything. Review Bing site notices the same way when available. Do not grant access, enable integrations, or change site behavior merely because a message suggests it.
- [ ] Do not grant an optional broad DNS/account integration merely to replace a working manual verification record. Verify the requested scope and effects first.

### Crawl inspection and follow-up

- [ ] Record the `seo-audit` Console inspection and live-rendering evidence alongside account setup results; distinguish the indexed snapshot from the current live test.
- [ ] Request indexing for materially changed priority URLs only when specifically authorized and useful; confirm the actual queue result. Do not repeatedly request the same page as a ranking tactic.
- [ ] Record measured mobile performance from field data or a reproducible lab run, with date, device, tool, and values. Record contact usability, existing analytics/consent behavior, and any missing inquiry attribution. Add tracking only with a defined purpose and privacy behavior; do not infer a performance score from asset size alone.
- [ ] Inventory existing owned LinkedIn, GitHub, product, and publishing profiles. Align only accounts you can verify and control; check map/listing eligibility before creating a business listing. Do not duplicate profiles or invent a customer-facing address.
- [ ] Revisit Search Console and Bing after processing. Track indexed pages, relevant branded/nonbranded queries, referrals, and qualified inquiries separately. Revise copy or distribution from evidence, not impressions alone.
- [ ] Update the work item and run record with links, exact status, remaining access/fact blockers, and the next review event. Leave optional chatbot or paid-search work out until a real need, conversion event, and budget are defined.

## Run record template

Keep this in the authorized project's work record, not in the reusable guide. Do not include DNS tokens, credentials, private contact submissions, or unapproved strategy.

```text
Date / operator:
Execution mode / roles actually performed / independent gates:
Site origin / priority URLs:
Authorized project / branch / deployed revision:
Audience / offer / public-proof decisions:
Baseline HTTP, metadata, robots, sitemap, mobile, contact:
Changes and build/test evidence:
Live URL read-back:
Google property / ownership state / sitemap status:
Search Console and Bing messages / type / disposition / evidence:
URL Inspection indexed result / live result / rendered content:
Bing property and sitemap status (if applicable):
Performance measurement / consent and inquiry measurement:
Existing external profiles changed or pending:
Outstanding facts, access, crawl, indexing, and follow-up date:
Checklist item states / evidence links / next owner:
```
