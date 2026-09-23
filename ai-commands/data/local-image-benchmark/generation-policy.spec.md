# Model prompt policies and profiles

The generic architecture and lifecycle contract live with the model-loading command in
[`../../install/ai-local-provider/model-prompt-policy.md`](../../install/ai-local-provider/model-prompt-policy.md). This
document specifies the current image-generation adapter and its migration path only.

## Decision

Prompt policy is a reusable runtime concern owned by the model-serving command. Model lifecycle
remains owned by `install-ai-local-provider`: a model mode selects and starts an exact service, while that service's
profile-owned environment selects `IMAGE_POLICY_PRESET`.

This keeps model identity, process lifecycle, and generation policy separate:

1. `model_modes` selects the installed service and enforces single-model ownership.
2. The service environment selects a named policy profile when the model initializes.
3. The runtime resolves the profile into reusable atomic policies and validates them before becoming healthy.
4. Every API route uses the same prepared prompt and enforcement path.

`unrestricted` is the default and preserves existing behavior. A missing non-default preset is a startup error.

## Composition model

A policy is one atomic, reusable restriction such as `content-nudity`, `language-profanity`, or an operator-defined
rule such as `subject-blue-birds`. A profile is an ordered collection of policy IDs. `education-child` is therefore a
profile, not a special model mode and not a hard-coded safety branch.

```text
atomic policies -> named profile -> capability adapter -> model request
```

Each atomic policy declares the capabilities it affects. Capability adapters translate its generic intent into the
parameters supported by a runtime:

- text: system/instruction prompt plus request-text rules;
- image: positive prompt additions, negative prompt additions, and request-text rules;
- multimodal: the union of applicable capability adapters.

Profiles and policies must never branch on a model name. A model mode declares capabilities; the same profile can then
be used by every compatible model. Unsupported required capabilities fail at startup rather than being silently
ignored.

Version 2 profile JSON files live in `runtime/policies/` and contain `policy_ids`. Atomic policy files live in
`runtime/policy-rules/`. The current image adapter supports:

- `prompt.prefix` and `prompt.suffix`: reusable instructions composed around the user prompt;
- `prompt.negative_prompt`: policy-owned negative-prompt content;
- `prompt.allow_client_negative_prompt`: whether a caller may append its own negative prompt;
- `enforcement.input.deny_rules`: named, case-insensitive regular expressions evaluated before inference;
- `enforcement.input.refusal`: neutral response text for a rejected request;
- `enforcement.input.refusal`: the neutral response returned when request text is rejected.

Schema version 1 monolithic presets remain readable during migration. The public request schema does not accept a
policy ID. Callers therefore cannot downgrade the initialized service.
Changing a policy requires changing the trusted service environment and restarting the managed mode.

## Scope boundary

The preset operates only on text available before inference: the user's request, the effective positive prompt, the
negative prompt, and—for text models—the system/instruction prompt. It does not inspect generated image pixels or add an
image-recognition dependency. Prompt templates and request-text rules provide useful steering and an operator-selected
restriction layer, but they are not a guarantee that a model can never produce unsuitable output.

## Selection and automation

Policy selection has three distinct states and must not collapse “missing” into “unrestricted” for newly managed
configurations:

1. A named protected policy, for example `--policy education-child`.
2. An explicit unrestricted choice, for example `--policy unrestricted --acknowledge-unrestricted`.
3. No choice supplied.

When no choice is supplied on an interactive terminal, the model-start command lists the policies compatible with the
mode's declared capabilities and asks the operator to choose. Selecting `unrestricted` requires an acknowledgement that
the runtime will not apply content restrictions. When standard input is not an interactive terminal, omission fails
immediately with `MODEL_POLICY_REQUIRED`; it must never wait for input or silently select a policy.

Automation remains non-blocking by supplying the policy explicitly in the trusted model-mode configuration or command
arguments. An unrestricted automated mode must also persist the explicit acknowledgement in trusted configuration, for
example:

```yaml
policy:
  id: unrestricted
  acknowledge_unrestricted: true
```

A protected named policy needs no unrestricted acknowledgement. Public inference requests cannot supply these fields.
Legacy services retain their current behavior during migration, but validation should report their policy as implicit
legacy configuration until the profile records an explicit choice.

## Current adapter proof

The Qwen image deployment proves the image capability adapter only. The shared composition contract is intended for
all model runtimes; text and multimodal adapters remain separate acceptance work. Prompt filtering reduces accidental
or direct misuse but is not a substitute for output moderation where a deployment requires a stronger guarantee.
