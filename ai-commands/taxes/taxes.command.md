# taxes.command

## Tags

#command #ai-command #taxes #accounting #reports #show-context

## Purpose

Use `taxes` for accounting tax summaries such as "how much taxes did I pay this year so far". The command knows the
expected report structure, but report locations come from config, environment, or command-line flags.

`taxes.md` is a generated or curated summary, not the raw source of truth. When a year has no usable `taxes.md`, this
command falls back to `statements tax-candidates` to inspect statement PDFs and produce source-backed candidate rows.

The command must not hardcode personal absolute paths. Use tracked defaults such as
`~/data/SynologyDrive/documents/incorparated`, and put machine-specific roots in local `taxes.command.config` or pass
`--reports-root`.

## Config

Loaded in this order:

- `taxes.command-default.config` tracked defaults
- `taxes.command.config` local overrides, gitignored
- command-line flags

Default root convention:

```bash
INCORPORATED_ROOT="${HOME}/data/SynologyDrive/documents/incorparated"
REPORTS_ROOT="${INCORPORATED_ROOT}/reports"
```

## Intent Mapping

Requests like these map to `taxes` inside the accounting workflow:

- `how much taxes did I pay this year so far`
- `show me taxes paid this year`
- `taxes paid so far`
- `what tax payments are scheduled`
- `summarize 2026 taxes`

When the user says `show me ...`, use `--show` so the generated summary opens through `show-context` in the browser.

## Structure Contract

The command expects the accounting workflow's working report structure:

- `<reports-root>/<year>/<business-name>/<quarter>/in`
- `<reports-root>/<year>/<business-name>/<quarter>/out`
- `<reports-root>/<year>/<business-name>/<quarter>/statements`
- `<reports-root>/<year>/<business-name>/<quarter>/out/taxes` or `<reports-root>/<year>/<business-name>/<quarter>/taxes`
- annual catch-all folders such as `<reports-root>/<year>/statements` are allowed only while the year is being cleaned

Resolve `<business-name>` from the selected accounting project metadata (`business_name`) whenever possible. If no
accounting project is selected and the user did not name a business, ask before summarizing business-specific taxes.

It searches for tax notes named `taxes.md` under year tax folders and statement folders. If none exist, it scans
statement PDFs through `rules/commands/statements/statements.command.sh`. When `taxes.md` exists, it reports both:

- totals exactly as recorded in the note
- strict year-dated totals, excluding entries dated outside the requested year

Scheduled future payments are reported separately from paid totals.

## Reporting Rules

Accounting tables should include totals when amounts are shown. For tax reports this is mandatory for:

- `Paid So Far`: include TAX, PAYROLL / source deductions, and Total columns.
- `Scheduled / Still To Pay`: include a `TOTAL` row.
- Statement-derived candidate reports: include a candidate totals table and clearly count rows missing amount extraction.

## Usage

```bash
./rules/commands/taxes/taxes.command.sh summary --year 2026
./rules/commands/taxes/taxes.command.sh summary --year 2026 --show
./rules/commands/taxes/taxes.command.sh summary --year 2026 --reports-root /path/to/reports --no-open
```

## Outputs

- Markdown summary printed to stdout.
- Markdown artifact written under `.ai/tmp/taxes/` by default.
- With `--show`, opens the artifact with `rules/commands/show-context/show-context.command.sh`.
