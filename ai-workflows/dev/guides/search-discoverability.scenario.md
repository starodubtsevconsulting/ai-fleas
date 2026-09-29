# Make a public site eligible for Google Search

Use this scenario when a human asks to make **one named public site** discoverable in Google Search. It is a task guide, not an activated workflow, ranking promise, or instruction to register a new agent. Follow the selected project's normal authority, coding, review, delivery, and deployment rules. Adapt the order when an existing site already satisfies a step.

Google decides whether and when to index a page. The achievable result is a site that can be crawled and understood, a verified Search Console property where access is available, and recorded evidence of what Google currently sees.

To reuse it, ask: **“Run the [search discoverability flow](../flows/search-discoverability.flow.md) for `<public site URL>` in `<authorized project>`. Use `<known owner/account>` for search verification, and preserve the working site.”** The operator fills the input table from the current project and account, executes applicable steps, and returns the run record with pending items. If access or a necessary public fact is missing, complete independent steps and name the exact blocker.

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

- [ ] In the selected project's authorized checkout and branch, fix only the observed crawl/routing and page-message gaps. Keep root robots/sitemap responses aligned with canonical pages; align initial HTML and client-navigation metadata; give priority pages useful visible content and links.
- [ ] Keep structured data truthful and applicable. Preserve the contact route, product paths, and any existing scheduling or purchase function unless the owner explicitly changes that scope.
- [ ] Run the project's applicable frontend/backend builds and focused checks; inspect the diff. Record pre-existing check failures separately from failures introduced by the candidate.
- [ ] Review and deliver the exact candidate through the authorized source-control and production route. After deployment finishes, read back service health, revision, page statuses, rendered copy, metadata, sitemap, robots, mobile layout, and contact navigation. A temporary restart response is not the final health result.

### Search account setup

- [ ] Check for an existing Google Search Console property in the authorized owner account. Choose the correct domain or URL-prefix scope and verification method. If DNS is selected, save only the required record, check public DNS, and read back **Ownership verified**. Do not save verification token values in a public work record.
- [ ] Submit the canonical sitemap in Search Console; read back submission status, processing/success state, and discovered page count. Distinguish an accepted sitemap from indexed pages.
- [ ] If Bing is in scope, check for an existing Bing Webmaster property, verify it using a working method, and submit the same canonical sitemap. If a live meta tag is not accepted, inspect the effective fetched URL and use an authorized alternative such as DNS CNAME; verify DNS and Bing's ownership result. Record Bing processing separately from Google success.
- [ ] Do not grant an optional broad DNS/account integration merely to replace a working manual verification record. Verify the requested scope and effects first.

### Crawl inspection and follow-up

- [ ] In Google URL Inspection, inspect the homepage and an inner page. Record indexed state, discovery source, last crawl, live-test availability, rendered HTML or screenshot, canonical, and crawl/index permissions.
- [ ] If live rendering is complete, defer SSR/prerendering unless another concrete failure warrants it. If content or metadata is missing, correct the rendering path and repeat the live test.
- [ ] Request indexing for materially changed priority URLs if useful; confirm the actual queue result. Do not repeatedly request the same page as a ranking tactic.
- [ ] Record measured mobile performance, contact usability, existing analytics/consent behavior, and any missing inquiry attribution. Add tracking only with a defined purpose and privacy behavior.
- [ ] Inventory existing owned LinkedIn, GitHub, product, and publishing profiles. Align only accounts you can verify and control; check map/listing eligibility before creating a business listing. Do not duplicate profiles or invent a customer-facing address.
- [ ] Revisit Search Console and Bing after processing. Track indexed pages, relevant branded/nonbranded queries, referrals, and qualified inquiries separately. Revise copy or distribution from evidence, not impressions alone.
- [ ] Update the work item and run record with links, exact status, remaining access/fact blockers, and the next review event. Leave optional chatbot or paid-search work out until a real need, conversion event, and budget are defined.

## Scenario

### 1. Capture the public baseline

Inspect the deployed site as a visitor and through HTTP. Record the effective URL after redirects, status codes, title, description, canonical, robots directive, main heading, important links, and contact path for each priority page. Fetch the origin's `/robots.txt` and `/sitemap.xml`; inspect the **edge response**, not just checked-in files. Note whether content exists in initial HTML or appears after JavaScript. Check mobile layout and the real contact flow without sending a test inquiry to a person unless that effect is authorized.

Save dated observations, including failures. Do not describe an empty initial app shell as proof that Google cannot index it; test Google's rendering in step 4.

### 2. Repair crawl and page foundations

Implement the smallest site-specific changes needed:

- Make priority public pages return successful responses at stable URLs. Fix redirect loops, broken navigation, and unexpected 404s without removing working routes.
- Serve a root sitemap containing only intended canonical, indexable URLs. Make the root robots response point to it and avoid blocking those URLs. Check hosting or CDN overrides that differ from repository files.
- Give each priority page a distinct, accurate title, description, visible H1, useful body copy, internal link path, and self-referencing canonical URL. Keep client navigation metadata in sync with initial HTTP metadata. Give unknown or private routes an appropriate noindex policy.
- Match the page to the approved audience and offer. Cite public work with accurate labels such as live product, open-source project, or experiment. Keep unsupported outcomes out of copy and structured data.
- Use structured data only for facts actually present on the page and appropriate to the entity. Do not add a local business address or review markup to manufacture search features.

Run the repository's applicable build, tests, and link checks. Review the diff and deploy through the project's authorized path. Read the deployed pages back; a local build alone is not production evidence. Preserve the working contact path throughout.

### 3. Verify site ownership and submit the sitemap

In the owner's Google Search Console account, check whether the exact domain or URL-prefix property already exists before adding one. Choose a verification method the owner controls. For DNS verification, add only the required record at the correct host, confirm public DNS propagation, and confirm the Search Console **Ownership verified** result. Record the property type and verification method, but never store tokens or account secrets in this reusable guide or a public report.

Submit the canonical root sitemap. Read back its status and discovered URL count. Submission is not an indexing guarantee. If the owner also uses Bing Webmaster Tools, repeat ownership and sitemap checks there under its own account and verification method; keep Bing status separate from Google's.

### 4. Ask Google what it sees

Use Search Console URL Inspection for at least the homepage and one important inner page. Record both the indexed result and **Test live URL** result:

- Is the URL available to Google, and is crawling/indexing allowed?
- What title, description, canonical, and meaningful body content appear in the tested page HTML or screenshot?
- Which sitemap and referring page led to discovery? Has Google crawled it yet? Is a different canonical selected?

If the live test renders the content correctly, JavaScript rendering alone does not justify an SSR migration. If the tested content or metadata is missing, investigate rendering and implement static rendering, prerendering, SSR, or a simpler accessible fix as the evidence warrants. Request indexing for a materially changed priority URL when appropriate; record the actual queue confirmation. Do not repeatedly submit the same URL to imply higher priority.

### 5. Check user experience and measurement

Inspect the mobile viewport and measure performance using available field data or a reproducible lab run. Record device, date, tool, and measured values; do not infer a score from file size alone. Fix concrete usability, loading, or contact problems. Keep optional tracking privacy-conscious and consistent with the site's consent and privacy behavior. Search Console provides queries and indexing data after processing; distinguish those from qualified inquiries and sales.

For external presence, inventory existing owned profiles before creating anything. Align the verified name, site URL, offer, and public contact route where account access exists. Check local-listing eligibility before claiming a map/business profile; an online-only service is not automatically a local storefront. Do not invent an address, reviews, or business history.

### 6. Close with evidence and a follow-up point

Report the live URLs and exact observations, search-property and sitemap states, inspected-page result, deployment revision, and remaining unknowns. Separate **deployed**, **submitted/discovered**, **crawled**, and **indexed**; each is a different state. Leave delayed search data pending rather than calling it complete. Recheck after search consoles have processed the sitemap and after enough inquiries or query data exist to support a change in messaging.

## Run record template

Keep this in the authorized project's work record, not in the reusable scenario. Do not include DNS tokens, credentials, private contact submissions, or unapproved strategy.

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
URL Inspection indexed result / live result / rendered content:
Bing property and sitemap status (if applicable):
Performance measurement / consent and inquiry measurement:
Existing external profiles changed or pending:
Outstanding facts, access, crawl, indexing, and follow-up date:
Checklist item states / evidence links / next owner:
```
