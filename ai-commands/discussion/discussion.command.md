# discussion.command

## Tags

#command #discussion #conversation-history #zoom #indexing #lookup #context-lookup #current-meeting #live-meeting #backlog #summary

## Roles

- `planner`
- `devops`

Use when you need to store raw discussion artifacts (meeting captions, notes, screenshots), then convert them into usable delivery inputs.

## Intent Mapping

- Requests like `discussion`, `store meeting notes`, `save zoom captions`, `save screenshots`, `prep Zoom
conversation`, `prepare conversation history`, `index Zoom transcript`, `lookup conversation`, `find the conversation
about ...`, `find where we talked about ...`, `search prepared discussion context`, `current meeting`, `summarize
current meeting`, `show current meeting summary`, `summarize discussion`, `make backlog from discussion` map here.
- Use it to turn discussion material into implementation, support, or planning inputs for the active workflow.
- For `summarize discussion`, summary generation means compiling captured raw team-chat text (`*.txt`) from the
discussion day folder into a structured summary.

## Storage Contract

- Workflow-scoped storage root:
  - `session-root/<work-profile>/discussions/<DD_MM_YYYY>/`
- Screenshots:
  - `session-root/<work-profile>/discussions/<DD_MM_YYYY>/screens/`
- Raw text:
  - `session-root/<work-profile>/discussions/<DD_MM_YYYY>/*.txt`

## What You Can Do

- Initialize discussion day folders.
- Add raw text from a file or inline text.
- Add screenshot/image files into `screens/`.
- List captured artifacts.
- Generate a discussion summary markdown (`*-summary.md`) with tags/metadata.
- Track a live/current meeting pointer for same-day follow-up, current summary, and browser handoff while the meeting is still in progress.
- Prepare finished conversation history, such as Zoom transcripts/chat exports, into tagged `*-feature.md` context plus
a ready indexed folder when applicable.
- Build a visible local SQLite/token index under `~/Documents/Zoom/indexed/_index/` as the second lookup layer over prepared conversations.
- Lookup prepared conversation history deterministically by query and rank the best matching summaries/feature indexes.
- Generate a backlog draft from discussion artifacts and summary.

## Usage

- `./commands/discussion/discussion.command.sh init [--date DD_MM_YYYY]`
- `./commands/discussion/discussion.command.sh add-text [--date DD_MM_YYYY] [--name file.txt] (--file <path> | --text "<raw text>")`
- `./commands/discussion/discussion.command.sh add-screen [--date DD_MM_YYYY] [--name file.png] --file <path>`
- `./commands/discussion/discussion.command.sh list [--date DD_MM_YYYY]`
- `./commands/discussion/discussion.command.sh summarize [--date DD_MM_YYYY] [--summary-name <name>] [--out <path>]`
- `./commands/discussion/discussion.command.sh current-conversation [--set|--show|--summary|--clear] [--date
DD_MM_YYYY] [--name <text>] [--file <path>|--source-dir <path>] [--no-open]`
- `./commands/discussion/discussion.command.sh prep-conversation [--date DD_MM_YYYY] (--feature <name>|--recent)
[--source-dir <path>] [--ready-root <path>] [--pattern <glob>] [--limit <n>] [--chronological|--order
newest|chronological] [--tag <tag> ...]`
- `./commands/discussion/discussion.command.sh index-conversations [--root <path> ...] [--index-path <path>] [--json]`
- `./commands/discussion/discussion.command.sh lookup-conversation (--query <text>|<text>) [--root <path> ...] [--limit
<n>] [--show] [--json] [--reindex] [--no-index] [--index-path <path>] [--no-open]`
- `./commands/discussion/discussion.command.sh backlog-draft [--date DD_MM_YYYY] [--title <text>] [--project <label>]
[--scope <text>] [--out <path>]`

## Conversation Prep Contract

Use `prep-conversation` after a Zoom/chat/history conversation is done and should become searchable context. For Zoom,
prep moves the whole conversation folder under `~/Documents/Zoom/indexed/<feature-slug>/`, so raw Zoom root means not
indexed and `indexed/` means done.

Conventions:

- Default source folder is `~/Documents/Zoom`.
- A folder under `~/Documents/Zoom/indexed/` means the conversation has already been prepared and is ready for lookup;
legacy `*-feature/` folders are still readable for compatibility.
- Prepared session output is written under `session-root/<work-profile>/discussions/<DD_MM_YYYY>/`.
- When the source is inside `~/Documents/Zoom`, the command moves the conversation folder to
`~/Documents/Zoom/indexed/<slug>/` and adds `summary.md` plus a `*-feature.md` index.
- Use `--ready-root <path>` to explicitly choose another indexed/ready parent folder.
- Use `--limit 10 --chronological` for requests like “prep the last 10 chronologically”: the command selects the latest
10 matching files, then writes the index oldest-to-newest.
- Each indexed folder gets `summary.md` plus a generated `*-feature.md` with `## Tags`, `## Show Context`, raw source
references, and searchable excerpts.
- After prep, the command refreshes the visible local lookup index quietly so new prepared conversations are available
to `lookup-conversation`.

Example:

```bash
./commands/discussion/discussion.command.sh prep-conversation \
  --feature "tagged app config cache" \
  --source-dir "$HOME/Documents/Zoom/2026-05-14 12.17.55 Refinement session" \
  --pattern "meeting_saved_closed_caption.txt" \
  --tag config-service \
  --tag tags

./commands/discussion/discussion.command.sh prep-conversation \
  --recent \
  --source-dir "$HOME/Documents/Zoom" \
  --pattern "meeting_saved_closed_caption.txt" \
  --limit 10 \
  --chronological \
  --tag recent
```

`show-context --feature "tagged app config cache"` can then find the prepared context through the active session
discussions and ready Zoom indexed folders.

## Local Conversation Index Contract

The lookup model has two layers:

1. Prepared conversation folders: `~/Documents/Zoom/indexed/<topic>/summary.md` plus `*-feature.md` and original source files.
2. Visible local search index: `~/Documents/Zoom/indexed/_index/`, used by default when present.

The visible local search index is:

```text
~/Documents/Zoom/indexed/_index/
  conversation-index.sqlite
  index-manifest.json
  index-manifest.md
```

Use `index-conversations` to rebuild this layer explicitly. The default roots are:

1. `~/Documents/Zoom/indexed/`
2. `session-root/<work-profile>/discussions/`
3. any extra `--root <path>` values

The SQLite database contains prepared conversation documents plus a token table that narrows lookup candidates before
deterministic scoring. The manifest files are intentionally human-readable so you can inspect when the index was
refreshed, which roots were included, how many files were indexed, and which DB file lookup is using.

Why SQLite instead of a local OpenSearch server:

- The problem is local prepared-history lookup, not multi-user search infrastructure.
- SQLite gives us one visible, portable index file with no daemon, network port, JVM, Docker service, or background lifecycle to manage.
- The `docs_terms` table is an inverted index: lookup narrows candidate files by query tokens before running the same
deterministic scorer used by scan mode.
- The command still prints transparent metadata (`candidate_mode`, rows scored, DB path, manifest path) so we can
reason about whether the index helped.
- If conversation history grows beyond this shape, the command can swap the implementation behind `index-conversations`
without changing the prep/show-context workflow.

Usefulness gate:

- We benchmarked the index before keeping it. Broad query `tag feature` was about 2x faster than scan because tag language is common.
- Specific multi-term queries were materially better: `tag config deployment`, `oem config id`, and `autoscaling
latency` were about 5x-18x faster and scored far fewer rows while preserving the same top result in tested cases.
- This is worth keeping because it saves repeated agent file scanning and reduces noisy result review for the human.
- If indexed lookup returns worse top results than `--no-index`, treat that as a scoring/index bug and compare both
modes before trusting the result.

Behavior:

- `prep-conversation` refreshes this index after moving/preparing conversations.
- `lookup-conversation` uses the local SQLite/token index by default when it is present.
- If the index is stale, lookup rebuilds it automatically before searching.
- If the index is missing or unusable, lookup falls back to the old slow direct scan and prints the fallback reason
instead of blocking the user.
- `lookup-conversation --reindex` forces a rebuild before searching, even if the freshness check says the index is current.
- `lookup-conversation --no-index` bypasses SQLite and scans prepared files directly, which is useful for comparing behavior.
- Current/live meetings are not included until the meeting is finished and `prep-conversation` runs.
- The freshness check compares the newest prepared source file under the indexed roots to the visible index DB/manifest
mtimes. If a newly prepared meeting is newer, lookup refreshes the common index before answering.

Examples:

```bash
./commands/discussion/discussion.command.sh index-conversations
./commands/discussion/discussion.command.sh lookup-conversation --query "tag feature" --limit 5
./commands/discussion/discussion.command.sh lookup-conversation --query "tag feature" --reindex
./commands/discussion/discussion.command.sh lookup-conversation --query "tag feature" --no-index
```

## Current Conversation Contract

Use `current-conversation` while a meeting is happening or while the agent is helping someone follow along in the
same-day discussion. A current conversation is live/raw context; it is not indexed yet and should not be treated as
prepared history until `prep-conversation` runs after the meeting is done.

State:

- Current pointer: `session-root/<work-profile>/discussions/current-conversation.json`.
- Current day artifacts: `session-root/<work-profile>/discussions/<DD_MM_YYYY>/`.
- Current summary: `<slug>-current-summary.md` in the current day folder.
- Incremental cursor: `<slug>-current-summary.md.state.json`, storing byte offsets per text source and seen image paths.

Behavior:

- `add-text` and `add-screen` refresh the current conversation pointer automatically for same-day follow-up.
- `current-conversation --set --name <name> --file <path>` points the workflow at a live transcript/notes file.
- `current-conversation --set --name <name> --source-dir <path>` points the workflow at a live meeting folder that may
contain transcript text and screenshots.
- `current-conversation --summary --show` creates or updates a live meeting summary, then renders it through `show-context`.
- The first summary pass builds the full live template. Later summary passes use the saved byte offsets and append a
`Meeting Update` section from only the new transcript/notes content since the previous pass.
- Screenshots/images found in the current day folder or source folder are included in `Visual Context / Screenshots`;
later passes list only newly seen images.
- `current-conversation --clear` clears the live pointer without deleting captured artifacts.

Current meeting summary template:

- `Where We Are`
- `What Was Discussed`
- `Decisions`
- `Not Decided / Open Questions`
- `Follow-ups / Actions`
- `Visual Context / Screenshots`
- `Design Diagram` when design/flow/API/cache/integration language appears
- `Raw Sources`
- `Current Meeting Handoff`

Examples:

```bash
./commands/discussion/discussion.command.sh current-conversation \
  --set \
  --name "tag rollout discussion" \
  --source-dir "$HOME/Documents/Zoom/current-meeting"

./commands/discussion/discussion.command.sh current-conversation --summary --show
./commands/discussion/discussion.command.sh current-conversation --clear
```

When the meeting is finished, run `prep-conversation` to move/index the final conversation under `~/Documents/Zoom/indexed/`.

## Conversation Lookup Contract

Use `lookup-conversation` when the user asks to find a remembered conversation or prepared discussion context. This is
the lookup side of the same command that performs indexing, so lookup and prep conventions stay together.

Deterministic lookup order:

1. Use the visible local index at `~/Documents/Zoom/indexed/_index/conversation-index.sqlite` when it exists, or build it if missing.
2. Prepared Zoom conversations under `~/Documents/Zoom/indexed/`.
3. Active-session prepared discussion indexes under `session-root/<work-profile>/discussions/`.
4. Any explicit `--root <path>` values.

Ranking rules:

- Exact phrase hits rank above isolated word hits.
- `summary.md` is the canonical result for a prepared conversation when present.
- Raw transcript hits are kept as evidence, but the command returns the conversation summary as the top openable artifact.
- Hits in `summary.md`, `*-feature.md`, titles, paths, and `## Important Parts` rank higher.
- Generic `## Tags` heading matches are ignored so tag metadata does not drown out real content.
- Ties sort by score descending, then path ascending.

Examples:

```bash
./commands/discussion/discussion.command.sh lookup-conversation --query "tag feature" --limit 5
./commands/discussion/discussion.command.sh lookup-conversation "tag feature" --show
./commands/discussion/discussion.command.sh lookup-conversation --query "cache eviction tags" --json
./commands/discussion/discussion.command.sh lookup-conversation --query "tag feature" --no-index
```

Use `--show` when the lookup should immediately render the top result through `show-context`. Without `--show`, report
the ranked matches and ask or infer which one to open next.

## TODO

- Consider moving the local index update/freshness/lookup layer into a more generic command later, because the same
two-layer pattern can apply beyond conversations: prep source artifacts first, then maintain a visible local search
index with freshness metadata.

## Notes

- Keep discussion artifacts as raw source-of-truth first.
- Continue normal workflow delivery in parallel; discussion processing should not block implementation.
- Knowledge extraction/advanced processing can be layered later.
- Summary output contract: always under `session-root/<work-profile>/discussions/<DD_MM_YYYY>/` and named `*-summary.md`.
- Naming rule: if `meeting_saved_closed_caption.txt` exists for the discussion day and no explicit summary name is
provided, summary file must be `meeting_saved_closed_caption-summary.md`.
- Execution rule: when user asks to summarize discussion, run summary generation directly using this naming convention;
do not ask follow-up naming questions unless required inputs are truly missing.
- Source rule: if `meeting_saved_closed_caption.txt` exists, use it as the canonical raw source for summary generation;
otherwise use available day `*.txt` files.
- Privacy/path rule: generated markdown files must not include absolute local filesystem paths (for example
`/home/...`); use repo-relative paths instead.

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Created discussion folders/files under `session-root/<work-profile>/discussions/`
- Optional summary markdown and backlog draft markdown
