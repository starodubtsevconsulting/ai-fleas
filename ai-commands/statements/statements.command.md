# statements.command

## Tags

#command #ai-command #statements #accounting #taxes #rbc #cibc #show-context

## Purpose

Use `statements` to inspect accounting statement PDFs and extract source-backed candidates for tax payments. Statements
are the raw evidence layer; generated or curated `taxes.md` files are summaries derived from statement evidence plus
accountant/payment notes.

The command must not hardcode personal absolute paths. Use tracked defaults such as
`~/data/SynologyDrive/documents/incorparated`, and put machine-specific roots in local `statements.command.config` or
pass `--reports-root`.

## Config

Loaded in this order:

- `statements.command-default.config` tracked defaults
- `statements.command.config` local overrides, gitignored
- command-line flags

Default root convention:

```bash
INCORPORATED_ROOT="${HOME}/data/SynologyDrive/documents/incorparated"
REPORTS_ROOT="${INCORPORATED_ROOT}/reports"
```

## Intent Mapping

Requests like these map to `statements` inside the accounting workflow:

- `scan statements for tax payments`
- `find RBC tax payments`
- `find CIBC tax payments`
- `extract tax candidates from statements`
- `generate tax evidence from PDFs`

If the user says `show me ...`, use `--show` so the generated evidence report opens through `show-context` in the browser.

## Structure Contract

The command searches statement PDFs in these locations for the requested year and business:

- `<reports-root>/<year>/<business-name>/<quarter>/statements/**/*.pdf`
- `<reports-root>/<year>/<business-name>/<quarter>/out/**/statements/**/*.pdf`
- `<reports-root>/<year>/statements/**/*.pdf` only as a temporary annual catch-all while cleanup is in progress
- legacy spelling aliases such as `statemetns` when present

Resolve `<business-name>` from the selected accounting project metadata (`business_name`) whenever possible. If no
accounting project is selected and the user did not name a business, ask before scanning.

Supported statement families start with RBC and CIBC. Extraction is intentionally conservative: it reports candidates
with source file, date context, matched line, nearby amount, surrounding context, and candidate totals. It does not
silently post entries into accounting notes.

Provider-specific helpers can live beside the command using the command meta convention:

- `statements-rbc-statement-adapter.command.sh`
- `statements-cibc-statement-adapter.command.sh`

Keep orchestration in `statements.command.sh`; move provider-specific parsing into adapters only when shared parsing
becomes too broad or inaccurate.

## Usage

```bash
./rules/commands/statements/statements.command.sh tax-candidates --year 2026
./rules/commands/statements/statements.command.sh tax-candidates --year 2026 --show
./rules/commands/statements/statements.command.sh tax-candidates --year 2026 --reports-root /path/to/reports --no-open
```

## Outputs

- Markdown evidence report printed to stdout, including totals for numeric candidates.
- Markdown artifact written under `.ai/tmp/statements/` by default.
- With `--show`, opens the artifact with `rules/commands/show-context/show-context.command.sh`.

## Relationship To Taxes

`taxes.md` is not the raw source of truth. It is a generated or curated summary built from statement evidence, tax
slips, CRA/MRQ/RQ records, and accountant notes. When `taxes` cannot find a `taxes.md` note for a year, it should fall
back to this command to inspect statement PDFs and produce tax candidates.
