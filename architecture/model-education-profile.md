# Model education profile

An education profile answers a different question from model/runtime specifications:

> **What conceptual world does this model inhabit, and how should another agent communicate with it?**

Parameter count, context length, quantization, hardware and runtime describe capacity/deployment. They do not describe what is inside that capacity.

## Lifecycle

An education profile evolves:

1. **draft** — public/model-card information only; a résumé, not demonstrated competence.
2. **provisional** — public information plus first controlled education-extraction probes.
3. **observed** — patterns reproduced across multiple task families.
4. **evolving** — later evidence may strengthen, weaken or contradict previous claims.

Never hide contradictions.

## Human- and agent-readable structure

The canonical YAML should describe:

- **native world** — domains/concepts the model was primarily educated around;
- **conceptual language** — vocabulary/abstractions a delegator can probably use directly;
- **translation boundary** — domains where concepts should be translated before delegation;
- **communication patterns** — forms that have worked or failed;
- **examples** — how unfamiliar reality maps into the model's conceptual vocabulary;
- **observed competence/limits** — what controlled work demonstrates;
- **role fit** — provisional jobs suggested by evidence;
- **evidence/provenance/confidence** — why each important conclusion exists.

The profile is primarily for the **delegator**. Do not dump the entire profile into the worker prompt. Use it to construct the handoff.

## Translation principle

A short human expression can carry large amounts of embodied or domain context.

For example, “there is biological waste on the floor” may imply a physical object, contamination risk, smell, location and likely cleanup action. If those properties matter to a task, translate only the relevant dimensions into concepts the model can operationalize. Do not replace ordinary language with an unnecessary chemistry lecture.

The rule is:

**Translate what matters. Do not dump the world.**

For a coding-oriented model, useful translations often map unfamiliar domains into:

- objects/data;
- state;
- inputs/outputs;
- relationships;
- invariants;
- state transitions;
- positive and misleading examples;
- failure modes;
- code/data boundaries.

## Extraction

Trello #141, Education Profile Extractor, should update these profiles from actual work:

```
public information
      ↓
draft profile
      ↓
controlled probes across task families
      ↓
observations + contradictions
      ↓
profile revision with provenance/confidence
```

A single successful fixture does not establish general education. A failed fixture does not establish global inability.

The extractor should answer not merely “can it solve this benchmark?” but:

- Which conceptual language did it understand?
- Which domain assumptions needed translation?
- Which translation patterns improved first-pass understanding?
- Where did clearer teaching fail to improve implementation?
- Which role/task family appears to fit?
- What remains unknown?
