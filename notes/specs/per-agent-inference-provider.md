# Per-agent inference provider selection

## Goal

Allow each logical AI Fleas agent to select both **where inference runs** and **which model runs there**, while preserving simple inherited defaults.

This enables hybrid teams. For example, a Manager may use OpenAI while a Coder uses a locally hosted model through Hermes.

## Terminology

- **Inference provider** — a configured inference endpoint/service through which a model is reached. Examples include OpenAI or a local OpenAI-compatible server.
- **Model** — the concrete or aliased model selected from that provider.
- **Agent platform** — the harness/application that realizes the logical agent, such as GPT App or Hermes. This is separate from the inference provider.

An inference provider is not the same thing as an API protocol. Two providers may both expose an OpenAI-compatible HTTP API while representing different inference services.

## Configuration model

Conceptually an agent resolves:

```yaml
provider: local-gx10
model: qwen3-coder-next
```

Providers are defined independently from agents:

```yaml
inference_providers:
  local-gx10:
    protocol: openai-compatible
    base_url: http://127.0.0.1:1234/v1

  openai:
    protocol: openai
```

Agent/role bindings reference provider IDs rather than repeating endpoint configuration:

```yaml
agents:
  coder:
    provider: local-gx10
    model: qwen3-coder-next

  designer-reviewer:
    provider: openai
    model: gpt-5.6
```

Exact schema placement should follow the existing profile/workflow/platform ownership boundaries rather than introducing duplicate catalogs.

## Resolution

Use inheritance so existing single-provider configurations remain concise:

```text
Profile default provider/model
        ↓
Workflow override
        ↓
Role/agent override
```

The narrowest explicitly configured scope wins. Provider and model resolution must be deterministic and auditable. Missing or unknown provider/model bindings fail closed rather than silently selecting another provider.

A role may override only the provider, only the model, or both when the selected provider supports the resulting model binding.

## Platform behavior

The portable workflow defines logical agents and may express their resolved inference requirements. The selected platform adapter decides whether and how those requirements can be realized.

Hermes is the first target for per-agent inference-provider selection because separate Hermes role agents can be configured against different providers/models.

GPT App does not need to emulate Hermes behavior. If a platform cannot honor a requested per-agent provider binding, its adapter must report the unsupported binding rather than silently ignoring or substituting it.

## Compatibility

Current configurations where all agents use one provider/model remain valid through profile or workflow defaults. No per-agent override is required.

This supports incremental hybrid operation, for example:

```text
Manager             → OpenAI / remote model
Designer/Reviewer   → OpenAI / remote model
Coder               → local-gx10 / local coding model
Command Runner      → inherited/default provider/model
```

## Security and ownership

Provider definitions may reference endpoints and credential scopes, but secrets do not belong in reusable workflow or agent definitions. Credentials remain profile/local configuration and follow existing AI Profile security rules.

Agent definitions reference provider IDs; they do not embed tokens, passwords, private keys, or populated credentials.

## Acceptance

- A profile can define multiple inference providers.
- A default provider/model can be inherited by all agents.
- A workflow or individual role/agent can override the inherited provider and/or model.
- Hermes initialization resolves the effective provider/model independently for each mapped role agent.
- Existing single-provider Hermes configuration continues to work without per-agent overrides.
- Unsupported platform/provider combinations fail explicitly.
- Provider endpoint configuration is not duplicated across agent definitions.
- No secrets are introduced into reusable workflow, role, or platform mapping files.
