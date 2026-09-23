# Header-image provenance: What Do We Gain by Generating Images Locally?

## Status

- Candidate count commissioned: **4** (initial attempt, controlled retry, recovery attempt, and fresh routing-test candidate)
- Original generated asset: not retained after the accepted crop; SHA-256 recorded below
- Accepted cropped header: `notes/articles/assets/2026-09-23-local-images-header-final.png`
- Disposition: **deterministic crop removed the complete text-bearing strip; cropped derivative accepted by Writer
  visual QA**
- Attempt date: 2026-09-23
- Article source: `notes/articles/2026-09-23-what-do-we-gain-by-generating-images-locally.md`
- Canonical contract: `ai-workflows/writing/guides/header-image-contract.md`

The protected service withheld the initial candidate and the first controlled retry. After the evaluator's stale model
state was recovered, one further explicitly authorized attempt was released. Its hash and QA findings remain preserved
as evidence, while the rejected source PNG is not retained. A deterministic editorial crop removed the complete shallow text-bearing top strip without generative
alteration, and the clean derivative is linked from the unpublished draft.

## Resolved provider contract

- Profile: `sc`
- Workflow: `writing.workflow.md`
- Capability: `image_generation`
- Default provider: `local-gx10`
- Command: `local-image-benchmark`
- Generator binding: `writing-local-qwen`
- Host reference / SSH alias: `ai-box`
- Mode: `qwen-image`
- Model reported by health: `Qwen/Qwen-Image`
- Policy profile: `education-child`
- Evaluator: `local-multimodal`
- Semantic input gate configured: `true`
- Semantic output gate configured: `true`
- Generation endpoint: loopback `http://127.0.0.1:8000/v1/images/generations` through the authorized local host

## Attempt 1 — exact prompt and settings

> A cinematic editorial illustration about owning an image-generation workflow locally. A compact matte-black local
> compute box sits inside a clearly defined warm-lit studio boundary, connected by restrained glowing paths to a large
> display showing a freshly created abstract landscape image. A human editor is present only as natural hands adjusting
> a physical control beside the machine, emphasizing direct control and responsibility. The scene is orderly and
> purposeful, with no robots, no cloud symbols, no corporate logos, no branded hardware, no books, no mugs, no loose
> papers, no decorative desk clutter, and absolutely no words, letters, numbers, captions, interface labels, slogans,
> watermarks, or embedded text. Wide editorial header composition, one dominant focal story, realistic materials,
> subtle cinematic lighting, technically plausible connections, generous negative space, calm and trustworthy rather
> than futuristic spectacle.

- Requested size: `1344x768`
- Requested steps: `30`
- Requested seed: `23092026`
- Requested response format: `b64_json`
- Durable request: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header-request.json`

## Gate and response evidence

Service health before generation reported:

```json
{"status":"ready","generation_policy":"education-child","semantic_input":true,"semantic_output":true,"model":"Qwen/Qwen-Image"}
```

The service journal recorded the following bounded decisions for this request:

```text
input  decision=allow reason_code=policy_allow latency_ms=4002.64
output decision=deny  reason_code=semantic_policy_denied latency_ms=7429.61
POST /v1/images/generations -> HTTP 400 Bad Request
```

The input gate therefore allowed the request. Local inference ran. The output gate denied release, and the endpoint
returned HTTP 400. No `b64_json` response, PNG, file hash, or image dimensions were available to the caller.

## Visual review

No visual review was possible because the protected output gate correctly withheld the candidate. It would be false to
describe visible content, verify the absence of embedded text, calculate crop behavior, or issue an `accept` verdict.

- Strength: policy enforcement prevented an unapproved candidate from entering the editorial asset set.
- Weakness: the bounded denial reason does not reveal whether this was a true policy violation or false positive.
- Verdict: **reject / unavailable**.

No stock image, cloud generator, alternate local model, or placeholder was substituted after attempt 1. The only next
generation was the separately authorized controlled retry documented below.

## Attempt 2 — controlled retry

The human explicitly authorized exactly one retry through the same resolved route. The concept was simplified to remove
people, body parts, screens, interfaces, text, logos, and potentially sensitive motifs. No provider, model, policy, or
gate was changed.

> A simple abstract editorial still life about local ownership of image generation. One compact matte-black compute box
> rests within a warm geometric pool of light. Three restrained colored paths extend from the box toward one clean
> floating abstract image plane made only of soft color fields and geometric shapes. Generous negative space, wide
> horizontal header composition, calm precise visual hierarchy, realistic matte materials, subtle cinematic lighting,
> no spectacle. No people, no faces, no hands, no body parts, no robots, no animals, no screens, no user interfaces, no
> clouds, no surveillance imagery, no locks, no weapons, no books, no mugs, no loose paper, no decorative clutter, no
> brands, no logos, no watermarks, and absolutely no words, letters, numbers, symbols, captions, labels, titles, slogans,
> or embedded text.

- Requested size: `1344x768`
- Requested steps: `30`
- Requested seed: `23092027`
- Requested response format: `b64_json`
- Durable request: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header-request-02.json`
- Durable health snapshot: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header/health-02.json`
- Durable bounded response: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header/response-02.json`

The retry's service journal recorded:

```text
input  decision=allow reason_code=policy_allow latency_ms=5659.13
output decision=deny  reason_code=semantic_policy_denied latency_ms=6672.11
POST /v1/images/generations -> HTTP 400 Bad Request
```

The bounded API response was:

```json
{"detail":"I can only create age-appropriate images for this learning environment."}
```

The retry therefore also passed semantic input review, ran local inference, and failed semantic output review. No PNG,
hash, dimensions, or pixel-level visual QA exists for attempt 2. Per the authorization, no further retry was made.

## Interim disposition after attempt 2

- Released candidate count: **0**
- Header asset reference: **none**
- Final verdict: **blocked — mandatory locally generated header unavailable**

No stock image, cloud generator, alternate local model, weakened policy, bypassed gate, or placeholder was substituted.

## Attempt 3 — evaluator recovery generation

Admin reported that the stale `gemma3:4b` evaluator state had been unloaded and reloaded, and authorized exactly one
recovery generation through the unchanged route. The same simple abstract concept was used; only the seed changed.

> A simple abstract editorial still life about local ownership of image generation. One compact matte-black compute box
> rests within a warm geometric pool of light. Three restrained colored paths extend from the box toward one clean
> floating abstract image plane made only of soft color fields and geometric shapes. Generous negative space, wide
> horizontal header composition, calm precise visual hierarchy, realistic matte materials, subtle cinematic lighting,
> no spectacle. No people, no faces, no hands, no body parts, no robots, no animals, no screens, no user interfaces, no
> clouds, no surveillance imagery, no locks, no weapons, no books, no mugs, no loose paper, no decorative clutter, no
> brands, no logos, no watermarks, and absolutely no words, letters, numbers, symbols, captions, labels, titles, slogans,
> or embedded text.

- Requested size: `1344x768`
- Requested steps: `30`
- Requested seed: `23092028`
- Requested response format: `b64_json`
- Model: `Qwen/Qwen-Image`
- Generation time: `92.9784761259798` seconds
- Durable request: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header-request-03.json`
- Durable health snapshot: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header/health-03.json`
- Durable bounded response metadata:
  `.agent-runtime/writing/image-generation/2026-09-23-local-images-header/response-metadata-03.json`
- Released intermediate PNG: not retained after the accepted crop
- PNG SHA-256: `ed515ec14f10db45247b2d09446d06489da9280fa0ca5f7489b95b6dc447fb79`
- Dimensions: `1344x768`, RGB, 8-bit/color, non-interlaced

The recovery attempt's journal records:

```text
input  decision=allow reason_code=policy_allow latency_ms=3587.26
output decision=allow reason_code=policy_allow latency_ms=4792.0
POST /v1/images/generations -> HTTP 200 OK
```

### Literal visual QA

Visible content: a compact matte-black compute box sits in a peach-colored geometric pool of light. Five distinct
parallel colored bands—magenta, salmon/orange, dark blue, pale blue/white, and yellow—run from it to a floating plane
containing an abstract pastel composition. The image has a clear left-to-right
relationship and generous darker space above the main subject.

Strengths:

- The compute box is the dominant focal object.
- The five restrained bands communicate a controlled transformation from local machine to visual output.
- No people, robots, stock-office clutter, recognizable brand, cloud symbol, or sensitive motif is visible.
- The wide composition is suitable for a header crop in principle.

Defects:

- The upper-left edge contains the readable phrase `Local ownership of image generation`, despite the explicit no-text
  instruction.
- The upper-right edge contains malformed, unreadable generated text.
- Small interface-like details appear on the front of the compute box even though screens and interfaces were excluded.

Verdict: **reject**. The semantic gates allowed release, but the candidate fails the canonical image-text criteria. The
original asset's hash and QA record are preserved as test evidence; the rejected PNG itself is not retained.

No further generation was attempted.

## Deterministic editorial crop

- Operation: remove the complete text-bearing top strip; no generative alteration
- Tool operation: `crop=1344:688:0:80`
- Crop geometry: `x=0`, `y=80`, `width=1344`, `height=688`
- Original generated PNG: not retained after producing and verifying the accepted crop
- Original SHA-256: `ed515ec14f10db45247b2d09446d06489da9280fa0ca5f7489b95b6dc447fb79`
- Original dimensions: `1344x768`
- Cropped final PNG:
  `notes/articles/assets/2026-09-23-local-images-header-final.png`
- Final SHA-256: `d84a93acd788b4b0fd389bb1324a7f474d058d291f524d48216101b77a36a04f`
- Final dimensions: `1344x688`, RGB, 8-bit/color, non-interlaced

### Cropped-derivative visual QA

The cropped image was inspected at original detail. The complete upper title, malformed upper-right text, and horizontal
line are absent. No words, partial characters, malformed glyphs, logos, captions, labels, or watermarks remain along the
top, bottom, left, or right edge, or within the image plane.

The matte-black compute box remains the dominant focal point. Five distinct colored bands still connect it clearly to
the abstract image plane. The warm geometric light field provides contrast, the wide frame retains useful negative space,
and the top of the abstract plane remains legible despite the intentional crop. The small controls on the compute box
read as ordinary hardware detail and do not imply a misleading interface or add editorial text.

Verdict: **accept**. The cropped derivative satisfies the no-text requirement and remains compositionally suitable as
the unpublished article's header.

## Final disposition

- Released candidate count: **1**
- Semantically allowed candidate count: **1**
- Original generated candidate verdict: **reject**
- Cropped final derivative verdict: **accept**
- Publishable header available: **yes, pending independent review and human acceptance**
- Further generation after crop acceptance: **one separately authorized routing-test candidate, rejected below**

## Attempt 4 — fresh drafting-stage routing test

Admin authorized exactly one fresh candidate through the unchanged protected route. The previously accepted cropped
header remained untouched during generation and evaluation.

> Minimal abstract editorial still life on a continuous neutral background. One matte-black compute cube is the sole
> solid object. Exactly three narrow colored light paths emerge from the cube and enter a frameless field of abstract
> color that blends directly into the background. Wide horizontal header composition, balanced asymmetry, one clear
> focal story, subtle warm light, refined realistic materials, generous natural negative space distributed around the
> objects. No people, no body parts, no rooms, no walls, no desks, no signs, no panels, no frames, no screens, no
> interfaces, no devices other than the plain compute cube, no title area, no banner, no line near an edge, no clouds,
> no robots, no animals, no logos, no watermarks, and absolutely no typography, words, letters, numbers, icons, symbols,
> labels, captions, or glyph-like marks anywhere.

- Requested size: `1344x768`
- Requested steps: `30`
- Requested seed: `23092029`
- Requested response format: `b64_json`
- Model: `Qwen/Qwen-Image`
- Generation time: `93.67104418401141` seconds
- Durable request: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header-request-04.json`
- Durable health snapshot: `.agent-runtime/writing/image-generation/2026-09-23-local-images-header/health-04.json`
- Durable response metadata:
  `.agent-runtime/writing/image-generation/2026-09-23-local-images-header/response-metadata-04.json`
- Rejected candidate PNG: not retained; hash and QA findings preserved below
- Candidate SHA-256: `46a586b07b00c631eb4141338d8b4f6b24044b44d04ff91892ca3e215f46d30c`
- Dimensions: `1344x768`, RGB, 8-bit/color, non-interlaced

The attempt's journal records:

```text
input  decision=allow reason_code=policy_allow latency_ms=4496.49
output decision=allow reason_code=policy_allow latency_ms=5972.31
POST /v1/images/generations -> HTTP 200 OK
```

### Literal visual QA and comparison

Visible content: a matte-black cube is centered against a beige field. Several colored light beams radiate across the
lower half. Three long pale horizontal rules and prominent generated text occupy the upper strip.

Defects:

- The top strip contains multiple malformed pseudo-words despite the explicit prohibition on typography and title
  areas.
- One malformed line includes the readable phrase `Sexual Sexual Story`, which is unrelated to the article and
  contradicts the intended child-safe, non-sensitive concept.
- The image shows more than the requested three light paths and never resolves them into a distinct abstract image
  field, weakening the intended transformation story.
- The cube is visually clean, but the centered composition and large title-like band are less editorially useful than
  the currently accepted crop.

Verdict: **reject**. Although both semantic gates allowed release, the candidate fails prompt adherence, image-text
quality, factual relevance, and comparative quality. It does not replace
`notes/articles/assets/2026-09-23-local-images-header-final.png`. No further generation was attempted.
