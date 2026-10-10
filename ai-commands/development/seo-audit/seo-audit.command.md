# SEO audit

## Purpose

Audit technical search foundations before changing them, implement only authorized gaps through the producing
workflow, and verify crawler access together with visitor behavior. Reuse existing metadata, routing, sitemap,
and rendering facilities. This is a bounded technical SEO Phase 1 contract, not a redesign or ranking guarantee.

## Inputs

| Input | Required | Source | Description |
| --- | --- | --- | --- |
| Authorized profile, workflow, and project | Yes | Verified caller | Exact scope and applicable role, account, and delivery rules. |
| Public origin and mode | Yes | Assignment | One canonical origin; `initial`, `regression`, or `post-deployment`. Run separately for each named site. |
| Routes, languages, and candidate | Yes | Project and audit | Public/private route inventory, maintained locales, branch/revision; affected routes and shared components for regression. |
| Site facts and baseline | Conditional | Project-owned record and verified owner facts | Existing SEO, truthful business/property facts, previous evidence, and unresolved issues. |
| Deployment and search-account access | Conditional | Explicit authorization | Exact target and authorized account; missing access remains pending rather than inferred from a login. |

## Outputs

| Output | Destination | Description |
| --- | --- | --- |
| Audit and evidence record | Authorized project's work record | Dated route matrix, existing foundations, gaps, candidate/revision, checks, and remaining owners. |
| Bounded implementation handoff | Producing workflow | Minimal changes and acceptance evidence; implementation, tests, review, and deployment retain their normal owners. |
| Follow-up disposition | Caller and authorized tracker | External setup, delayed crawl/indexing, opportunities, and a review date; no automatic account or scheduling effects. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
| --- | --- | --- |
| `seo-audit/seo-audit.command.md` | AI-readable contract | Resolve authorized invocation inputs and execute applicable checks through the producing workflow. |

Every invocation is profile-aware: verify the workflow permits this command and resolve the selected project's
scope before execution. This is a contract-only command; there is no executable scanner, autonomous model session,
or automatic account integration. `ai.powered: false` does not replace the caller's semantic audit responsibility.

Committed configuration template: `seo-audit/seo-audit.command.example.config`. If configuration is needed, copy
the template into the selected profile, reference it through `commands[].config`, and resolve it through
`AI_COMMAND_CONFIG_PATH`. The committed example is never operational configuration.

## Supported Prompts

- “Run initial SEO Phase 1 for `<origin>` in `<authorized project>`.”
- “Run SEO regression checks for `<origin>` after `<candidate/change>`.”
- “Verify the deployed SEO changes for `<origin>` at `<revision>`, including Search Console when accessible.”

## Modes and boundaries

| Mode | Scope and exit |
| --- | --- |
| `initial` | Inventory first, propose minimal gaps, implement through authorized workflow gates, and verify the candidate. Deployment and account changes require their own authorization. |
| `regression` | Compare affected routes and shared SEO/rendering components against the baseline. Include representative unaffected routes; broaden only for observed shared impact. Return defects to implementation. |
| `post-deployment` | Read-only verification of the exact live revision and available search reports. Report failures and hand off fixes; do not silently change production or account settings. |

Preserve booking logic, pricing, payments, integrations, authentication, and working navigation. Avoid unnecessary
dependencies, copy/positioning changes, and redesign. Do not migrate to SSR merely because a site uses client
rendering: demonstrate missing crawler content or another concrete requirement first. Record whether rendering is
CSR, SSR, static generation, or prerendering; do not call a metadata response or noscript fallback full SSR.

The command grants no new authority. Source edits, registered test/build commands, independent review, UI acceptance,
delivery, account/DNS changes, sitemap submission, indexing requests, and tracker/calendar/scheduler writes remain
with their authorized owners. A read-only Console check does not authorize those writes. Reuse existing properties
and submitted sitemaps; do not duplicate working setup. Never record credentials or verification tokens in public artifacts.

## Audit and acceptance checklist

For every applicable item record `pass`, `fail`, `pending`, or `not applicable` with evidence and a reason.
Inspect existing facilities and configuration before adding replacements.

1. Inventory public and private routes, locales, redirects, canonical host/protocol, rendering strategy, metadata
   ownership, sitemap/robots generators, HTTP headers, and CDN overrides. Identify indexing blockers and unknown-route
   behavior. Shared infrastructure changes require checks on other affected sites.
2. Compare initial response HTML with browser-rendered HTML and client navigation for route-specific titles,
   descriptions, canonical URLs, robots directives, headings, meaningful visible content, and internal links.
   Use distinct accurate titles/descriptions for indexable pages and English/French metadata only where those
   maintained versions exist. Check locale/hreflang relationships when applicable; do not invent translations.
3. Verify canonical URLs are absolute, resolve successfully without loops, and agree with redirects, internal links,
   Open Graph URL/title/description/image/locale, and sitemap entries. Check useful image alternatives; decorative
   images use empty alt text, content images use descriptive text without keyword stuffing.
4. Fetch and parse the XML sitemap: valid XML, correct absolute canonical URLs, successful indexable destinations,
   maintained locales, and no private, redirected, duplicate, error, or noindex pages. Use truthful modification dates.
   Inspect sitemap indexes and referenced files when present.
5. Fetch robots.txt from the canonical origin; check status, syntax, sitemap location, and rules applicable to Googlebot.
   Inspect both robots meta and X-Robots-Tag. Private booking/account/admin pages must not be indexed. Robots disallow
   alone does not remove a URL from search and may prevent reading noindex. Choose crawl/noindex/access controls
   deliberately; authentication protects private data. Do not expose private content just to make noindex observable.
6. Use truthful structured data matching visible page facts and the actual entity. At execution time consult current
   official Google Search Central requirements for the selected type and record the source/date. Validate JSON syntax,
   entity relationships, required fields, and applicable eligibility with Google's Rich Results Test and/or a schema
   validator. A valid generic lodging/business entity does not guarantee a supported rich result. Never invent
   ratings, amenities, prices, identifiers, or vacation-rental eligibility to satisfy a validator.
7. Have the workflow's execution owner run relevant existing tests and affected production builds. Separate existing
   failures from candidate failures. Check HTTP statuses, redirects, sitemap and robots responses, and changed routes.
   Do not introduce tests that merely mirror markup or new tooling without a demonstrated need.
8. Verify phone/desktop direct loads, refresh, client navigation, slow JavaScript, and JavaScript-disabled behavior.
   Confirm no unstyled fallback flash, missing main content, layout regression, or broken safe navigation. Do not
   hide SEO text using background colors or other crawler-only tricks. Noscript content must be useful to no-JS
   visitors; it is not proof that Google rendered the actual application. Never perform real transactions for testing.
9. When deployment is authorized, read back the exact deployed revision, health, representative routes and assets,
   metadata, sitemap, robots, and affected neighboring sites. A merged PR, local build, or HTTP 200 alone is insufficient.
10. With authorized Search Console access, inspect existing sitemap status, last read date and discovered counts,
    indexed homepage and representative inner/locale pages, last crawl, user canonical and Google-selected canonical.
    Run a live smartphone URL test for changed rendering; inspect tested HTML/screenshot for actual main content and
    resource failures. Classify blocked optional services separately from missing content-critical bundles. Read-only
    inspection may proceed; settings/submissions/index requests require specific authorization. Missing access is pending.

## Evidence record and follow-up

Keep one record per site in its authorized project, with reusable instructions here rather than production details.

```text
Date / operator / authorized project / mode:
Origin / branch / candidate / deployed revision and environment:
Rendering strategy / locales / route inventory:
Route | intended indexability | HTTP/redirect | initial and rendered metadata/content | canonical | evidence/status
Existing foundations / implemented gaps / unchanged protected behavior:
Robots and sitemap validation / canonical URL count:
Structured-data types / current official requirements URL and date / validator result and limitations:
Tests and production builds / browser refresh and slow-JS/no-JS evidence:
Live health, assets, safe navigation, and shared-site checks:
Console property / sitemap last read and discovered count:
Indexed result / last crawl / Google canonical / live test time and rendered content:
Remaining failures or access blockers / owner / next action:
External setup / remaining opportunities / follow-up date:
```

Distinguish deployed, crawlable, sitemap-discovered, indexed, and ranking outcomes. A successful live test does not
prove indexing; an older indexed snapshot does not verify today's deployment. Compare crawl and sitemap-read dates
with deployment before treating stale counts as regressions. Delayed Google processing alone must not hold a PR open
after technical acceptance passes; report pending external evidence separately.

Propose a recheck after 7–14 days or the next significant site change. Create a one-time scheduled follow-up and/or
calendar reminder only when requested, recording the destination, time zone, owner, and whether unchanged results
should stay quiet. Do not create duplicate reminders. Recheck sitemap reads, crawl dates, canonical selection, indexing
reasons, and rendered content; pause a one-time automation after its check. Missing sessions remain an explicit limitation.

The [Dev search discoverability flow](../../../ai-workflows/dev/flows/search-discoverability.flow.md) coordinates
this command with existing implementation, verification, and delivery gates. Broader positioning, conversion,
distribution, and performance work are separate opportunities unless explicitly selected.
