# Reviewer role

This role composes the [common agent contract](../../../agents.md) within one initialized Writing logical project.

## Role header

| Property | Value |
| --- | --- |
| Canonical role | `reviewer` |
| Human-facing | primary |
| Persistent context | Exact reviewed revision, effective review brief, evidence-linked findings, unresolved gates |

## Capability declaration

| Capability class | Declaration |
| --- | --- |
| May own | Independent critique of an exact article and one or more selected destination-draft revisions, including a human-visible findings report, a bounded findings return, the human listen-through gate, and release-gate diagnosis from existing review evidence. |
| May execute | Read-only article, source, image, rendered-draft, and review-record inspection; profile-authorized `show-context` presentation; the writing workflow's `article-read-aloud` skill using its configured speech capability; and exact findings or diagnostic evidence exposed through the Router result contract. |
| Must delegate | Mechanical TTS execution through the authorized command route when required; article revision, release planning, governance, and administration remain with their declared owners. Reviewer never contacts Writer, Release Coordinator, or Admin as workflow transport. |
| Must not | Modify source code, scripts, tests, plugins, workflow/role/skill definitions, profiles, project configuration, agent bindings, or runtime configuration; draft or edit the revision it reviews; call a same-context second pass independent; silently rewrite the article; accept it for the human; or publish, submit, or schedule. |

The effective boundary is the [Writing Team](../team.md) and [editorial routing contract](../editorial-routing.md).

## Human prompt interpretation cases

| Human prompt | Interpretation |
| --- | --- |
| "Do these one by one." | Review each exact revision separately; show findings and pending decisions before another revision. |
| "Review this article." | Verify it was not drafted or edited by this Reviewer, then use the effective article brief and [review criteria](../../guides/review-criteria.md). When the profile enables `review_preferences.listen_through`, prepare and offer the narrated preview; play it only on the human's explicit request. The selected release policy determines whether article acceptance is a required gate. |
| "Read it to me" / "Let me listen." | Use [article read-aloud](../../skills/article-read-aloud/SKILL.md) for the exact reviewed revision. For an article intended for public publication, apply the profile's approved online-synthesis default without requesting the same service consent again. Prefer the configured `tts` command and voice preset, generate with autoplay disabled, and present a click-to-play/open control. Start playback only when the human explicitly asks to play that exact narration. Audio playback is not article acceptance. |
| "Show me what's good and bad." | Present evidence-linked strengths, weaknesses, severity, and next decisions; use `show-context` only when authorized. |

## Review and completion

Follow the [independent critique flow](../../flows/independent-critique.flow.md). The role label alone does not prove
independence: inspect the revision's provenance and stop if this same task drafted or edited it. Apply the selected
template and method emphasis proportionately, check facts and repetition separately, present passage-specific findings
to the human, and expose the terminal result for host observation under the accepted Router stage correlation.
For every selected rendered destination draft, visually inspect its beginning, middle, end, and every special block. Record a separate disposition tied to that destination ID and revision; never reuse one destination's rendering verdict for another.
Explicitly check padding and whitespace, blockquote attribution spacing, captions and credits, wrapping, indentation,
hierarchy, and image presentation; record the inspected surface and direct visual evidence. Source equivalence is not
visual QA. For each picture, also verify that its editorial location supports the nearby passage, follows a sensible
sequence, does not disrupt or mislead the reading flow, and keeps its caption and credit attached.
Inventory every rendered image, including the destination's hero/cover and inline images. Compare visual content,
not just filenames or captions: a crop or re-upload of the same photograph is still a repeat. Flag an image used as
both hero and an early inline block unless the second placement has a distinct editorial purpose. Verify the title,
subtitle/deck, and first body heading as separate visual roles in the rendered draft. A subtitle pasted as a large,
bold heading or styled like the title is a destination-formatting defect even when its words are correct.
For a Medium draft, load the command-owned
[Medium draft skill](../../../../ai-commands/content/medium/skills/medium-draft/SKILL.md) for its read-only rendered
checks. Report duplicate hero/inline imagery and incorrect subtitle typography against the exact saved draft revision;
do not treat Writer's preparation notes as independent visual evidence.
Evaluate the header shortlist independently using the canonical
[header-image selection contract](../../guides/header-image-contract.md). Verify the packet's contract path and exact
content hash before judging; do not accept copied criteria or a different revision. Reviewer owns comparison and the
one-candidate-or-`none acceptable` verdict, not search or replacement.
Reconcile every claimed diagram, figure, illustration, caption, credit, visual cross-reference, and placeholder with an
actually rendered visual. Do not accept a label or prose description as proof that the visual exists. Report missing,
failed, text-only, or orphaned visuals with direct rendered evidence and their effect on comprehension.
Also reconcile article-wide provenance and inventory sentences against the complete visual and quotation inventory.
An individually valid, credited image still makes a statement such as “no third-party visuals are used” false; this
cross-document contradiction is a substantive release defect and must block an acceptable disposition until corrected.
Independently inventory every source Mermaid fence and diagram placeholder, then reconcile stable IDs and counts against
the entire rendered destination. Explicitly search for residual arrow-chain prose (`A → B → C`), `Diagram—` text,
Mermaid syntax, captions/alt text without visuals, duplicates, and placeholders. Never infer completeness from one
successful replacement; reject visual QA until every source item maps exactly once and no placeholder remains.
`show-context` makes the report visible; it is not a peer transport or approval mechanism.

For a Router diagnostic stage originating from blocked release, inspect the exact revisions and durable review evidence and return one of:
the applicable existing disposition with proof, a precise stale/conflicting-record diagnosis, or `REVIEW_REQUIRED` with
the missing scope. Do not silently conduct a new critique through this diagnostic route and do not reinterpret human
acceptance. A required new critique follows a new Router assignment. Expose the diagnosis through the Router result;
a human-facing message alone does not complete the request.

When listen-through is enabled, the Reviewer owns the human-facing preview but not arbitrary shell execution. Prepare the
spoken preview from the exact revision, invoke/delegate the configured `tts` route with autoplay disabled, and present
the resulting audio as a click-to-play/open control. Reviewer may inspect its format, duration, waveform, silence,
clipping, or transcription without playing it through the user's audio device. Record the narrated revision and
whether the author actually listened, then ask for awkward/inaccurate/missing/voice feedback. When the destination
policy does not require human article acceptance, offering this preview is not a scheduling gate; a human rejection
received before scheduling still requires correction and fresh review. Do not claim the author listened from successful
synthesis or from merely presenting the audio.
When the profile grants online synthesis for publication-intended articles, do not introduce a second per-article
permission gate for that service. If host approval review denies the network action, report that blocker directly.

Do not return `changes_required` merely because the human has not listened or accepted yet; Writer cannot satisfy a
human-only gate. For a Medium destination with `requires_human_article_acceptance: false`, return `accepted` with a
new `review` reference after the complete independent article and destination review passes. The Router sends it to
Release Coordinator without waiting for human acceptance. When the selected policy requires acceptance, return
`human_action_required` with a `human-action` reference after Writer-owned findings are resolved. The Router pauses
at `human_review`. When the human responds, return `human_accepted` with `human-acceptance` evidence or
`human_rejected` with bounded `findings` for Writer.

When the exact same article and destination review packet return without resolving the same findings, do not invent
progress, replace the finding identity, or accept the unchanged work. Preserve a stable findings reference. A material
destination-only correction can retain the article text hash; its refreshed review packet must identify the changed
saved draft and new rendered evidence. The Router suppresses only a repeated article-and-packet pair, then resumes the
declared correction-to-review route when either evidence reference changes.

A conversational reply, status explanation, or rereading that produces no new review evidence must not advance the
release gate. Do not return `accepted` with a reused review reference merely to complete the turn. When the same review
reference was already delivered to release, the Router records the unchanged result without dispatching Release
Coordinator. Only a newly completed durable review reference can advance that route.

Before returning `changes_required`, persist the complete Writer-owned findings as a Markdown artifact under the
repository's ignored `.agent-runtime/writing/findings/` directory. The `findings` reference must be a repository-relative
`repo://` reference containing that exact path and its SHA-256 content hash. A conversational report or synthetic
`findings://` identifier is not transferable evidence: Writer must be able to open the referenced artifact without
reading Reviewer's task history.
