# AI

```mermaid
flowchart TD
  Actor["Actor: person exploring the public AI collection"]
  Actor --> Commands["AI Commands: pluggable executable skills"]
  Actor --> Workflows["AI Workflows: reusable work processes"]
  Commands --> Outcome["Outcome: discover the currently published projects"]
  Workflows --> Outcome
```

Public entry point for reusable AI-assisted work projects from Starodubtsev
Consulting.

## Repositories

```mermaid
flowchart TD
  Actor["Actor: AI-assisted work"]
  Actor --> Workflow["Workflow defines the business or work process"]
  Workflow --> Commands["Commands provide reusable capabilities"]
  Commands --> Outcome["Outcome: coordinated portable building blocks"]
```

### [AI Commands](https://github.com/starodubtsevconsulting/ai-commands)

Pluggable executable skills that combine AI-readable Markdown contracts with
optional scripts, supporting code, configuration boundaries, reports, and
command-owned visual tools.

### [AI Workflows](https://github.com/starodubtsevconsulting/ai-workflows)

The future public catalog for reusable business and work processes that
coordinate commands. It is currently a README-only TODO placeholder.

## Current status

```mermaid
flowchart TD
  Actor["Actor: larger private AI project"]
  Actor --> Review["Select a portable piece for public review"]
  Review --> Publish["Publish approved repositories incrementally"]
  Publish --> Outcome["Outcome: small curated public collection"]
```

Only the repositories listed above are currently published as part of this
collection. Additional commands, workflows, profiles, runtimes, and integrations
remain outside the public collection unless they receive a separate explicit
review.
