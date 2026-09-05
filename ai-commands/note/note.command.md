# note.command

## Tags

#command #ai-command #note #obsidian #smart-notes #tags #knowledge-management

Create, update, and link notes in an Obsidian-compatible vault using Smart Notes structure and retrieval-first tagging.

## Intent

Use when the user asks to:

- create a note
- update/edit a note
- link notes together
- retag/reclassify notes
- move notes between fleeting/reference/knowledge
- compile the sources

## Vault + Scope

- Obsidian vault notion:
  - a vault is a folder opened by Obsidian as a workspace root
  - `.obsidian/` is optional metadata and is created by Obsidian after opening/configuring the vault
  - absence of `.obsidian/` does not block note creation; notes remain valid Markdown
- Vault config source: `rules/commands/note/note.config`
  - `obsidian_vault` selects the default Obsidian vault for note operations
  - `vault_paths` lists allowed/known vault candidates
  - `smart_notes_root` points to Smart Notes subtree inside the selected vault
- Default vault root (current): `/home/sergii/SynologyDrive/documents`
- Preferred vault name (current): `documents`
- Smart Notes root (current): `docs`
- Config template: `rules/commands/note/note.example.config`
- Categories:
  - `<smart_notes_root>/fleeting-notes/`
  - `<smart_notes_root>/reference-notes/`
  - `<smart_notes_root>/knowledge/`

## Companion Source Files Pattern (Mandatory for Document Sets)

For document-archive folders (property docs, tax docs, legal packs, etc.), use this structure:

- markdown metadata notes in folder root
- source files in typed underscore-prefixed subfolders (not only `_pdf/`), for example:
  - `_pdf/`
  - `_images/` (all image types such as `.jpg`, `.jpeg`, `.png`, `.svg`, `.webp`)
  - `_source/` (generic fallback)
- underscore prefix is mandatory for source containers so they are clearly distinguishable from normal domain/group folders
- one `_summary.md` in the folder root linking all metadata notes

Companion naming rule:

- metadata note filename base must match source file base
- example:
  - note: `municipal-tax-bill-2024.md`
  - source: `_pdf/municipal-tax-bill-2024.pdf`
- for nested source subfolders, mirror relative path into metadata tree:
  - source path: `/_pdf/bank/<name>.pdf`
  - metadata path: `/bank/<name>.md`
  - source path: `/_images/insurance/roof/<name>.jpg`
  - metadata path: `/insurance/roof/<name>.md`

Linking rule:

- each metadata `.md` must include a direct link to its source file
- preferred frontmatter key: `source_file: "<folder>/<file.ext>"`
- include a visible in-body link line near the top:
  - `**Source:** [_pdf/municipal-tax-bill-2024.pdf](_pdf/municipal-tax-bill-2024.pdf)`

Summary format rule:

- `_summary.md` must include a short digest section before the links list
  - purpose: combine key points from all companion notes into a quick preamble
  - style: short bullets, high-signal facts only, no long narrative
  - include concrete key numbers when available (for example: prices, totals, dates, dimensions, location identifiers,
zoning limits, important IDs)
  - avoid generic-only bullets; each digest should contain actionable factual anchors
- `_summary.md` entries must be `description -> link` (description first, then link)
- prefer meaningful human description over raw filename
- `_summary.md` must include frontmatter tags and follow the same retrieval-lane logic as regular notes
- required baseline summary tags:
  - `summary`
  - `index`
  - domain lane tags relevant to folder scope (for example `chalet`, `doc`, `property`)
- `_summary.md` must include `## FAQ - frequently asked questions and requests`
  - every time user asks about documents in that folder, append/update one Q/A item
  - format:
    - `- Q: <user ask>`
    - `  A: <short reusable answer>`
  - deduplicate by intent (not exact wording):
    - if same question intent already exists, update existing answer instead of adding duplicate
  - keep answers concise, actionable, and general enough for future users/AI
- example:
  - `- Municipal tax bill for 2024 -> [municipal-tax-bill-2024](municipal-tax-bill-2024.md)`

Filename hygiene rule:

- filenames must be short and descriptive of actual content
- avoid random IDs, tracking numbers, and machine suffixes in final filenames
- avoid repeated address/title fragments already captured by folder context or tags
- keep companion base names identical between metadata note and source file
- default naming preference: semantic-only filenames (no date/ID suffix) when name is unique in that folder
- add date/ID suffix only when required to disambiguate two or more files with otherwise same semantic name

## Note Types

- `fleeting`: quick capture, temporary, usually promoted or discarded later
- `reference`: source-based facts, excerpts, receipts, statements
- `knowledge`: permanent evergreen note in your own words

## Tag Rules (Mandatory)

Design tags by retrieval pattern (PK/SK style), using 2-3 prediction lanes:

- Primary (`PK-like`): the entity/topic searched first
- Secondary (`SK-like`): the attribute/action searched second
- Tertiary (optional): context axis such as year, status, or location
- Year tag format is mandatory when year is used: `year_YYYY` (example: `year_2024`)
- Include a simple human-first lane when useful (example: `#chalet`, then `#doc`, then `#property`)
- Add complementary lanes for likely search paths (for example by year: `#year_2024`)
- Prefer short hierarchical tags: `#bank/cibc`, `#contact/phone`, `#bank/cibc/phone`
- Keep type tags separate from domain tags:
  - type: `#fleeting`, `#reference`, `#knowledge`
  - domain: `#finance/taxes`, `#assets/property`, `#doctor/family-physician`
- Prefer 1-3 high-signal domain tags per note plus one type tag

Example lane set for chalet property docs:

- lane A: `#chalet`, `#doc`, `#property`
- lane B: `#chalet/doc/property`, `#property/125_rue_de_chamonix`
- lane C: `#year_2024`, `#tax` (or other query-intent topic)

## Tag Quality Examples

Not useful (weak retrieval value):

- generic-only tags with no access intent:
  - `#document`, `#file`, `#important`
- tags that describe format, not query need:
  - `#pdf`, `#text`
- random broad taxonomy with no user search path:
  - `#real-estate`, `#finance` (alone, without lane context)

Useful (access-pattern aligned):

- user-first lane:
  - `#chalet` -> `#doc` -> `#property`
- entity + attribute lane:
  - `#property/125_rue_de_chamonix` + `#tax`
- time/context lane:
  - `#year_2024` + `#municipal_tax`
- practical search composition:
  - `#chalet` + `#doc` + `#year_2024`
  - `#property/125_rue_de_chamonix` + `#septic_conformity`

## Ambiguity Rule

If tag lanes are unclear, ask the user before finalizing tags:

- what are the top use cases for retrieving this note later?
- what is the first thing they expect to type/search (entity)?
- what is the second filter (document type, topic, year, status)?

Do not invent final tags when access/use cases are unknown; request clarification and then apply user-provided retrieval logic.

## Behavior

1. Detect requested action:

- `create`
- `update`
- `link`
- `retag`
- `move-type`
- `compile-sources`

2. Resolve target note type:

- infer from request, or ask when ambiguous

3. Apply Obsidian-safe formatting:

- `.md` file
- YAML frontmatter for metadata
- hashtags as `#tag/path`
- internal links as `[[Note Title]]`

4. Preserve Smart Notes consistency:

- do not mix raw fleeting capture with evergreen synthesis in one note
- when promoting, keep backlink between original and promoted note

## Compile Sources Action (Mandatory Contract)

If user says `compile the sources` (or equivalent), perform this flow for the target folder:

1. Inventory source files:

- scan configured source folders (`_pdf`, `_images`, `_source`)
- identify each source file that needs a metadata note

2. Parse source content (mandatory):

- for text-based sources (especially PDFs), read inside the file and extract factual metadata
- do not leave metadata notes as filename-only placeholders when source text is available
- extract high-value fields when present:
  - parties, dates, amounts, rates, terms, identifiers, addresses, legal references

Image/OCR policy:

- for document images (receipts, forms, scans, screenshots of statements/registrations), run OCR by default during
compile to extract searchable facts
- ask for confirmation only when the request implies expensive/non-document analysis (for example face/person
recognition or very large image batches where cost/time may be high)
- for normal text PDFs, proceed without extra confirmation
- image files should live under `_images` regardless of extension; keep original extension on each file

3. Normalize file naming:

- rename source files to short, purposeful, descriptive names
- remove random IDs / machine suffixes / repetitive address fragments
- keep names stable and human-searchable
- prefer semantic-only filename first (for example `insurance-policy-declaration`)
- include date/ID only if semantic-only name would collide with another file

4. Create or align metadata notes:

- ensure each source file has a companion metadata note in root
- companion rule:
  - same base name, different extension only
  - example: `municipal-tax-bill-2024.md` <-> `_pdf/municipal-tax-bill-2024.pdf`
  - for nested source folders, preserve relative subpath under metadata side
    - `/_pdf/bank/a.pdf` -> `/bank/a.md`
    - `/_source/contracts/b.pdf` -> `/contracts/b.md`
- ensure each metadata note includes:
  - `source_file` frontmatter key
  - visible `**Source:** [...]` link near top
  - tags using retrieval-lane rules
  - extracted factual sections populated from source content

5. Build/update index:

- create or update `_summary.md`
- include:
  - tagged frontmatter
  - `## Quick Digest` with high-value concrete facts/numbers when available
  - `## FAQ - frequently asked questions and requests`
  - `description -> link` list for all metadata notes

## Document Query Rule (Mandatory)

When user asks a question about documents in a folder:

1. Query markdown notes first:

- search relevant `.md` files in the document set folder
- answer from existing note facts when available

2. Fallback to source files when markdown is insufficient:

- check companion source files (for example `_pdf/`, `_images/`, `_source/`)
- extract missing factual data needed to answer the user

3. Persist discovered facts:

- if new/clarifying facts come from source files, update the related metadata `.md` note
- also update `_summary.md`:
  - `## Quick Digest` when fact is high-value and broadly useful
  - `## FAQ - frequently asked questions and requests` with the user Q/A

4. Keep FAQ clean:

- deduplicate by intent; update existing entry instead of adding duplicate Q/A lines

## Recommended Frontmatter

```yaml
---
title: '<note title>'
created: '<YYYY-MM-DD>'
type: fleeting|reference|knowledge
tags: []
source_file:
source:
source_url:
---
```

For `fleeting` and `knowledge`, `source` fields may be empty.

## Examples

- Create CIBC phone reference note:
  - type: `reference`
  - tags: `#reference`, `#bank/cibc`, `#contact/phone`

- Link a day log to doctor appointment:
  - tags: `#log/day`, `#doctor/family-physician`, `#event/appointment`
  - links: `[[Doctor - Family Physician]]`

## Linked Commands

- Session lifecycle:
  - `rules/commands/session/session.command.md`
- Plan/progress tracking:
  - `rules/commands/plan/plan.command.md`
- Dialog logging when prompt contains `??`:
  - `rules/commands/dialog/dialog.command.md`

## Usage (workflow mapping)

This command is the primary note-management contract for `docs.workflow.md`.
