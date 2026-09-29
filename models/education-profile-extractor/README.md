# Education Profile Extractor

The Education Profile Extractor is a reusable AI-Fleas **Agent role and feedback-loop flow** for discovering how a model should be communicated with and delegated to.

It does not try to make every model pass every task. Its goal is to make `models/<model>/education-profile.yml` increasingly accurate until it is sufficient for the intended use.

## Two phases

### 1. Draft from public information

Start from upstream/model-card documentation. Record this as **declared education** and hypotheses about conceptual language.

This is the model's résumé. It is not observed competence.

### 2. Extract from behavior

An extractor agent challenges the draft through controlled work:

```
draft education profile
        ↓
identify important uncertainty
        ↓
select/freeze probe
        ↓
run controlled arms
        ↓
independent acceptance
        ↓
compare evidence
        ↓
confirm / refine / contradict / leave unknown
        ↓
update education-profile.yml
        ↓
next uncertainty OR stop
```

The desired state is **sufficient understanding**, not universal success.

Failure can be a successful profiling result when it establishes that clearer teaching did not solve a task family.

## What Stage 1 taught us

The initial Qwen3-Coder-Next investigation is the reference prototype. It established the reusable mechanics:

- freeze the starter/task/verifier before comparing treatments;
- change one meaningful variable at a time;
- use repeated/interleaved runs when variance matters;
- compare task-only, raw-domain and translated-domain handoffs where communication is the hypothesis;
- use positive and misleading examples to test boundaries;
- independently verify artifacts rather than trusting completion prose or process exit;
- allow a standardized correction when recovery is part of the question;
- transfer a promising pattern to a second task family before generalizing;
- preserve contradictions;
- distinguish communication evidence from implementation/capability evidence;
- classify findings as accepted, fixture-scoped, provisional, rejected, or unanswered;
- stop when the current profiling objective is sufficiently resolved.

See the preserved Qwen evidence under [Qwen3-Coder-Next benchmarks](../qwen3-coder-next/benchmarks/gx10/).

## Extractor agent requirements

The **Extractor Agent is not the model under test**. It is an Agent bound to the reusable [Education Profile Extractor role](../../ai-workflows/_common/roles/education-profile-extractor.md) and follows the [default extraction flow](default-flow.md). It acts as teacher, experiment designer, domain translator and evaluator.

It should operate at a higher abstraction level than the target worker for the capability being profiled. In practical terms, the extractor should be able to understand the human problem independently of the target model and reason about both sides of the translation:

**human/problem domain ↔ general concepts ↔ target model's conceptual language**

Required characteristics:

- understand the real task/domain well enough to know what correctness means before probing the target;
- reason in higher-level abstractions rather than merely imitate the target model's vocabulary;
- distinguish domain knowledge, communication failure, implementation failure, tool/runtime failure and verification failure;
- translate unfamiliar human/domain concepts into several candidate representations without assuming one is correct;
- design probes that discriminate between competing hypotheses;
- create positive, negative and misleading near-match examples;
- interpret independent acceptance evidence and source-level behavior;
- recognize when the target repeats an explanation without operationalizing the invariant;
- preserve uncertainty and contradictions instead of rationalizing failures;
- stop teaching when evidence suggests the limitation is not primarily communicative;
- remain independent from the target model's self-assessment.

The extractor does **not** need to be globally “smarter” than every possible target in every domain. It must be sufficiently more capable for the **profiling objective**: understanding the problem, designing/evaluating the experiment, and reasoning about the target's behavior.

### Domain grounding

For domain-specific profiling, the extractor must have access to authoritative domain context or a knowledgeable human/reviewer. A powerful general model must not invent the definition of correctness for medicine, finance, law, organization-specific business rules, or other unfamiliar domains.

### Separation of duties

Where practical:

- **Extractor/Coordinator** chooses hypotheses and probes.
- **Target model** performs the frozen task.
- **Independent verifier/reviewer** determines acceptance.
- **Extractor** synthesizes the evidence into the profile.

The target model must not grade itself, define its own acceptance criteria, or rewrite the experiment after seeing a failure.

## Outputs

The extractor owns three outputs:

1. `models/<model>/education-profile.yml` — evolving synthesis.
2. `models/<model>/benchmarks/...` — evidence/probe records.
3. extraction report — what changed in the profile and why.

## Profile evolution

Draft claims must not disappear when evidence arrives. Evidence should classify them:

- **confirmed** — controlled evidence supports the draft;
- **refined** — evidence supports a narrower/different formulation;
- **contradicted** — observed behavior conflicts with the draft;
- **inferred-but-unverified** — plausible interpretation requiring another probe;
- **unknown** — deliberately unresolved.

Every material observed claim should point to evidence and preserve its task/deployment scope.

## Probe catalog

The reusable catalog should cover different dimensions rather than one benchmark:

- familiar-domain bounded task;
- unfamiliar task: task-only vs raw-domain vs translated-domain;
- positive vs misleading/near-match examples;
- local invariant / boundary reasoning;
- multi-step state/lifecycle reasoning;
- focused source-to-target transformation;
- tool use and scope compliance where supported;
- standardized correction/recovery;
- transfer of a discovered communication pattern to another task family.

Probe definitions belong under [probes](probes/). They should be reproducible and independently accepted.

## Feedback loop

After each probe, the extractor asks:

1. What did this evidence actually establish?
2. Which draft/profile claim changed?
3. Is the result task-specific or transferable?
4. What important uncertainty remains?
5. Is another probe likely to resolve it?
6. Are we sufficiently informed for the intended role?

If yes to the last question, **stop**. Do not benchmark indefinitely.

## Rules

See [rules.yml](rules.yml) for agent-readable rules and [profile-update.yml](templates/profile-update.yml) for the evidence-to-profile update contract.

## Current implementation

The intelligent extractor is the Agent/Role + flow. Its deterministic profile/evidence bookkeeping is implemented as the reusable AI Command [`education-profile-extractor`](../../ai-commands/utility/education-profile-extractor/education-profile-extractor.command.md).

It currently supports:

- `init` — create a public-information draft profile;
- `apply` — append independently evaluated evidence and evolve claim state without erasing contradictions;
- `status` — report claim states, unresolved questions and extraction status.

The next implementation layer is the **probe runner/orchestrator**: choose a probe from this catalog, invoke the configured model/deployment through an adapter, obtain independent acceptance, materialize a profile-update record, and feed it back to the deterministic core. The core intentionally has no Hermes/Qwen dependency.

## Intended interface

The implementation ticket is Trello #141. The eventual reusable operation should feel like:

```
profile-model <model/deployment>
```

or an equivalent workflow/command/API.

The caller should not need to know the history of the Qwen experiment. The extractor owns probe selection, evidence capture, synthesis and profile evolution.
