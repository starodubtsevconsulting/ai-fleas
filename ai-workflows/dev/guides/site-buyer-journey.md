# Site buyer-journey and optimization guide

Use this as Stage 3 of the [search discoverability flow](../flows/search-discoverability.flow.md) for any named public site. Stages 1 and 2 establish crawl/search-account evidence and live-site acceptance. This stage asks whether a prospective visitor can understand the offer, trust the proof, and reach the conversion path on a phone and desktop. It also turns observed technical friction into a verified fix and leaves unapproved claims as proposals. Use the selected site's own products, routes, audience, and approval policy; the example path below is a pattern, not a required information architecture.

To reuse the whole sequence, ask: **“Run the search discoverability flow, including live-site acceptance and buyer-journey optimization, for `<site>` in `<authorized project>`.”** A site already registered with Google and Bing starts from current evidence and marks repeated registration steps done or not applicable. Delayed indexing is a follow-up measurement, not a reason to resubmit a healthy sitemap repeatedly.

## Prepare and walk the path

- Resolve the site, authorized project and branch, production target, tracker item, current deployed revision, audience, main offer, approved proof facts, desired conversion, and content approver. Preserve the working site and previous acceptance evidence.
- Choose a real visitor path: **Home → offer page or product/proof page → detail if needed → Contact or purchase entry**. Include both offer and proof branches when both are important. Use a desktop viewport and at least one phone viewport; record exact dimensions, browser, date, and signed-in state. Start from the public origin, use visible controls, and note where a new visitor is likely to stop or take the wrong path.
- At each page answer four questions from visible content: **Who is helped? What is offered? What work or evidence supports it? How does the visitor contact or buy?** Record the text and where it appears, including what is visible before scrolling on the phone. Do not invent roles, results, customer names, or maturity claims for portfolio work.
- Follow every primary CTA and relevant navigation link. Check final URLs, redirects, 404s, external destinations, return paths, meaningful link labels, and whether inquiry context survives into the contact form. Inspect the form without sending a real message unless a designated test identity and mailbox are authorized.
- Inspect phone and desktop layout for clipping, horizontal overflow, obscured controls, loading states, image dimensions, and usable form inputs. Use the keyboard to reach navigation and CTAs in a logical order; verify native link/button semantics, visible focus, accessible icon names, labels, and heading order. Inspect more than the homepage when acceptance evidence previously covered only that page.
- Measure performance with a named field source or reproducible lab run when available. Record device, date, tool, URL, metric values, and limitations. Separate a tested rendering reduction from a bundle-size reduction or a Core Web Vitals result. When a measurement tool is unavailable or quota-limited, record the gap and make no numeric score claim.

## Decide and change

Classify each finding as a reproducible **technical defect**, a **message/proof proposal**, a **measurement question**, or **not applicable**. Include page/viewport, smallest reproduction, impact on the visitor, and proposed next step. Rank by blocked contact or access first, then severe confusion, then polish. An HTTP 200 proves only an HTTP response; a screenshot of one viewport proves only that view.

- Fix bounded technical defects through the selected project's normal design, coding, review, test, and deployment gates. Keep functional behavior and conversion routes intact. For shared components, inventory every consuming frontend and build each affected production configuration, including the deployment configuration that can use different TypeScript libraries or base paths. Run focused tests that cover the changed behavior and record unrelated suite failures separately.
- Draft positioning and CTA wording in the project's work record. Show the owner the proposed copy, its location, factual basis, and any decision about secondary offers. Obtain the approval required by the selected project before publishing new claims or changing the core message. Technical work can proceed independently while that decision is pending.
- Before deployment, record the last known good revision and authorized rollback path. After deployment, inspect the exact live revision, production build and service logs, error responses during and after restart, desktop and phone paths, keyboard links, contact context, and other sites that consume shared code. If a release fails, use the authorized code rollback, verify the prior site works, correct the candidate, rebuild affected targets, and repeat live read-back. Do not count a restart command or `active` service status alone as a pass.
- Update the tracker and dated run record with fixed issues, proposed copy awaiting review, what was published, failed or unrun checks, owners, and next actions. Schedule or name a later observation for field performance, search queries/referrals, and qualified inquiries. Keep **deployed**, **discoverable**, **crawled**, **indexed**, and **converted** as separate states.

## Run record template

Keep actual URLs, names, screenshots, release IDs, and private account details in the selected project's authorized work record, not in this reusable guide.

```text
Site / project / tracker / owner / date:
Branch / deployed revision / last known good revision:
Audience / offer / approved proof facts / desired conversion:
Browser, desktop viewport, phone viewport, signed-in state:
Path A: Home → offer → detail → contact; URLs, four questions, CTA and keyboard result:
Path B: Home → proof/product → detail → contact; URLs, four questions, CTA and keyboard result:
Layout, assets, focus/semantics, broken links, form context — pass/fail/not run with evidence:
Performance source, date, device, metrics, or explicit unavailable reason:
Technical defects, impacted consumers, fixes, focused tests, production builds:
Deployment/rollback read-back, service logs, other-site smoke results:
Copy/proof proposals, owner decision, published version or pending approval:
Google/Bing property, sitemap, message and URL-inspection status carried from Stage 1:
Indexed/query/referral/inquiry measurements still pending; next review event:
Access blockers and acceptance recovery point:
```

Stage 3 can complete its technical review while copy approval or delayed field data remains pending, but report those decisions and outcomes as pending. Do not close a parent acceptance item whose required safe flows still lack evidence.
