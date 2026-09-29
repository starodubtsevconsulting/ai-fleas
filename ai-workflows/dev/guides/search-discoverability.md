# Search discoverability guide

Use this guide with the [search discoverability flow](../flows/search-discoverability.flow.md) when a human asks to make **one named public site** discoverable in Google Search. The flow determines order and owners; this guide supplies the intake, practical checklist, and run record. Follow the selected project's normal authority, coding, review, delivery, and deployment rules. Mark already-satisfied work not applicable with evidence.

Google decides whether and when to index a page. The achievable result is a site that can be crawled and understood, a verified Search Console property where access is available, and recorded evidence of what Google currently sees.

To reuse it, ask: **“Run the search discoverability flow for `<public site URL>` in `<authorized project>`. Use `<known owner/account>` for search verification, and preserve the working site.”** The operator fills the input table from the current project and account, executes applicable steps, and returns the run record with pending items. If access or a necessary public fact is missing, complete independent steps and name the exact blocker.

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

### Public crawl baseline

- [ ] Read `GET /`, every priority page, `/robots.txt`, and `/sitemap.xml` from the public origin. Record status, redirects, effective URL, edge/CDN overrides, sitemap URLs, and canonical consistency.
- [ ] Compare initial HTML and browser-rendered HTML: route title, description, canonical, robots meta, H1, body copy, internal links, and indexability. Inspect mobile layout and contact controls without sending a real inquiry by accident.
- [ ] Record actual browser and HTTP failures, including broken root routes, loops, missing assets, unknown-route behavior, and JavaScript-only content. Treat the latter as a testable risk.

### Site change and production read-back

- [ ] In the selected project's authorized checkout and branch, fix only the observed crawl/routing and page-message gaps. Serve a root sitemap of intended indexable canonical URLs and a root robots response that points to it without blocking those URLs. Align initial HTML and client-navigation metadata; give each priority page a distinct title, description, visible H1, meaningful content, useful links, and self-referencing canonical. Apply appropriate noindex treatment to unknown or private routes.
- [ ] Keep structured data truthful and applicable. Preserve the contact route, product paths, and any existing scheduling or purchase function unless the owner explicitly changes that scope.
- [ ] Run the project's applicable frontend/backend builds and focused checks; inspect the diff. Record pre-existing check failures separately from failures introduced by the candidate.
- [ ] Review and deliver the exact candidate through the authorized source-control and production route. After deployment finishes, read back service health, revision, page statuses, rendered copy, metadata, sitemap, robots, mobile layout, and contact navigation. A temporary restart response is not the final health result.

### Search account setup

- [ ] Check for an existing Google Search Console property in the authorized owner account. Choose the correct domain or URL-prefix scope and verification method. If DNS is selected, save only the required record, check public DNS, and read back **Ownership verified**. Do not save verification token values in a public work record.
- [ ] Submit the canonical sitemap in Search Console; read back submission status, processing/success state, and discovered page count. Distinguish an accepted sitemap from indexed pages.
- [ ] If Bing is in scope, check for an existing Bing Webmaster property, verify it using a working method, and submit the same canonical sitemap. If a live meta tag is not accepted, inspect the effective fetched URL and use an authorized alternative such as DNS CNAME; verify DNS and Bing's ownership result. Record Bing processing separately from Google success.
- [ ] Open Search Console's property Messages after verification and during follow-up. Record each message's title, date, affected property, type, and disposition: informational, actionable, or awaiting evidence. Treat a new-property welcome note as informational; it does not prove an indexing issue. For warnings, use the linked Search Console report and a live-site check to confirm the affected URLs before fixing or dismissing anything. Review Bing site notices the same way when available. Do not grant access, enable integrations, or change site behavior merely because a message suggests it.
- [ ] Do not grant an optional broad DNS/account integration merely to replace a working manual verification record. Verify the requested scope and effects first.

### Crawl inspection and follow-up

- [ ] In Google URL Inspection, inspect the homepage and an inner page. Record indexed state, discovery source, last crawl, live-test availability, rendered HTML or screenshot, canonical, and crawl/index permissions.
- [ ] If live rendering is complete, defer SSR/prerendering unless another concrete failure warrants it. If content or metadata is missing, correct the rendering path and repeat the live test.
- [ ] Request indexing for materially changed priority URLs if useful; confirm the actual queue result. Do not repeatedly request the same page as a ranking tactic.
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
