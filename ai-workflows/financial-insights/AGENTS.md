# Financial Insights Workflow

This workflow configures agents for financial data analysis, bookkeeping, and tax preparation using local AI.

## Key Files

* `agents.yml` - Declares workflow agents (admin + bookkeeper)
* `agents/roles/bookkeeper.md` - Role definition for bookkeeper agent
* `financial-insights.workflow.md` - Workflow documentation
* `evidence-contract.md` - Evidence format and quality standards
* [Financial question](flows/financial-question.flow.md) - Requester-neutral bounded financial evidence; external consumers do not control bookkeeping
* [Quarter handover flow](flows/quarter-handover.flow.md) - Ordered Inspect → Process → Collect → Reconcile → Handover/close stages, accountable Bookkeeper, evidence, recovery and independent milestones
* [Statement reconstruction flow](flows/statement-reconstruction.flow.md) - Reusable source-linked statement evidence function for bounded questions and reconciliation
* [Duplicate cleanup flow](flows/duplicate-cleanup.flow.md) - Reusable bounded comparison, validated survivor, authorized removal and cleanup recovery
* [Record organization flow](flows/record-organization.flow.md) - Canonical adjacent records, shared quarter summary and on-demand aggregation
* [Tax payment flow](flows/tax-payment.flow.md) - Reviewed payroll-tax evidence, operational-period routing and human submission
* [Tax payment entry skill](../../ai-commands/data/taxes/skills/tax-payment-entry/SKILL.md) - Command-owned visible payment-form guidance; the taxes CLI does not execute browser payments
* [Wise statements skill](../../ai-commands/data/statements/skills/wise-statements/SKILL.md) - Command-owned official Wise balance-statement collection, routed from workflow and Bookkeeper guidance
* [Wave invoices skill](../../ai-commands/data/financial-records/skills/wave-invoices/SKILL.md) - Visible-browser Wave sales-invoice PDF collection guidance; not a financial-records runtime capability
* `flows/spending-question.flow.md` - Normative autonomous spending-answer method and completion scenarios
* `flows/record-lookup.flow.md` - Normative scoped lookup, exact paths, source verification and separate accuracy/procedure grading
* `walkthroughs/README.md` - Selection index for fictional Bookkeeper worked use cases; read only relevant examples

## Record intake invariant

Follow the [intake completion invariant](flows/record-organization.flow.md#intake-completion-invariant): placing a source is not completed intake. Normalize, validate adjacent extraction and verify authorized redundant-copy cleanup in the same authorized operation; begin intake, quarter-readiness and inventory work with a scoped catch-up scan. Exclude every folder whose name begins with `_` from ordinary intake; read `_common` for applicable summary context and inspect `_payed` only when the requested reconciliation explicitly includes its human-proof contents. A reserved folder or filename does not prove settlement. Skip unchanged validated records, keep normalization, extraction and cleanup states separate, and put unfinished reasons/next actions in the one quarter summary. Supported adapter, review and publication boundaries still apply; this rule does not install a continuous folder watcher.

## Public procedure privacy

Keep real account display names, client relationships, invoice and payment identifiers, dates and amounts, property and service addresses, actual account routes, and business-specific report paths in the private profile or source-adjacent records. A public provider skill may name the provider and explain its generic interface, but must not link that provider to a real person or organization. Before publishing, check file titles, directory names, frontmatter, filenames, paths, sample reconciliation rows, commit messages, PR titles and descriptions, and review comments for identifying details. Use clearly fictional examples or placeholders in public material.

## Agent Management

### Only Bookkeeper

As of Financial Insights v2, this workflow uses only **one worker agent**:
* `bookkeeper` - Handles bookkeeping tasks, tax preparation, and financial analysis

`agents.yml` declares `admin` as its initializer and `bookkeeper` as its worker.
Admin follows the canonical human-owned bootstrap contract; it is not an
automatically initialized external-planner-provided worker.

### Why Only Bookkeeper?

The `financial-analyst` and `financial-reviewer` agents were removed because:
1. They added complexity without significant benefit
2. The bookkeeper can handle all financial tasks with proper prompting
3. Fewer agents mean lower token costs and simpler configuration

### Adding More Agents

If you need to add more agents to this workflow:

1. Create role definition in `agents/roles/<agent-id>.md`
2. Add entry to `agents.yml` with proper fields
3. Update `../../ai-profile/sc/commands-config/hermes-agents/config.yml` to add agent to roles and callers
4. Run `hermes-agents reconcile` to initialize the profile
5. Update tests in `platforms/gpt-agents/agents/financial-insights-roster.test.mjs`

See `../../AGENTS.md` for full instructions.

## Configuration

Runtime configuration belongs to the selected authorized profile's configurable
command roots. Do not assume the repository-local private `ai-profile/sc` tree
is the operational source. The following Hermes keys apply to that profile's
`commands-config/hermes-agents/config.yml`:
* `workflow_agents.financial-insights.roles` - List of agent IDs
* `auxiliary_models.financial-insights` - Model settings and task timeouts

Effective platform selection uses the profile default, then workflow platform,
then role platform override. Pi version-2 model choices belong to that
profile's existing `pi-agents` configuration; optional scenario sessions do not
initialize managed roles. See the [compatible benchmark scenario](acceptance/financial-insights-compatible.scenario.md)
and its [configuration guide](../../notes/benchmarks/local-models/fixtures/financial-insights-compatible/README.md#selecting-configuration).
Test variant IDs are benchmark settings, not new work-profile authority.

## Common Commands

```bash
# Initialize/update Hermes profiles
./ai-commands/system/hermes-agents/hermes-agents.command.sh reconcile --work-profile sc --workflow financial-insights

# Verify configuration
node ai-commands/system/hermes-agents/src/resolve-workflow-scope.mjs "$PWD/ai-profile" <profile-id> financial-insights
```

## Testing

Run tests with:
```bash
node platforms/gpt-agents/agents/financial-insights-roster.test.mjs
```

This verifies that the roster contains the expected agents and roles.

## Self-Learning

### Financial operation procedures belong to their commands

* What happened: a reusable Wise statement procedure was installed as a personal skill outside the repository.
* Root cause: personal skill discovery was used instead of the owning AI command's maintained procedure location.
* How we fixed it: moved the procedure to `ai-commands/data/statements/skills/wise-statements` and linked it from the command contract and spec.
* How to avoid: keep reusable financial operation procedures under `ai-commands/<category>/<command>/skills/`, linked from their owning command; do not create a separate personal installation for these procedures. Command authorization and supported runtime operations remain unchanged.
* Verification: validate the skill, resolve its relative links, and confirm the superseded personal installation is absent.

### One source pair and one quarter overview

* What happened: combined extracts and separate knowledge/readiness/preparation folders duplicated adjacent records and quarter status.
* Root cause: extraction intermediates and derived status were treated as separate durable record concepts.
* How we fixed it: the record-organization flow defines adjacent source CSV/JSON and one `_common/qN/summary.md`, with annual matters separate and aggregates composed on demand.
* How to avoid: preserve source provenance and existing JSON naming; update one summary, retain unique evidence, and remove only regenerable intermediates through authorized effects. Revalidate summaries and keep reconciliation pending until supported.
* Verification: documentation links and diff checks cover this contract change; no runtime migration or exporter acceptance is claimed. Learning was recorded using the self-learning contract's format; no profile-aware CLI execution is claimed.


### Mortgage extraction needs a ledger and a stopping checkpoint

* What happened: bounded quarter-payment trials repeatedly re-extracted already available statement pages and performed unrelated account-balance calculations; one final response led with a wrong count/total before supplying a correction, while another run timed out without an answer.
* Root cause: flattened statement columns made row alignment ambiguous, and the agent had no completed payment ledger or explicit stopping checkpoint. Assumed payment frequency and repeated free-form arithmetic did not reliably preserve the observed rows.
* How we fixed it: clarified the mortgage worked use case to prefer column-preserving extraction, resolve only specific ambiguous fields, checkpoint one row per posted debit/reversal, and mechanically count and sum signed integer-cent amounts before finalizing one consistent answer.
* How to avoid: scan all covered pages once; re-read only unresolved fields. Preserve unknown principal/interest and unaligned rows instead of guessing. Stop after the payment ledger, coverage and arithmetic agree; do not turn a mortgage question into a full-account balance audit.
* Verification: private trial traces preserve the inconsistent final response and timeout separately from financial facts. Documentation and fictional arithmetic are checked; this new guidance has not yet been tested in another model run and does not establish autonomous acceptance.

### Reader units and recovery roots are executable constraints

* What happened: a follow-up lookup read the selected worked example and answered correctly, but documentation reads exceeded the character budget, one offset was beyond the file, and a final listing inspected the parent outside its authorized data subtree.
* Root cause: the reader's offset/limit counted lines while the agent treated them as characters; checking neighboring evidence was mistaken for permission to list an unauthorized parent.
* How we fixed it: the record-lookup flow now requires explicit reader units, character/byte slices with continuation offsets and room for tool labels, and recovery only inside the authorized root.
* How to avoid: never pass a character budget as a line limit. Bound every documentation/data result using the actual reader semantics. Keep exact source paths and scope roots in checkpoints; guidance does not grant broader data access. If settlement proof is outside scope, return payment unproven rather than listing parents or siblings.
* Verification: the observed follow-up passes financial accuracy and actual guide reading, but fails output and folder-bound compliance. Its immutable transcript retains those deviations; the documentation fix has not yet been verified by another model run.

### Correct answers do not prove guide or output-bound compliance

* What happened: a real scoped lookup returned the correct financial answer and checked an original PDF mechanically, but read only the worked-use-case index, exceeded its output budget on that index read, and initially dropped a nested period directory from two source paths.
* Root cause: guide selection did not explicitly require reading the selected example; the growing index was treated as one unbounded read; paths were reconstructed rather than preserved from inventory.
* How we fixed it: added the normative record-lookup flow and linked it from the Bookkeeper role and index. Require bounded selector searches and example chunks before data, exact nested paths, bounded sidecar fields, original-source checks and separate obligation/settlement dates.
* How to avoid: checkpoint exact paths and selected guidance; re-list the last verified parent after a path error; apply output budgets to documentation too. Keep user answers concise and omit full tax/account identifiers. Grade numerical accuracy, guide compliance and scope/tool bounds separately.
* Verification: the observed run supports financial accuracy and autonomous recovery, with partial guide/bounds compliance; it does not prove full worked-case execution. The new fictional acceptance cases cover a Q3 liability filed in Q4, path recovery and missing payment proof. A separate real run must verify the changed procedure.

### Tax payment dates and statement direction

* What happened: a tax document's quarter, print date, or paid filename could imply a Q2 payment, and flattened statement text could make a government deposit look like an outgoing payment.
* Root cause: liability period, requested date, posted settlement date, and debit/credit direction are separate facts; payee labels also do not establish tax program or refund purpose.
* How we fixed it: added the fictional tax-payments worked use case with confirmation-to-bank-reference matching, source-table inspection, separate jurisdiction/program fields, and explicit conflicting declaration/request amounts.
* How to avoid: count confirmed posted payments on the declared cash basis once; preserve scheduled payments, unknown credits, federal/municipal categories, payroll contributions, and mismatches separately. Never infer settlement from a filename or net an unexplained government credit.
* Verification: the fictional provincial subtotal is CAD 840.00; a July request, federal and municipal debits, and an unclassified deposit are excluded for stated reasons. This example is instructional, not executed evidence.

### Worked solutions make procedural rules actionable

* What happened: general phases did not show a modest model which concrete operation or evidence-based decision to take next.
* Root cause: phase labels omitted the mapping from request to scope, bounded tool action, observation, and next decision.
* How we fixed it: added `walkthroughs/README.md` and three fictional worked solutions, with progressive selection, normalized rows, sources, arithmetic, and recovery.
* How to avoid: keep examples independent of harness names and actual private reference answers; adapt them to authorized mappings and capabilities rather than loading every example or copying its fictional facts.
* Verification: check relative documentation links and decimal arithmetic; these instructional examples are not executed evidence, and autonomous agent acceptance still requires a real end-to-end run.

### Diagnostic batches versus an operational spending answer

* What happened: isolated classification/verification calls succeeded, but the human's spending question still had no answer.
* Root cause: the diagnostic runner selected candidates and owned aggregation, so successful component checks did not prove autonomous bookkeeping.
* How we fixed it: the normative spending-question flow assigns discovery, independent statement scanning, extraction, normalization, reconciliation, and arithmetic to the Bookkeeper from one request.
* How to avoid: root-level bounded Pi/Qwen notes about disabled tools, one-candidate packets, and external result aggregation describe diagnostic experiments only. They do not replace the operational agent's tools or full-task ownership. Bound its tool work internally and preserve checkpoints. Return an evidence-supported numeric subtotal with explicit coverage gaps when a complete total cannot be established.
* Verification: derive end-to-end acceptance from `flows/spending-question.flow.md`; require the agent to discover its own records and produce a reproducible numeric answer. Intermediate JSON validity is component evidence only.

When you work on the financial-insights workflow:

1. **Check this AGENTS.md first** for workflow patterns and agent management
2. **Extract learnings** when you discover new patterns
3. **Use self-learning command** to formalize:
   ```bash
   self-learning extract financial-insights
   ```

This AGENTS.md captures workflow-specific patterns - use it before modifying workflow config.

See `ai-commands/utility/self-learning/self-learning.command.md` for the full self-learning contract.

## Flow audit: role and command ownership alignment

* What happened: tax guidance retained an undeclared Financial Reviewer and a workflow-owned operational skill after the Bookkeeper-only simplification.
* Root cause: downstream review wording and procedure ownership were not aligned with the roster and command boundaries.
* How we fixed it: use required authorized external review, command-owned tax-payment guidance, and the existing single quarter summary for pending work.
* How to avoid: consult the [financial-records command contract](../../ai-commands/data/financial-records/financial-records.command.md) and actual supported routes before promising normalization. Its tax apply/reconcile currently reject operational Q3 for every year; that restriction does not establish actual quarter closure or authorize moving open-Q3 work to Q4.
* Verification: skill metadata and documentation links validated; the fixed Q3 rejection was inspected in source, not exercised as runtime acceptance evidence.
