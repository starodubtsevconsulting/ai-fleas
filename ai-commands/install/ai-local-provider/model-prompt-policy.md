# Model prompt policies

## Purpose

Model prompt policies are a generic part of loading and serving local models. They are not tied to any model family or
modality. A model mode declares its capabilities, selects a named policy profile, and starts a serving adapter that
applies the compatible policies to every request.

The first image adapter is a proof of this contract. Text and multimodal runtimes use the same policy/profile selection
but translate the selected rules into the parameters supported by their inference APIs.

## Where enforcement happens

A policy is loaded when the managed service starts, but it is **not** inserted into model weights, fine-tuned into the
model, or permanently preloaded as model context. The selected profile remains fixed for that service instance. Model
steering and semantic validation are applied by the serving layer every time inference is requested.

```text
Model service startup
        |
        +-- Load model weights once
        |
        +-- Load and validate selected policy profile once
                         |
                         v
Inference request -> semantic input decision -> model inference -> semantic output decision -> response
                         |                                      |
                         +-- deny/uncertain/error: reject        +-- deny/uncertain/error: discard

Before inference, the capability adapter may also compose applicable system/positive instructions and compose or lock
negative instructions. Those are model-steering controls, not validation.
```

Placing the hook in the serving layer means browser, API, tunnel, and automated clients use the same path. A public
request cannot select a different profile or disable the profile chosen by trusted model initialization.

## Composition

```text
atomic policies -> named profile -> capability adapter -> effective model request
```

- **Atomic policy:** one reusable rule, such as `content-nudity`, `language-profanity`, or an operator-defined
  `subject-blue-birds` rule.
- **Policy profile:** an ordered collection of atomic policy IDs. For example, `education-child` may combine several
  content and language policies. The profile name is a convenient deployment choice, not special runtime logic.
- **Capability adapter:** maps an applicable atomic policy into the prompt fields supported by text, image, or
  multimodal inference.
- **Model mode:** declares capabilities and chooses the profile. Policy code must not branch on a model name.

```text
                         +-> text adapter  -> system/instruction prompt
profile -> atomic rules -+-> image adapter -> positive + negative prompt
                         +-> semantic input decision
                         +-> semantic output decision
```

An atomic policy may support one or several capabilities. A multimodal mode applies every compatible adapter. A required
policy capability that the runtime cannot enforce must fail during startup instead of being silently ignored.

## Request example

Given a user prompt:

```text
A student building a robot
```

an image adapter may construct an effective request similar to:

```text
[policy prefix]
Create an age-appropriate image suitable for a supervised educational setting.

[user prompt]
A student building a robot

[policy suffix]
Keep every person fully clothed in ordinary non-revealing clothing.

[policy-owned negative prompt]
nudity, sexualization, revealing clothing, intimate body exposure
```

The original request is sent to the selected semantic evaluator before the composed effective request can reach the
model. Only `allow` proceeds. `deny`, `uncertain`, malformed output, timeout, or evaluator unavailability returns a
neutral refusal without allocating an image-generation job. Generated candidates remain private until semantic output
evaluation also returns `allow`.

## Selection contract

The generic model-loading command should support three explicit states:

1. Named profile: `--policy education-child`.
2. Unrestricted: `--policy unrestricted --acknowledge-unrestricted`.
3. Missing selection.

For interactive startup, a missing selection lists compatible profiles and asks the operator to choose. Selecting
`unrestricted` requires acknowledgement. For non-interactive startup, a missing selection fails immediately with
`MODEL_POLICY_REQUIRED`; automation must never wait for a prompt. Trusted profile configuration may persist the policy
and unrestricted acknowledgement for unattended startup.

The model lifecycle command owns selection. The serving adapter owns enforcement. A health response should expose the
active profile ID so operators and acceptance tests can verify the effective configuration.

## Security boundary and limitations

Prompt policy steers the model with policy-owned instructions but is not validation and cannot guarantee the content of
generated output. Restricted profiles require fail-closed AI semantic input validation. Capability-specific output
moderation provides the hold-before-release boundary for generated content.

Policy configuration is trusted operational configuration. It must not be accepted from public inference requests.

## Layered semantic enforcement

The same selected profile supplies model steering and the semantic intent enforced by input and output gates. A
protected deployment uses a separately configured policy-decision service. Atomic policies provide the intent used by
every gate; semantic enforcement does not create a second policy selection. Mechanical keyword or regular-expression
validation is not part of this architecture.

```text
selected profile -> atomic policy intent
                         |
                         +-> semantic input decision
                         +-> capability-specific output decision
```

The decision service is an enforcement dependency, not a public assistant. It can be implemented by a reasoning model,
classifier, provider API, or ensemble behind the same strict decision contract. Public clients cannot modify its
instructions, thresholds, endpoint, or selected policy. When a semantic layer is enabled, missing configuration,
timeouts, malformed or uncertain decisions, and unavailable enforcement fail closed.

Candidate outputs remain private until all enabled output gates allow release. An image adapter therefore moderates the
in-memory candidate before writing a public output file or returning encoded bytes. Text and multimodal adapters must
provide the equivalent hold-before-release boundary.
