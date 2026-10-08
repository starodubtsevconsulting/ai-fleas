# Model-aware Hermes initialization

Hermes agent initialization should adapt automatically to the model selected for each role.

## Resolution

For each initialized role:

1. resolve the profile/workflow role and its selected provider/model;
2. resolve that model to the canonical `models/<model>/` entity;
3. load `expertise-profile.yml` when present and applicable to the selected provider model;
4. compile only operational guidance relevant to initialization;
5. append the compiled guidance after role/workflow instructions, without replacing policy or expanding authority.

The compiled block may include:
- direct communication language;
- concepts that should be translated first;
- handoff rule;
- debugging mitigation;
- independent verification rule;
- recurring observed limitations;
- conditional role fit;
- unknowns that must not be assumed.

Do not inject benchmark dumps, raw YAML, or unsupported inferences.

## Failure behavior

A configured expertise profile with invalid schema/model applicability is an initialization error. A model with no expertise profile remains usable: initialization should state that no model-specific evidence is available and continue with role/workflow rules.

## Direct Hermes use

The generated Hermes profile instructions are the source for direct use too. A human opening the Coder directly should receive the same model-specific operating guidance as a delegated Coder.

## Refresh

`initialize` / `reconcile` recompiles guidance from current canonical model metadata. Updating an Expertise Profile therefore changes future initialized/reconciled agents without hard-coding Qwen-specific behavior in the Hermes command.
