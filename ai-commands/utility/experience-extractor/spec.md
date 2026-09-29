# Model Experience Extractor specification

## Boundary

This Command is the deterministic mechanic beneath the Model Experience Extractor Agent/flow. It has three responsibilities:

1. initialize a draft profile from declared/public information;
2. apply independently evaluated evidence without losing contradictions;
3. report profile state and unresolved questions.

Running a model is a pluggable probe-runner concern. The core must not depend on Qwen, Hermes, GX10, or a Dev workflow.

## Evidence update contract

Input follows `models/education-profile-extractor/templates/profile-update.yml`.

Required:
- claim.id
- claim.new_state
- claim.statement
- at least one evidence path
- model
- deployment
- task family
- result
- interpretation.supports
- interpretation.does_not_prove
- next action

Allowed states: confirmed, refined, contradicted, inferred-but-unverified, unknown.

## Storage

Canonical profile:
`models/<model>/education-profile.yml`

Extraction evidence:
`models/<model>/benchmarks/education-profile-extraction/<evidence-id>.yml`

Evidence records are append-only by ID. Existing evidence must not be silently replaced.

## Stopping

The profile may declare `extraction.status: sufficient-for-current-purpose` only when the caller's intended role/questions are recorded and remaining unknowns do not block the delegation decision.
