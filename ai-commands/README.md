# AI Commands

```mermaid
flowchart TD
  Actor["Actor: person or AI needs a reusable capability"]
  Actor --> Contract["Read the command contract"]
  Contract --> Execute["Use optional automation or visual tools"]
  Execute --> Outcome["Outcome: portable executable skill"]
```

**Pluggable executable skills for AI-assisted work.**

AI Commands combine human-readable guidance with optional deterministic
automation and visual tools. A command may be as small as one Markdown contract
or as capable as a self-contained feature application with scripts, tests,
reports, and an Electron or browser-based interface.

We call them **commands** because “skill” describes only part of the idea. They
can teach an AI how to perform a task, but they can also execute repeatable work,
validate the environment, produce evidence, and offer a purpose-built UI.

## What is an AI Command?

```mermaid
flowchart TD
  Intent["User intent"]
  Intent --> Contract["AI-readable command contract"]
  Contract --> Context["Profile + workflow + project context"]
  Context --> Decision{"Does the command need executable behavior?"}
  Decision -->|No| Guidance["Apply the documented skill safely"]
  Decision -->|Yes| Execute["Run deterministic scripts or adapters"]
  Execute --> Surface{"Would a visual surface help?"}
  Surface -->|No| Evidence["Return logs, reports, or artifacts"]
  Surface -->|Yes| UI["Open a command-owned Electron or web UI"]
  UI --> Evidence
  Guidance --> Outcome["Reusable, auditable outcome"]
  Evidence --> Outcome
```

The Markdown contract remains the source of truth. Executables and interfaces
make appropriate parts deterministic or easier to use; they do not silently
replace the command’s declared behavior and safety boundaries.

## Command shapes

```mermaid
flowchart TD
  Actor["Actor: command author"]
  Actor --> Contract["Start with a Markdown contract"]
  Contract --> Mechanics{"Need deterministic mechanics?"}
  Mechanics -->|No| Skill["Contract command"]
  Mechanics -->|Yes| Script["Executable or integrated command"]
  Script --> Visual{"Need interaction or rich output?"}
  Visual -->|No| Flow["Script or composed flow"]
  Visual -->|Yes| UI["Visual command"]
  Skill --> Outcome["Outcome: smallest useful command shape"]
  Flow --> Outcome
  UI --> Outcome
```

- **Contract** — Markdown guidance for reasoning, policy, routing, review, or
  coordination.
- **Executable** — a contract plus scripts for repeatable validation,
  transformation, setup, or reporting.
- **Adapter** — a stable provider-neutral command that resolves one registered
  provider command, such as `source-control` selecting `git` or
  `ticket-tracker` selecting `jira`.
- **Provider implementation** — deterministic mechanics for one external
  provider; it cannot select itself or own profile policy.
- **Visual** — a command-owned Electron or web UI for controls, previews,
  progress, file selection, or rich reports.
- **Flow** — composition of other commands into a multi-step, evidence-producing
  outcome.

A command can grow from one shape into another without changing its public
identity or forcing every installation to use the optional pieces.

## Adapter commands

```mermaid
flowchart TD
  Intent["Provider-neutral user or workflow intent"]
  Adapter["Adapter command: stable capability and policy boundary"]
  Profile["Profile: explicit provider binding and supported overrides"]
  Provider["Provider command: deterministic mechanics"]
  Evidence["Provider-neutral outcome and evidence"]

  Intent --> Adapter
  Profile --> Adapter
  Adapter --> Provider
  Provider --> Evidence
```

An adapter command presents one stable capability while allowing a profile to
select an established provider implementation. The adapter owns intent,
authorization, provider resolution, policy interpretation, and the shape of the
result. The provider command owns only provider-specific mechanics.

Current adapter commands include:

| Adapter command                                              | Provider commands                                   | Capability                         |
| ------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------- |
| [`source-control`](source-control/source-control.command.md) | [`git`](git/git.command.md)                         | Repository inspection and mutation |
| [`ticket-tracker`](ticket-tracker/ticket-tracker.command.md) | [`jira`](jira/jira.command.md) and registered peers | Ticket lifecycle                   |

Adapters must fail closed when a profile binding is missing, ambiguous,
disabled, or inconsistent. They must not infer a provider from URLs, installed
executables, repository contents, company names, or conversation history.

### Flat discovery and subcommands

```mermaid
flowchart TD
  Catalog["Flat command catalog: one stable name per capability"]
  Catalog --> Adapter["Adapter command selects a peer provider command"]
  Catalog --> Command["Regular command"]
  Command --> Subcommand["Optional subcommand: one scoped operation"]
  Adapter --> Lookup["Outcome: direct name-based lookup"]
  Subcommand --> Lookup
```

Keep command definitions at the catalog's top level whenever practical. An
adapter and its provider implementations remain peer commands—for example,
`source-control` and `git`—rather than becoming a nested command tree. This
keeps discovery, registry validation, links, and name-based lookup simple.

A **subcommand** is different: it is a bounded operation exposed by one command,
such as `discussion lookup-conversation`. It shares the parent command's
identity and contract. A provider implementation has its own command identity
and is selected by an adapter through validated profile configuration. Internal
scripts and code may still use subfolders when that improves implementation
cohesion; those folders do not change the flat public command namespace.

## Portable structure

```mermaid
flowchart TD
  Actor["Actor: portable command package"]
  Actor --> Required["Required: name.command.md"]
  Required --> Optional["Optional: scripts, config examples, tests, scenarios, and UI"]
  Optional --> Boundary["Keep credentials and local output outside version control"]
  Boundary --> Outcome["Outcome: self-contained command folder"]
```

Only `<name>.command.md` is required. Everything else is optional and should be
added only when the command needs it.

```text
<name>/
├── README.md                    # concise human overview
├── <name>.command.md            # required AI-readable contract
├── <name>.command.sh            # optional executable entry point
├── <name>.command.example.conf  # optional safe configuration template
├── <name>.scenario.md           # optional agent-run live acceptance scenario
├── feature.yml                  # optional visual-feature metadata
├── app.sh                       # optional standalone UI launcher
├── launcher/                    # optional Electron or browser UI
├── adapters/                    # optional provider-specific mechanics
├── test/                        # optional contract and executable tests
└── reports/                     # optional local output; normally ignored
```

Local credentials and environment-specific configuration must never be
committed. Publish example configuration with placeholders and keep actual
values in ignored, provider-appropriate local storage.

Executable tests and live scenarios serve different purposes. Automated tests
verify scripts and code deterministically. A `<name>.scenario.md` file guides a
human-facing agent through the command as a user would experience it, including
prerequisite discovery, authorized installation, execution, visual inspection,
and evidence-backed completion. A scenario must be safe to rerun, declare any
external effects, and never treat a passing script test as proof that the full
human-visible experience works.

## Design principles

```mermaid
flowchart TD
  Actor["Actor: command receives bounded context"]
  Actor --> Contract["Contract defines intent and limits"]
  Contract --> Context["Profile, workflow, and project select policy"]
  Context --> Guard{"Identity, capability, config, and authority valid?"}
  Guard -->|No| Blocked["BLOCKED: perform no mutation"]
  Guard -->|Yes| Execute["Use the smallest deterministic or visual adapter"]
  Execute --> Outcome["Outcome: portable evidence"]
  Blocked --> Outcome
```

- **Contract first.** Natural-language intent, inputs, boundaries, and expected
  evidence are readable before execution.
- **Deterministic where practical.** Scripts own repeatable mechanics,
  dependency checks, validation, and artifact production.
- **Context bound.** Profile, workflow, and project coordinates select policy
  and configuration without hardcoding a client into a portable command.
- **Fail closed.** Missing identity, capability, configuration, authorization,
  or route evidence blocks mutation.
- **UI optional.** Electron and web surfaces are adapters over the command, not
  a requirement for headless use.
- **Portable core, local integration.** Public commands stay reusable while
  private workflows and profiles extend them externally.

## Published commands

```mermaid
flowchart TD
  Actor["Actor: public command candidate"]
  Actor --> Review["Remove organization and workflow coupling"]
  Review --> Safety["Verify credentials and private configuration are absent"]
  Safety --> Publish["Publish contract and command-owned assets"]
  Publish --> Outcome["Outcome: reusable public command"]
```

### [`show-context`](show-context/README.md)

Generic human-facing context presentation for reports, code review,
investigation, handoff, and other composed flows. It provides a visual-first
contract and report template plus a private executable renderer.

### [`doc`](doc/doc.command.md)

Reusable documentation fixture composition, project-readiness checks, and
independent principles for diagrams, project context, top-of-file source
documentation, and same-basename runnable-file companions.

More commands will be published one at a time after their organization-specific
assumptions, credentials, and workflow coupling have been removed.

## Related repositories

```mermaid
flowchart TD
  Actor["Actor: reusable workflow"]
  Actor --> Process["Define a business or work process"]
  Process --> Commands["Select reusable AI Commands"]
  Commands --> Outcome["Outcome: coordinated AI-assisted work"]
```

[AI Workflows](https://github.com/starodubtsevconsulting/ai-workflows) is the
future public catalog for reusable processes that coordinate commands. It is
currently a README-only TODO placeholder; no workflow definitions are published
there yet.

## Creating and managing commands

```mermaid
flowchart TD
  Actor["Actor: command catalog maintainer"]
  Actor --> Factory["Factory stages a bounded definition change"]
  Factory --> Registry["Update definition and route registry together"]
  Registry --> Validate["Validate references and catalog shape"]
  Validate --> Outcome["Outcome: atomic managed command change"]
```

The private catalog conventions, command structure, visual-first documentation
rules, configuration boundaries, and runtime integration remain in
[`commands.md`](commands.md). Public extraction rules are maintained separately
in [`PUBLISHING.md`](PUBLISHING.md).

Command catalogs benefit from a small factory that creates, updates, renames,
and removes definitions together with their execution-route registry. The
factory should treat route names as opaque identifiers: workflows and external
policy decide what a route means and whether it is authorized.

The portable factory and registry package are being prepared separately. Until
they are published here, contributors should preserve the structure above and
review command additions as complete, self-contained changes.

## Repository boundary

```mermaid
flowchart TD
  Actor["Actor: reusable command"]
  Actor --> Public["Public: contract and command-owned assets"]
  Actor --> External["External: workflows, profiles, projects, and credentials"]
  Public --> Outcome["Outcome: portable core"]
  External --> Outcome
```

This repository contains reusable command contracts and their command-owned
assets. Workflow definitions, organization profiles, project bindings,
credentials, and private configuration belong outside it. They may reference
and extend these commands without being included in this repository.

## Private canonical extensions

```mermaid
flowchart TD
  Actor["Actor: private command maintainer"]
  Actor --> Public["Retain every portable public contract and guide"]
  Public --> Private["Reconcile portable improvements from either side"]
  Private --> Publish["Keep registered public artifacts byte-identical"]
  Publish --> Outcome["Outcome: exact mirror with private configuration outside it"]
```

This package contains the private catalog and runtime conventions in [`commands.md`](commands.md). Registered public
artifacts follow [`PUBLISHING.md`](PUBLISHING.md): portable improvements may originate on either side, but reconciliation
must make every registered path byte-identical and keep private configuration outside the mirror. The public MIT license does
not license this private monorepo.
