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
```
