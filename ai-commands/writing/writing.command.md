# writing.command

## Tags

#command #ai-command #writing #blog-post #story #narrative #content

Create or revise written content based on requested writing type and strategy.

## Intent

Use when the user asks to write, rewrite, or structure content such as:

- blog post
- story (fiction)
- story (documentary / real-life)
- reflective narrative
- short article or post

## Type Detection

Detect and confirm the requested writing type before drafting:

- `blog-post`
- `story-fiction`
- `story-documentary`
- `essay-reflection`

If unspecified, infer from user goal and audience, then state the inferred type.

## Approach Selection

Pick one approach that best fits the type and intent:

1. `storyworthy` (personal/documentary stories)

- Focus: one meaningful change moment.
- Use when user wants a real-life story with emotional clarity.

2. `hero-journey` (fiction or epic narrative arc)

- Focus: transformation through challenge.
- Use when user wants a structured narrative arc.

3. `situation-first` (King-style discovery draft)

- Focus: situation + character reaction + natural outcome.
- Use when user wants exploratory drafting and iteration.

## Output Contract

- Provide a structured draft aligned with type + approach.
- Keep output concise unless long-form is explicitly requested.
- When requested, include a short revision pass for tone, clarity, and flow.

## Model Routing (Writing Quality)

Model choice must follow writing intent, quality target, and speed/cost constraints.

### 1) Pick provider family

- Use project/default provider when specified by runtime config.
- If no provider constraint is present, pick from the "Recommended now" list below.

### 2) Pick tier by task

- `premium-quality`:
  - long-form blog posts, literary fiction, nuanced documentary narrative
  - prioritize coherence, voice consistency, and structural depth
- `balanced`:
  - most standard blog posts, short stories, reflective essays
  - good quality with better speed/cost
- `fast-draft`:
  - ideation, outlines, rewrite passes, headline variants
  - speed first, then optional upscale pass on `premium-quality`

### 3) Recommended now (validated on 2026-03-13, subject to change)

- Premium-quality:
  - OpenAI: `gpt-5.2` (or `gpt-5.2-pro` for hardest tasks), `gpt-4.1`
  - Anthropic: `claude-opus-4-1-20250805`, `claude-sonnet-4-20250514`
  - Google: `gemini-2.5-pro`
- Balanced:
  - OpenAI: `gpt-4o`, `gpt-5-mini`
  - Anthropic: `claude-sonnet-4-20250514`
  - Google: `gemini-2.5-flash`
- Fast-draft:
  - OpenAI: `gpt-4o-mini`
  - Anthropic: `claude-3-5-haiku-20241022`
  - Google: `gemini-2.5-flash-lite`

### 4) Not recommended as primary final-writing model

- Deprecated/retiring families or snapshots (provider docs indicate replacement/shutdown windows).
- Legacy small/latency-first models for final prose quality (acceptable only for outline/draft pass).
- Any model that is not in the provider's current "latest/recommended" list.
- OpenAI `gpt-3.5-turbo` for new writing tasks (OpenAI guidance recommends `gpt-4o-mini` instead).

### 5) Review cadence

- Revalidate this section at least monthly or when provider release notes change.
- Treat this table as guidance, not a hard guarantee.

### Provider references (for revalidation)

- OpenAI models index: `https://platform.openai.com/docs/models`
- OpenAI latest-model guide (GPT-5.2): `https://platform.openai.com/docs/guides/latest-model`
- Anthropic model overview: `https://docs.anthropic.com/en/docs/about-claude/models/overview`
- Gemini models/deprecations: `https://ai.google.dev/gemini-api/docs/models/gemini-v2` and
`https://ai.google.dev/gemini-api/docs/deprecations`

## Linked Commands

- Optional narration/audio generation:
  - `rules/commands/tts/tts.command.md`
- Optional display in central dialog:
  - `rules/commands/show/show.command.md`
- Session/progress tracking:
  - `rules/commands/session/session.command.md`
  - `rules/commands/plan/plan.command.md`

## Usage (workflow mapping)

This is a documentation command contract used by `writing-workflow.md` for intent mapping and execution behavior.
