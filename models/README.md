# Models

Models are first-class AI-Fleas workers' **learned capability**, separate from the role they perform and the deployment that runs them.

This module is intended to be readable by both humans and agents.

## The short version

When AI-Fleas assigns work, these concepts answer different questions:

| Concept | Question |
|---|---|
| **Role** | What job needs to be done? |
| **Agent** | What executable worker is doing it? |
| **Model** | What learned intelligence/education does that worker have? |
| **Expertise profile** | What has the model demonstrated, and how should we talk to it? |
| **Deployment** | How and where is this model running? |
| **Benchmark evidence** | What happened when we actually watched it work? |

A model is not a role. A quantization is not an education. A benchmark score is not a personality.

## Why education matters

Model specifications tell us things such as parameter count, context size and quantization. Those numbers matter, but they do not tell a delegator what kind of conceptual language the model understands.

Think about hiring a person.

Knowing that somebody has a large memory and can read a large stack of documents does not tell you whether they studied software engineering, accounting or biology. Before assigning unfamiliar work, you want to know what they already understand and what needs explanation.

AI-Fleas records the answer in the model's **expertise profile**.

## Expertise profile

Each model used for model-to-model delegation needs an `expertise-profile.yml` before that route can run.

It is both human-readable and agent-readable. It records:

- **native world** — domains and concepts the model appears educated around;
- **conceptual language** — abstractions/vocabulary a delegator can use directly;
- **translation boundary** — concepts that should be explained in familiar terms first;
- **communication patterns** — explanation styles that have helped or failed;
- **observed capability and limits** — evidence from actual work;
- **role fit** — provisional jobs suggested by evidence;
- **unknowns** — things we deliberately do not assume;
- **evidence/provenance/confidence** — why we believe each important claim.

The expertise profile is mainly an input to the **delegator**. The launcher injects its compact `communication`
contract as a backstop; the delegator still adapts the concrete task rather than dumping the entire profile.

## Draft is a résumé

A new model starts with a **draft** profile based on public documentation/model cards.

That is a résumé.

It tells us what the model is supposed to have been educated for. It does not prove what this deployment can actually do.

## Expertise Profile Extraction

The reusable process is defined by the [Expertise Extractor](expertise-extractor/).

The Expertise Extractor is the process that turns initial expectations into evidence-backed knowledge:

```
public information
      ↓
draft expertise-profile.yml
      ↓
controlled work across task families
      ↓
independent verification
      ↓
observations + contradictions
      ↓
revised expertise-profile.yml
```

This is not a one-time benchmark. The profile evolves as we work with the model.

A successful task may strengthen a claim. A failed transfer may weaken it. Contradictions stay visible.

## Domain Context Handoff

Sometimes the worker has enough underlying capability but the task comes from an unfamiliar domain.

Do not dump domain terminology into the prompt.

Translate only the parts that matter into concepts already inside the model's education.

For a coding model, that often means mapping unfamiliar reality into:

**objects/data → state → relationships → inputs/outputs → invariants → positive/misleading examples → failure modes → code/data boundary**

This is **Domain Context Handoff**.

The principle is:

> **Translate the domain. Don't dump the domain.**

Better teaching can unlock capability that is already present. It cannot guarantee capability that is absent.

## Model versus deployment

Keep these separate.

```yaml
model:
  family: Qwen3-Coder-Next

education:
  primary:
    - software-engineering
    - agentic-coding

deployment:
  quantization: Q5_K_M
  runtime: llama.cpp
  hardware: gx10
  context_tokens: 65536
```

Q5, Q8, NVFP4, context length, GPU layers, runtime and hardware affect execution. They do not define what the model learned.

## Benchmarks belong to the model

The target knowledge structure is:

```
models/
  qwen3-coder-next/
    model.yml
    expertise-profile.yml
    benchmarks/
      gx10/
        ...
      another-deployment/
        ...
```

A benchmark is evidence about the model under a particular deployment. Shared fixtures/protocols can remain reusable infrastructure.

## Vocabulary

**Model** — learned intelligence available to an agent.

**Education** — the conceptual knowledge/language the model was trained toward and has demonstrated in work.

**Declared education** — upstream/model-card claims.

**Observed education/capability** — behavior supported by controlled AI-Fleas evidence.

**Unknown education** — concepts we do not assume the model understands.

**Expertise Profile** — structured representation of observed, inferred and unknown capability plus communication guidance.

**Expertise Profile Extraction** — iterative process for discovering/refining that profile through controlled work.

**Conceptual language** — abstractions and vocabulary the model can operationalize without additional teaching.

**Translation boundary** — point where the delegator should translate an unfamiliar domain into the model's conceptual language.

**Domain Context Handoff** — a handoff technique that teaches the smallest relevant unfamiliar domain model before assigning the task.

**Deployment** — concrete model representation, runtime, context/configuration and hardware.

**Benchmark evidence** — independently checked observations produced while the model/deployment performs a frozen task.

**Role fit** — provisional evidence-backed suitability for a kind of job; not a global model ranking.

## Current status

This is now the canonical home of model knowledge. GX10 Stage 1 / PR #225 is closed and merged; its Qwen model evidence has been promoted here.

See:

- [First-class Models architecture](../architecture/models.md)
- [Education Profile design](../architecture/model-education-profile.md)
- [Qwen3-Coder-Next example](../architecture/examples/qwen3-coder-next.education-profile.yml)

Workflow/platform strategy configs reference this registry rather than owning duplicate model education.
