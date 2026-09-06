# statements.command

## Purpose

Use `statements` to inspect accounting statement PDFs and extract source-backed candidates for tax payments. Statements
are the raw evidence layer; generated or curated `taxes.md` files are summaries derived from statement evidence plus
accountant/payment notes.

The command is provider-neutral. Its default provider is `fs`, which discovers PDFs in the folder structure below. A
future provider such as `quickbooks` may supply equivalent statement evidence without changing the command's candidate
schema or verification rules. Providers other than `fs` must be implemented and explicitly selected before use.

The command must not hardcode personal absolute paths. Its portable fallback is `~/accounting`; put machine-specific
roots in the selected profile or pass `--reports-root`.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes the command and resolves profile-owned configuration. |
| Provider | No | `--provider` or `STATEMENTS_PROVIDER`; defaults to `fs` | Selects the statement evidence provider. |
| Command-specific input | Yes | User, workflow, profile, or source artifact | Year/business scope, reports root, statement PDFs, and extraction options. |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- Markdown evidence report printed to stdout, including totals for numeric candidates.
- Markdown artifact written under `.ai/tmp/statements/` by default.
- With `--show`, opens the artifact with `ai-commands/show-context/show-context.command.sh`.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `statements/statements.command.sh` | Shell executable | Activate the selected profile and workflow, then invoke through the host's profile-aware command runner. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `statements/statements.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Tags

#command #ai-command #statements #accounting #taxes #rbc #cibc #show-context

## Config

Loaded in this order:

- built-in portable behavior plus optional profile-owned overrides through `AI_COMMAND_CONFIG_PATH`
- command-line flags

Provider selection uses `STATEMENTS_PROVIDER`, then `--provider`; the command defaults to `fs`. The current
implementation supports `fs`. An explicitly selected provider such as `quickbooks` must use its own adapter and must not
silently read the filesystem instead.

Default root convention:

```bash
INCORPORATED_ROOT="${HOME}/accounting"
REPORTS_ROOT="${INCORPORATED_ROOT}/reports"
STATEMENTS_PROVIDER="fs"
```

## Expected Folder Structure

Provider `fs` uses the same canonical accounting structure as `taxes`. Organize each business by year and quarter:

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
`<quarter>/taxes/taxes.md` is accepted for compatibility, while
`<quarter>/out/taxes/taxes.md` is canonical for new notes. An annual
`<reports-root>/<year>/statements/` directory is a temporary cleanup location,
not the preferred structure.

## Intent Mapping

Requests like these map to `statements` inside the accounting workflow:

- `scan statements for tax payments`
- `find RBC tax payments`
- `find CIBC tax payments`
- `extract tax candidates from statements`
- `generate tax evidence from PDFs`

If the user says `show me ...`, use `--show` so the generated evidence report opens through `show-context` in the browser.

## Structure Contract

For provider `fs`, `statements` reads the raw PDF evidence from the shared tree above. It searches these locations for
the requested year and business:

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
${AI_COMMANDS_ROOT}/statements/statements.command.sh tax-candidates --year 2026
${AI_COMMANDS_ROOT}/statements/statements.command.sh tax-candidates --provider fs --year 2026
${AI_COMMANDS_ROOT}/statements/statements.command.sh tax-candidates --year 2026 --show
${AI_COMMANDS_ROOT}/statements/statements.command.sh tax-candidates --year 2026 --reports-root /path/to/reports --no-open
```

## Relationship To Taxes

`taxes.md` is not the raw source of truth. It is a generated or curated summary built from statement evidence, tax
slips, CRA/MRQ/RQ records, and accountant notes. When `taxes` cannot find a `taxes.md` note for a year, it should fall
back to this command to inspect statement PDFs and produce tax candidates.
