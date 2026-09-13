# Personal Governor strategy grammar

This directory is the portable Personal Governor strategy/template catalog. It defines reusable governance methodology; concrete profile data does not live here.

## Vocabulary

- **Policy** — authority/behavior boundary: what must, may, or must not happen.
- **Principle** — general reasoning rule inside policy boundaries.
- **Method** — reusable governance approach that operationalizes principles; it may contain an ordered procedure when naturally repeatable.
- **Strategy** — adaptive composition/selection of versioned methods and coordinating principles.
- **Flow** — retains its separate AI Fleas meaning inside a workflow: ordered operational execution coordinating workflow agents/commands.

A procedure inside a Personal Governor method is not a workflow flow. When substantial operational execution is needed, the Personal Governor delegates to an appropriate workflow and its flow.

## Grammar

```text
POLICY     constrains
   ↓
PRINCIPLE  guides reasoning
   ↓
METHOD     operationalizes; may contain procedure
   ↓
STRATEGY   adaptively composes/selects methods
   ↓
PROFILE    selects coordinates + external instance data

WORKFLOW   owns operational FLOWS separately
```

## Strategy structure

Each strategy family contains independently versioned strategy/workflow and human components plus a manifest. Reusable methods live under `../methods/<method-id>/<version>.md`.

```text
strategies/
  default/
    strategy.yml
    strategy.v1.md
    human.v1.md
```

A concrete profile selects the strategy family/component versions and binds external mutable data. Templates describe **how to govern**; external instance data describes **what is actually happening**.

## Runtime

`observe -> reason -> select applicable method(s) -> apply method reasoning/procedure -> observe result -> persist evidence -> adapt`

This creates the Personal Governor's ongoing pattern of activity without turning governance into a deterministic workflow pipeline.

## Memory methods

Memory organization is a reusable common concern. Common memory methods may define fleeting capture, references, permanent concepts, outputs, metadata/index separation, and review lifecycle. The Personal Governor can govern memory health through those methods while the human can use the same memory methodology independently.

## Versioning

Create a new method or strategy-component version when reusable governance semantics change, not when concrete instance data changes.
