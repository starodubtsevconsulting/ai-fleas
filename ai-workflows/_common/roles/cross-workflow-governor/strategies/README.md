# Cross-Workflow Governor strategy grammar

This directory is the portable strategy/template catalog. It defines reusable governance methodology; concrete profile data does not live here.

## Vocabulary

### Policy

A policy defines an authority or behavioral boundary: what **must**, **may**, or **must not** happen. Policies constrain everything below them.

Example: human-owned goals must not be silently changed by the Governor.

### Principle

A principle is a general reasoning rule used inside policy boundaries. It guides choices without being a complete procedure.

Example: a deliberate prior commitment normally outranks a temporary preference at execution time.

### Method

A method is a reusable operational/governance approach that applies one or more principles while respecting applicable policies.

A method may be reasoning-oriented or may contain an ordered **procedure** when the activity is naturally repeatable. A procedure inside a Governor method is not a workflow `flow`.

Examples include commitment discipline, execution adaptation, one-on-one, and external feedback loop.

### Strategy

A strategy is a selected composition of versioned methods plus the principles needed to coordinate them, constrained by Governor policies.

A strategy is adaptive rather than a deterministic pipeline. At runtime the Governor observes current state, reasons about what matters, selects applicable methods, executes their procedures/reasoning, observes results, and adapts.

### Flow

`Flow` retains its existing AI Fleas meaning inside a **workflow**: ordered operational execution coordinating workflow agents/commands.

Do not introduce Governor flows merely because a Governor method contains an ordered procedure. If a Governor method requires substantial operational work, it delegates to the appropriate workflow, whose own flow governs that execution.

## Grammar

```text
POLICY     constrains everything below
   ↓
PRINCIPLE  guides reasoning
   ↓
METHOD     operationalizes principles; may contain a procedure
   ↓
STRATEGY   adaptively composes/selects methods
   ↓
PROFILE    selects strategy coordinates + external instance data

WORKFLOW   owns operational FLOWS separately
```

This is a semantic relationship, not strict file inheritance.

## Template structure

A strategy family is a directory with two independently versioned components:

```text
strategies/
├── README.md
├── default/
│   ├── strategy.yml
│   ├── strategy.v1.md
│   └── human.v1.md
└── <future-strategy>/
    ├── strategy.yml
    ├── strategy.v1.md
    ├── strategy.v2.md
    ├── human.v1.md
    └── human.v2.md
```

- `strategy.<version>.md` defines goal/workflow/external governance methodology.
- `human.<version>.md` defines governed-human guidance methodology.
- `strategy.yml` is the machine-readable manifest listing versions and composed methods.

Reusable Governor methods live under `../methods/<method-id>/<version>.md`.

## Runtime model

```text
selected strategy
      ↓
observe state/evidence
      ↓
reason about what matters now
      ↓
select applicable method(s)
      ↓
apply method reasoning/procedure
      ↓
observe result + persist durable evidence
      ↓
adapt and repeat
```

The strategy therefore creates the Governor's ongoing pattern of activity without becoming a deterministic workflow flow.

## Profile selection

The reusable catalog defines what exists. The AI Profile selects what its concrete Governor follows and where mutable instance data lives.

```yaml
governorStrategy:
  id: default
  strategyVersion: v1
  humanVersion: v1
  data:
    strategy:
      uri: <external-strategy-data>
    human:
      uri: <external-human-data>
```

The methodology coordinate is:

`<strategy-family> / <strategy-version> / <human-version>`

The component versions are intentionally independent. Unknown strategy/version coordinates fail closed. Runtime learning may update external instance data but must not silently change methodology coordinates.

## Definitions versus instance data

Templates describe **how to govern**. External instance data describes **what is actually happening**.

Concrete goals, progress, decisions, reports, graphs, metrics, execution events, traits, evidence, and learned patterns belong in profile-bound external data. That data may be Google Docs today and structured memory/database/files later without changing strategy versions.

## Memory methods

Memory organization is a reusable common concern rather than a storage-specific Governor implementation detail. Common memory methods may define semantics such as fleeting capture, references, permanent concepts, outputs, metadata/index separation, and review lifecycle.

A Governor strategy/method may use those semantics, while the governed human may also use the same memory method independently.

## Versioning

Create a new method or strategy-component version when reusable governance semantics change. Do not version the methodology merely because concrete instance data changed.

## Default

`default` is the baseline strategy family supplied by AI Fleas. It is a starting point, not a claim that one methodology is optimal for every governed human or profile.
