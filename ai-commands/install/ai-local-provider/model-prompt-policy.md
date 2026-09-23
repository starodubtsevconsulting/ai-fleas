# Model prompt policies

## Purpose

Model prompt policies are a generic part of loading and serving local models. They are not tied to any model family or
modality. A model mode declares its capabilities, selects a named policy profile, and starts a serving adapter that
applies the compatible policies to every request.

The first image adapter is a proof of this contract. Text and multimodal runtimes use the same policy/profile selection
but translate the selected rules into the parameters supported by their inference APIs.

## Where enforcement happens

A policy is loaded when the managed service starts, but it is **not** inserted into model weights, fine-tuned into the
model, or permanently preloaded as model context. The selected profile remains fixed for that service instance. Its
instructions and request rules are applied by a hook in the serving layer every time inference is requested.

```text
Model service startup
        |
        +-- Load model weights once
        |
        +-- Load and validate selected policy profile once
                         |
                         v
Inference request -> request-time policy hook -> model inference -> response
                         |
                         +-- reject matching request text before inference
                         +-- compose applicable system/positive instructions
                         +-- compose or lock applicable negative instructions
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
                         +-> input hook    -> allow or reject before inference
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

If a deny rule matches the original request, the adapter returns a neutral refusal before it allocates an inference job.
Otherwise, only the composed effective request reaches the model.

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

Prompt policy is a low-cost first enforcement layer. It can reject explicit request text and steer the model with
policy-owned instructions, but it cannot guarantee the content of generated output. It does not inspect generated image
pixels or classify generated text. Deployments requiring a stronger guarantee can add output moderation as a separate
layer without changing this prompt-policy composition contract.

Policy configuration is trusted operational configuration. It must not be accepted from public inference requests.
