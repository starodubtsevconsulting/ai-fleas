# Cross-Workflow Governor strategies

This directory is the portable strategy catalog for the Cross-Workflow Governor.

A **strategy family** is a folder. Each family provides two independently versioned components:

- `strategy.<version>.md` — strategy/workflow governance methodology;
- `human.<version>.md` — governed-human guidance methodology.

The family manifest `strategy.yml` declares available versions and defaults.

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

## Profile-owned selection

The reusable catalog defines what exists. The concrete AI Profile selects what its Governor follows.

```yaml
governorStrategy:
  id: default
  strategyVersion: v1
  humanVersion: v1
```

The coordinate is therefore:

`<strategy-family> / <strategy-version> / <human-version>`

The two versions are intentionally independent. For example, a profile may keep `strategyVersion: v1` while moving to `humanVersion: v2` when only the human-guidance methodology changes.

The profile must resolve all three coordinates to an existing strategy family and declared component versions. Unknown strategies or versions fail closed. Runtime learning may update instance memory but must not silently change these selected coordinates.

## Definitions versus instance data

Strategy catalog files define **how the Governor governs**. They do not contain a concrete person's traits, goals, execution history, private evidence, or organization-specific configuration.

Concrete profile memory contains the governed human's actual data and goals. That data may currently live in human-readable documents and later move to structured storage without changing the selected strategy contract.

## Default

`default` is the baseline strategy family supplied by AI Fleas. It is a starting point, not a claim that one governance or human-guidance methodology is optimal for every person or profile.
