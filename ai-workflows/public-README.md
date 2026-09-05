# AI Workflows

```mermaid
flowchart TD
  Actor["Actor: organization or user"]
  Actor --> Profile["Profile: policy and configuration"]
  Profile --> Workflow["Workflow: business or work process"]
  Workflow --> Commands["AI Commands: reusable executable skills"]
  Commands --> Outcome["Outcome: coordinated AI-assisted work"]
```

Reusable workflow definitions for coordinating AI-assisted work.

## Published contracts

```mermaid
flowchart TD
  Actor["Actor: public AI Workflows repository"]
  Actor --> Agents["Published: workflow agents contract"]
  Agents --> Review["Review portable workflow candidates"]
  Review --> Later["Publish approved workflows one at a time"]
  Later --> Outcome["Outcome: curated reusable workflow catalog"]
```

The repository currently publishes [`agents.md`](agents.md), the single common
contract for workflows that activate managed agents. It combines identity,
communication, capability boundaries, Admin, Judge, and lifecycle rules.
Concrete workflow definitions will be added separately after portability and
privacy review. Profiles, client bindings, credentials, and private runtime
configuration are not published here.

## Relationship to AI Commands

```mermaid
flowchart TD
  Actor["Actor: workflow"]
  Actor --> Process["Define a reusable business or work process"]
  Process --> Select["Select and coordinate bounded capabilities"]
  Select --> Commands["Use public AI Commands when applicable"]
  Commands --> Outcome["Outcome: workflow behavior with reusable command contracts"]
```

Workflows describe how work is coordinated. Commands describe reusable
capabilities that may be selected by a workflow. The public command catalog is
available at [AI Commands](https://github.com/starodubtsevconsulting/ai-commands).

The two repositories are intentionally separate: a command can be useful in
many workflows, and a workflow can select multiple commands without owning
their implementations.

## Workflow concept

```mermaid
flowchart TD
  Actor["Actor: profile selects a workflow"]
  Actor --> Context["Supply organization, policy, and project context"]
  Context --> Steps["Workflow coordinates decisions, commands, and optional agents"]
  Steps --> Evidence["Collect bounded outputs and completion evidence"]
  Evidence --> Outcome["Outcome: repeatable process independent of one profile"]
```

A workflow represents a reusable business or work process. It should remain
independent of one organization, client, profile, project, AI product, runtime,
or hosting model. External context supplies the configuration and sources needed
for a particular use.

## Planned portable shape

```mermaid
flowchart TD
  Actor["Actor: future workflow contribution"]
  Actor --> Contract["Required workflow Markdown contract"]
  Contract --> Optional["Optional agents, guides, tests, adapters, runtime, or UI"]
  Optional --> Validate["Validate portability and visual-first documentation"]
  Validate --> Outcome["Outcome: self-contained reusable workflow folder"]
```

The expected minimum is one human-readable workflow contract. Agent teams,
guides, acceptance scenarios, machine-readable manifests, adapters, executable
runtime code, and visual applications will remain optional and workflow-owned.
The final public template will be added when the first workflow is prepared for
review.

## Workflow agents

```mermaid
flowchart TD
  Actor["Actor: agent-enabled workflow"]
  Actor --> Common["Inherit agents.md identity, communication, and lifecycle rules"]
  Common --> Specific["Add workflow-specific roles and routes"]
  Specific --> Outcome["Outcome: one coherent workflow-owned agent system"]
```

Agent-enabled workflows inherit [`agents.md`](agents.md). It is workflow
infrastructure rather than an AI command or standalone agent. Each concrete
workflow adds its own roles, models, capabilities, routes, and stricter rules
without duplicating the common contract.

### Workflow-owned file responsibilities

| File                                   | One purpose                                                                            | Must not become                          |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `agents/team.md`                       | Readable roster: included roles, their contract files, and whole-roster initialization | A permission or packet-routing authority |
| `agents/role-capability-matrix.csv`    | Runtime role identity and lifecycle authority                                          | A work-ownership or transport definition |
| `agents/role-capability-ownership.csv` | Work ownership, execution, delegation, and prohibition authority                       | A roster or packet-format definition     |
| `agents/role-communication-matrix.csv` | Human and role-to-role communication authority                                         | A work-capability definition             |
| `agents/shared-execution-routing.md`   | Shared packet, verification, delivery, evidence, and closure mechanics                 | A source of roles or permissions         |
| `agents/<role>.md`                     | One role's bounded behavior and mechanics                                              | A duplicate team-wide permission matrix  |

The matrices decide what is allowed. The roster makes membership readable. Shared routing explains how an authorized
interaction travels. Role files explain how one role behaves inside those boundaries. Prose may narrow a matrix-authorized
action with safety checks, but it cannot create a missing role, capability, route, or exception.

### Role and capability matrices

The common package includes three empty CSV schemas:

- [`role-capability-matrix.csv`](role-capability-matrix.csv) defines the roles a workflow initializes and their runtime
  identity, model, lifecycle, human-facing mode, and communication mode.
- [`role-capability-ownership.csv`](role-capability-ownership.csv) defines what each role owns, may dispatch, may read,
  or must never perform.
- [`role-communication-matrix.csv`](role-communication-matrix.csv) defines human dialogue, internal packet, authorization
  relay, and role-to-role communication routes.

Empty common schemas grant nothing. An agent-enabled workflow copies and fills all three files in its own `agents/` folder.
Every role contract then places a readable `Capability declaration` near its top and links to those workflow-local
matrices. The readable table summarizes the boundary; the filled CSVs are the mechanical authority.

A simplified role matrix can look like this:

```csv
role,display_label,model,reasoning,lifecycle,human_facing,communication_mode
designer / reviewer,Designer / Reviewer,configured-model,low,persistent control,primary,human dialogue and agent packets
coder,Coder,configured-model,medium,disposable worker,not human-facing,internal packets only
command-runner,Command Runner,configured-model,low,disposable worker,not human-facing,internal packets only
```

The matching ownership matrix can look like this:

```csv
capability,designer_reviewer,coder,command_runner
Product requirements and architecture,OWN,READ_DETAIL,PROHIBITED
Product source and tests,PROHIBITED,OWN,PROHIBITED
Registered command execution,DISPATCH_ONLY,DISPATCH_ONLY,OWN
```

The matching communication matrix can look like this:

```csv
route,designer_reviewer,coder,command_runner
direct_human_dialogue,PRIMARY,PROHIBITED,PROHIBITED
send_internal_work_packet,AUTHORIZED,PROHIBITED,RETURN_ONLY
use_human_as_packet_courier,PROHIBITED,PROHIBITED,PROHIBITED
```

`OWN` remains bounded by the role contract, `DISPATCH_ONLY` permits routing to the exact owner, `READ_DETAIL` is
passive, and `PROHIBITED` is a hard boundary. A missing role, empty workflow-local matrix, broken declaration link, or
declaration/matrix disagreement fails closed. Later prose may explain mechanics or narrow a permission, but it cannot
create a route or capability absent from these matrices.

## Publication boundary

```mermaid
flowchart TD
  Actor["Actor: candidate workflow"]
  Actor --> Private["Develop and validate in the private canonical source"]
  Private --> Sanitize["Remove profiles, clients, credentials, paths, and private integrations"]
  Sanitize --> Review["Open an explicit public review"]
  Review --> Outcome["Outcome: curated public workflow"]
```

Additional workflows will be published only after portability, documentation,
privacy, and security review. The workflow-agent contract is reusable
infrastructure and does not publish any private profile or concrete workflow.
