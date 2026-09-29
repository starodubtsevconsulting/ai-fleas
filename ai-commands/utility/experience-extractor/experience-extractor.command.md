# experience-extractor.command

## Purpose

Mechanical bookkeeping Command used by an Agent in the **Model Experience Extractor** role. It creates/evolves a model's canonical `experience-profile.yml` from declared information and already-evaluated evidence.

The Command is **not the Extractor Agent**: it does not choose hypotheses, design probes, judge model behavior, or decide what the evidence means. Those responsibilities belong to the Extractor role/default flow and independent verifier.

The command operationalizes the process documented in [Models / Experience Extractor](../../../models/experience-extractor/).

It does **not** optimize a model until it passes. It updates our representation of what the model can do, how to communicate with it, what evidence contradicts prior beliefs, and what remains unknown.

## Operations

### Initialize a draft

```
experience-extractor.command.sh init \
  --model <model-id> \
  --declared <declared-profile.yml>
```

Creates `models/<model-id>/experience-profile.yml` if it does not already exist.

### Apply evidence

```
experience-extractor.command.sh apply \
  --model <model-id> \
  --evidence <profile-update.yml>
```

Validates the evidence/update record, stores it under the model benchmark evidence area, and updates the profile's extraction ledger without erasing contradictory history.

### Inspect status

```
experience-extractor.command.sh status --model <model-id>
```

Reports claim-state counts, unresolved uncertainties, and whether the current profile declares itself sufficient for its intended purpose.

## Probe execution

Probe definitions live under `models/experience-extractor/probes/`. Model execution is intentionally separated from synthesis. A probe runner may be Hermes, another harness, or a future provider adapter, but it must return independently accepted evidence in the extractor update contract.

## Rules

The command follows `models/experience-extractor/rules.yml`:

- public information is draft/declared evidence;
- controlled behavior is observed evidence;
- one fixture does not become a global claim;
- contradictions are preserved;
- independent acceptance owns correctness;
- stop when sufficiently understood for the intended use.

## Outputs

- `models/<model>/experience-profile.yml`
- evidence records under `models/<model>/benchmarks/experience-extraction/`
- machine-readable status on stdout

## Roles

Reusable across workflows. The caller/delegator owns the profiling objective; this command owns deterministic profile/evidence bookkeeping.
