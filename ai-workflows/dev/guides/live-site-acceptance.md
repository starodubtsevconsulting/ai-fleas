# Live-site acceptance guide

Use this as Stage 2 of the [search discoverability flow](../flows/search-discoverability.flow.md) for one named public site. The earlier [search guide](search-discoverability.md) establishes crawl and search-account evidence. This guide establishes whether people can use the deployed site and whether its durable data can be recovered. The selected project's own smoke scenarios supply exact routes, roles, and expected content. Do not copy another site's business rules into a new site's acceptance criteria.

To reuse the whole flow, ask: **“Run the search discoverability flow, including live-site acceptance, for `<public site>` in `<authorized project>`.”** Provide the site's owner/operator, production target, authorized test roles and mailbox, and any permitted sandbox transaction. Missing access leaves only dependent checks pending; continue independent public and recovery checks.

## Prepare the run

- Record site origin, environment, browser/device, date/time/timezone, current deployed revision, service owner, source-control branch, tracker item, and the approved account roles/mailbox. Verify a test account's role before opening private pages. Keep credentials, tokens, cookies, and private contact content out of the report.
- Enumerate the site's actual user journeys: navigation, public content, conversion/contact, account access, and any booking, purchase, publication, or other state-changing journey. Mark a journey `not applicable` only with a reason. Define the safe stopping point for each transaction before testing.
- Preserve a baseline before restart or deployment. Use the project's controlled restart/release path only when authorized; then confirm the exact revision and service state. A successful restart command is not proof that the browser works.

## Check live behavior

For every applicable row, record `pass`, `fail`, or `not run`, URL, visible result, and screenshot/error for a failure. Browser behavior is distinct from HTTP or server evidence. Repeat affected checks after a fix; do not reuse an earlier result as a current pass.

| Area | Browser check | Evidence boundary |
| --- | --- | --- |
| Public entry | Open HTTPS origin and priority routes; follow redirects; confirm expected site, copy, navigation, legal/footer links, and no persistent loading state. | Final URL, TLS/status, visible content. |
| Assets and mobile | Inspect logos, fonts, images/media, icons, and at least two gallery items when present. Use a mobile viewport and actually open its navigation. Confirm asset responses are files, not HTML fallbacks. | Browser rendering and asset type; record viewport. |
| Public content | Open representative detail pages and a profile/list/filter view where applicable. For migrated content, check named samples, full body, author/date/version/category, and any known filter or date-range discrepancy. | Exact URLs and content observed; an empty filtered view alone does not prove missing data. |
| Accounts | In a signed-out session, inspect sign-in, sign-up, Google or other configured provider, and reset UI. With authorized disposable/test identities, exercise sign-in/out, incorrect-password handling, safe reset, and the actual role-gated view. | Distinguish a rendered control from successful access. Never record a password or reset token. |
| Contact/email | Submit one uniquely labeled browser form message from the designated test identity. Verify the UI result, server acceptance, and actual arrival in the designated mailbox separately, including subject, sender/reply-to, and time. | Do not infer delivery from a success toast or SMTP acceptance. Do not repeatedly resend a delayed message. |
| Transaction preview | Select plausible input (for example dates, quantity, or plan), inspect constraints, price/fees, cart, and checkout summary where applicable. Stop before a real booking, charge, publication, deletion, or account mutation. | Mark the final transaction and notifications `not run` unless an exact sandbox or approved transaction is available. |

If a safe authenticated check needs an account or mailbox that is unavailable, name its owner and recovery point. Continue public checks. A checkout that requires login is only a passed login gate, not a passed price/cart preview.

## Check recovery and operations

- Verify the selected production service and dependencies after a controlled restart or deployment: active status, health endpoint, browser read-back, expected revision, and recent error logs. Record the commands/provider views actually used; no fixed host or service name is implied by this guide.
- For a site with durable data, verify backup schedule and latest successful run, checksum/integrity, included database and media/object data, and an off-host copy where required by its recovery policy.
- Restore a current backup into an isolated target. Query representative restored records and extract or inspect media files; clean up the disposable restore only after recording evidence. A checksum or archive listing alone is not an isolated restore. Distinguish a same-host restore from full host-loss recovery.
- Record monitoring signals, alert owner, last known good revision, and the authorized rollback method. Keep data rollback separate from code rollback; never overwrite live data for a smoke check.

## Exit and report

Use one run record per site, or one matrix with separate site columns when accepting a coordinated release. Include:

```text
Site / environment / deployed revision / date and timezone:
Browser and viewport / test role / designated mailbox (no secrets):
Controlled restart or release and post-change service evidence:
Public routes, mobile, assets, and representative content — pass/fail/not run + URLs:
Account and role flows — pass/fail/not run + URLs:
Contact UI / server acceptance / mailbox receipt — separate results:
Transaction preview and deliberately untested final steps:
Backup schedule, off-host copy, isolated database/media restore:
Monitoring and authorized code/data rollback:
Failures, smallest reproduction, linked follow-up items:
Access blockers, owner, next action, and next review event:
```

Create specific follow-up work for failures. Keep the parent acceptance item open while a required safe flow lacks evidence. Close only when required safe flows pass and excluded or irreversible transactions are explicitly marked `not run` with the reason. Delayed search indexing remains a separate Stage 1 follow-up and does not become a live-site pass.
