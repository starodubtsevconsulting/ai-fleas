# First-class Models in AI-Fleas

Status: **conceptual refactor; no runtime paths move in this branch yet**.

## Why

AI-Fleas already treats **roles** as reusable architecture. Models have grown into another reusable entity, but their
knowledge is currently split between Dev-specific delegation strategies and `notes/models/`.

That is the wrong ownership boundary. A model is not a Dev workflow strategy and it is not merely a note. The same
model may serve a Coder, Reviewer, System agent, Writer, or another future role.

## Core entities

```mermaid
flowchart LR
    W[Workflow] --> R[Role]
    R --> A[Agent]
    A --> M[Model]
    M --> D[Deployment]
    M --> E[Education profile]
    D --> B[Benchmark evidence]
    B --> E
```

- **Workflow** — coordinates work toward an outcome.
- **Role** — defines the job/responsibility.
- **Agent** — an executable worker that fulfills a role on a platform.
- **Model** — the intelligence/learned capability available to an agent.
- **Education profile** — declared education, observed capability, unknowns, communication guidance, and provisional role fit.
- **Deployment** — a concrete model representation + runtime + hardware + context/configuration.
- **Benchmark evidence** — observations of a model/deployment on frozen tasks with independent acceptance.

A role does not own a model. An agent selects/receives a model. A model can serve several roles, and a role can be
fulfilled by different models.

## Target structure

The final location should be a first-class repository namespace, not under a particular workflow:

```
models/
  README.md
  schema/
    model.schema.json
    education.schema.json
  qwen3-coder-next/
    model.yml
    education.yml
    benchmarks/
      gx10/
        ...
  qwen3.5-9b/
    model.yml
    education.yml
    benchmarks/
      rtx-3080-ti/
        ...
```

Shared benchmark **protocols/fixtures** remain reusable infrastructure rather than being copied into every model.

`notes/models/` is an interim knowledge registry created while Stage 1 is still active. A later migration can promote
it to `models/` after consumers are updated.

## Model versus deployment

Do not put deployment facts into education.

Example:

```yaml
model:
  family: Qwen3-Coder-Next

education:
  primary: [software-engineering, agentic-coding]

deployment:
  quantization: Q5_K_M
  runtime: llama.cpp
  hardware: gx10
  context_tokens: 65536
```

Q5, Q8, NVFP4, context size, GPU layers and hardware affect how the model runs. They do not define what the model was
educated to do.

## Delegation

The education profile is primarily an input to the **delegator**, not text to dump into the worker prompt.

Before constructing a handoff:

1. identify the task's required concepts;
2. resolve the target agent and model;
3. load the model education profile;
4. compare required concepts with declared/observed education;
5. speak directly for familiar concepts;
6. use Domain Context Handoff for unfamiliar but teachable concepts;
7. strengthen verification or select another worker where evidence shows a relevant limitation.

The worker receives the resulting handoff, not its entire education résumé.

## Education Profile Extractor

Trello #141 should eventually maintain these model entities:

```
public/model-card evidence
        ↓
draft education profile
        ↓
controlled multi-domain probes
        ↓
benchmark evidence
        ↓
observed education + limits + unknowns
        ↓
delegation guidance
```

Public information is the résumé. Benchmarks are education in action.

## Migration boundary

Do **not** move the active Dev model-profile paths while GX10 Stage 1 / PR #225 depends on them.

After Stage 1 stabilizes:

1. define the first-class model/education schemas;
2. promote `notes/models/` to `models/`;
3. move canonical education evidence out of Dev-specific delegation paths;
4. leave workflow/platform configs as references/consumers of model IDs and deployment IDs;
5. update launchers and validators;
6. verify existing Dev, Writing, System and other workflows resolve models without owning model knowledge;
7. remove obsolete duplicate sources only after consumers are migrated.

## Architectural test

A new workflow should be able to reuse Qwen3-Coder-Next's education profile without importing anything from
`ai-workflows/dev/`.

If that is not true, the model abstraction is still owned by the wrong layer.
