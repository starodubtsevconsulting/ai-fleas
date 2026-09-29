# education-profile-extractor.command

## Purpose

Create and evolve a model's canonical `education-profile.yml` from declared public information and controlled evidence.

The command operationalizes the process documented in [Models / Education Profile Extractor](../../../models/education-profile-extractor/).

It does **not** optimize a model until it passes. It updates our representation of what the model can do, how to communicate with it, what evidence contradicts prior beliefs, and what remains unknown.

## Operations

### Initialize a draft

```
education-profile-extractor.command.sh init \
  --model <model-id> \
  --declared <declared-profile.yml>
```

Creates `models/<model-id>/education-profile.yml` if it does not already exist.

### Apply evidence

```
education-profile-extractor.command.sh apply \
  --model <model-id> \
  --evidence <profile-update.yml>
```

Validates the evidence/update record, stores it under the model benchmark evidence area, and updates the profile's extraction ledger without erasing contradictory history.

### Inspect status

```
education-profile-extractor.command.sh status --model <model-id>
```

Reports claim-state counts, unresolved uncertainties, and whether the current profile declares itself sufficient for its intended purpose.

## Probe execution

Probe definitions live under `models/education-profile-extractor/probes/`. Model execution is intentionally separated from synthesis. A probe runner may be Hermes, another harness, or a future provider adapter, but it must return independently accepted evidence in the extractor update contract.

## Rules

The command follows `models/education-profile-extractor/rules.yml`:

- public information is draft/declared evidence;
- controlled behavior is observed evidence;
- one fixture does not become a global claim;
- contradictions are preserved;
- independent acceptance owns correctness;
- stop when sufficiently understood for the intended use.

## Outputs

- `models/<model>/education-profile.yml`
- evidence records under `models/<model>/benchmarks/education-profile-extraction/`
- machine-readable status on stdout

## Roles

Reusable across workflows. The caller/delegator owns the profiling objective; this command owns deterministic profile/evidence bookkeeping.
