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

## Phase 2 semantic moderation

Phase 2 adds optional semantic gates around inference while retaining the deterministic Phase 1 gate as the cheapest
first check. Both phases consume the same selected profile and its ordered atomic policies. Operators select a policy
once; they do not maintain separate Phase 1 and Phase 2 policy choices.

```text
public request
     |
     v
Phase 1 deterministic gate -- deny --> neutral refusal (no inference)
     |
    allow
     v
Phase 2 semantic input gate -- deny/error/uncertain --> neutral refusal (no inference)
     |
    allow
     v
model inference -> private candidate -> Phase 2 output gate
                                      | deny/error/uncertain
                                      +--------------------> discard; never publish
                                      |
                                     allow
                                      v
                               encode/save/respond
```

The serving adapter calls a separately configured policy-decision service over a versioned JSON contract. The
decision service may use a local reasoning model, classifier, remote moderation provider, or a conservative ensemble;
the image runtime does not branch on that implementation or on the generated model's name. Hermes or another public
client may call the protected image service, but is never the enforcement boundary.

Semantic gates are enabled with trusted service configuration, not request fields. Enabling either semantic gate for a
protected profile requires a decision-service URL. Startup fails when required configuration is missing. At request
time, timeout, transport failure, malformed JSON, a mismatched request ID, `uncertain`, or an unknown decision all fail
closed. Explicit `unrestricted` operation bypasses policy gates only when selected at trusted model initialization.

The decision request includes the selected profile ID, atomic policy IDs, stage (`input` or `output`), capability, a
unique request ID, and stage content. Input content is the original user text. Image output content is the private PNG
candidate encoded in memory; it is not written to the public output directory before an allow decision. A valid
decision contains the matching request ID, `allow` or `deny`, and an operator-facing reason code. Public refusals remain
neutral; logs and response headers may carry bounded reason codes but must not log prohibited prompt or image content.

The runtime emits one structured `policy_moderation_decision` event containing only request ID, profile ID, stage,
decision, bounded reason code, and latency. It never logs submitted text or candidate bytes. The protected service
accepts exactly `allow` or `deny`; an evaluator's `uncertain` result is deliberately treated as unavailable enforcement.

Example decision response (the request ID must echo the request exactly):

```json
{
  "request_id": "e1f7c02a5f7d4a92b6e936148b53d09a",
  "decision": "deny",
  "reason_code": "semantic_nudity"
}
```

`reason_code` is limited to lowercase letters, numbers, dots, underscores, and hyphens, with a maximum length of 64.
The decision endpoint should be network-restricted and authenticated through a mounted token file when it is not
strictly loopback/private. The adapter sends the token as a bearer credential and never includes it in health output.

Phase 2 does not claim perfect moderation. Its assurance depends on the configured decision service and policy tests.
Deployment evidence must record evaluator identity/version, bypass corpus, benign false-positive checks, latency, and
failure-mode results. Output retention is zero for rejected candidates in this adapter because candidates remain
in-memory and are released without publication.

### Architecture decision and trade-offs

| Option | Accuracy and coverage | Runtime cost | Privacy and availability | Decision |
|---|---|---|---|---|
| Generated-model instructions alone | Varies by model; image generators may not provide a reliable reasoning/refusal boundary | Low | Local, but prompt injection and model variance make it unsuitable as the enforcement boundary | May complement enforcement, never sufficient alone |
| Classifier embedded in each model service | Good for the classifier's fixed taxonomy | Competes for memory and duplicates lifecycle code across text/image runtimes | Local and offline; an embedded failure can affect the generator | Supported behind the generic decision contract, not embedded here |
| Local decision service | Can use a reasoning model, classifier, or ensemble and evaluate multilingual/obfuscated intent | Adds one input call and, when enabled, one output call | Keeps content local; availability must be managed independently | Preferred for private deployments when hardware permits |
| Remote decision service | Can use a stronger managed moderation/reasoning model | Network latency and possible usage cost | Content leaves the host; depends on provider/network and requires an explicit privacy decision | Supported but not selected implicitly |

The adapter therefore standardizes the decision boundary rather than hard-coding an evaluator. This keeps policy
selection model-agnostic and permits local or remote evaluation without exposing a raw generation path. A deployment
is not Phase 2-protected merely because this adapter exists: both desired gate flags, an authenticated/restricted
decision endpoint, evaluator identity, and acceptance evidence must be present.

## Phase 2 operations

- `IMAGE_POLICY_SEMANTIC_INPUT=true` enables semantic input decisions after Phase 1 and before inference.
- `IMAGE_POLICY_SEMANTIC_OUTPUT=true` enables image decisions before encoding, saving, or returning a candidate.
- `IMAGE_POLICY_MODERATION_URL` selects the trusted decision endpoint.
- `IMAGE_POLICY_MODERATION_TIMEOUT_SECONDS` bounds each decision call.
- `IMAGE_POLICY_MODERATION_AUTH_TOKEN_FILE` optionally points to a mounted token file; secrets are never accepted in
  public request payloads or committed configuration.

Recovery is to restore the decision service and restart the managed model service. Protected modes remain unavailable
rather than silently bypassing enabled gates. Rollback disables the Phase 2 gate flags in trusted service configuration
and restarts the service, leaving Phase 1 deterministic enforcement active. Switching to `unrestricted` is a separate,
explicitly acknowledged deployment decision and is not a recovery mechanism.

Implementation and validation evidence is recorded in [`phase2-validation.md`](phase2-validation.md). Contract tests
and a loopback decision-service integration prove enforcement ordering and fail-closed behavior; semantic production
acceptance remains evaluator-specific and cannot be inferred from adapter conformance.
