# taxes.command

## Purpose

Use `taxes` for accounting tax summaries such as "how much taxes did I pay this year so far". The command knows the
expected report structure, but report locations come from config, environment, or command-line flags.

The command is provider-neutral. Its default provider is `fs`, which reads the folder structure defined below. A future
provider such as `quickbooks` may supply the same tax-summary inputs and evidence without changing the command's intent,
output contract, or reporting rules. Providers other than `fs` must be implemented and explicitly selected before use.

`taxes.md` is a generated or curated summary, not the raw source of truth. When a year has no usable `taxes.md`, this
command falls back to `statements tax-candidates` to inspect statement PDFs and produce source-backed candidate rows.

The command must not hardcode personal absolute paths. Its portable fallback is `~/accounting`; put machine-specific
roots in the selected profile or pass `--reports-root`.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and accounting workflow | Yes | Host activation | Authorizes `taxes` and resolves its profile-owned configuration. |
| Provider | No | `--provider` or `TAXES_PROVIDER`; defaults to `fs` | Selects the accounting data provider. |
| Year | No | `--year`; defaults to current year | Four-digit reporting year to summarize. |
| Business | Conditional | User request or selected accounting project | Required when the request is business-specific; resolves `business_name`. |
| Reports root | Yes | Profile config or `--reports-root` | Root containing the normative year/business/quarter tree shown above. |
| Tax notes | No | Discovered `taxes.md` files | Curated or generated summaries; absence triggers statement-candidate scanning. |
| Statement PDFs | Conditional | Quarter `statements/` folders | Raw evidence used when no usable tax note exists. |
| Presentation choice | No | `--show` and `--no-open` | Controls whether the generated artifact is opened through `show-context`. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Tax summary | Standard output | Paid, strict-year, payroll/source-deduction, scheduled, and total values. |
| Markdown artifact | `TAXES_OUTPUT_DIR` or `.ai/tmp/taxes/<year>-taxes-summary.md` | Persistent evidence-backed summary for the requested year. |
| Statement candidates | Statements command output | Conservative source rows produced when no usable `taxes.md` exists. |
| Browser presentation | `show-context` | Optional rendered view when `--show` is selected. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `taxes/taxes.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `taxes/taxes.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #taxes #accounting #reports #show-context

## Expected Folder Structure

This structure belongs to the default `fs` provider and is shared unchanged with `statements`. The selected profile
supplies `<reports-root>`. Organize each business by year and quarter like this:

```text
<reports-root>/
└── 2026/
    └── example-business/
        ├── q1/
        │   ├── in/                  # incoming invoices and source documents
        │   ├── out/
        │   │   └── taxes/
        │   │       └── taxes.md     # curated/generated quarterly tax summary
        │   └── statements/
        │       ├── bank-a.pdf       # raw statement evidence
        │       └── bank-b.pdf
        ├── q2/
        │   ├── in/
        │   ├── out/taxes/taxes.md
        │   └── statements/*.pdf
        ├── q3/
        │   ├── in/
        │   ├── out/taxes/taxes.md
        │   └── statements/*.pdf
        └── q4/
            ├── in/
            ├── out/taxes/taxes.md
            └── statements/*.pdf
```

`<quarter>` may be `q1` through `q4`. A tax note directly under
`<quarter>/taxes/taxes.md` is also accepted. The canonical location for new
notes is `<quarter>/out/taxes/taxes.md`. An annual
`<reports-root>/<year>/statements/` directory is a temporary cleanup location,
not the preferred structure.

Example profile override:

```bash
# Copy taxes.command.example.config into the selected profile and bind it as
# the taxes command config. Keep the populated copy private and Git-ignored.
INCORPORATED_ROOT="${HOME}/accounting"
REPORTS_ROOT="${INCORPORATED_ROOT}/reports"
TAXES_OUTPUT_DIR=""
TAXES_PROVIDER="fs"
```

## Config

Loaded in this order:

- built-in portable behavior plus optional profile-owned overrides through `AI_COMMAND_CONFIG_PATH`
- command-line flags

Provider selection uses `TAXES_PROVIDER`, then `--provider`; the command defaults to `fs`. The current implementation
supports `fs`. A provider such as `quickbooks` must define an adapter that produces the same evidence and summary model;
it must not silently fall back to filesystem data after being explicitly selected.

Default root convention:

```bash
INCORPORATED_ROOT="${HOME}/accounting"
REPORTS_ROOT="${INCORPORATED_ROOT}/reports"
TAXES_PROVIDER="fs"
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

For provider `fs`, the tree above is normative. The command reads raw evidence from `statements/`,
uses `in/` and `out/` as the accounting workflow boundaries, and discovers
`taxes.md` only within tax or statement paths.

Resolve `<business-name>` from the selected accounting project metadata (`business_name`) whenever possible. If no
accounting project is selected and the user did not name a business, ask before summarizing business-specific taxes.

It searches for tax notes named `taxes.md` under year tax folders and statement folders. If none exist, it scans
statement PDFs through `ai-commands/statements/statements.command.sh`. When `taxes.md` exists, it reports both:

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
${AI_COMMANDS_ROOT}/taxes/taxes.command.sh summary --year 2026
${AI_COMMANDS_ROOT}/taxes/taxes.command.sh summary --provider fs --year 2026
${AI_COMMANDS_ROOT}/taxes/taxes.command.sh summary --year 2026 --show
${AI_COMMANDS_ROOT}/taxes/taxes.command.sh summary --year 2026 --reports-root /path/to/reports --no-open
```
