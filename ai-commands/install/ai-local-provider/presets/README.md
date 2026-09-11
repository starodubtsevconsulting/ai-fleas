# AI Local Provider Presets

Presets describe a known local-model configuration and the machine requirements needed to run it.

A preset owns model/runtime defaults and hardware requirements. Machine-specific values such as SSH target, credentials and private overrides remain in profile-owned configuration.

## Selection

```text
install-ai-local-provider.sh --target <user@host> --preset <preset-id>
```

Before installation the command must inspect the target and compare detected hardware/OS with the selected preset.

If minimum requirements are not satisfied, execution stops with `REQUIREMENTS_NOT_MET` and reports each failed requirement. Recommended requirements are advisory and must be shown separately.

## Preset fields

- `id`, `name`
- `model`: source, repository/file, quantization and context
- `runtime`: inference runtime
- `requirements`: OS, architecture, RAM, disk and GPU constraints
- `service`: default local API/service configuration

Presets may contain incomplete values while the command is SNAPSHOT. A preset with unresolved required values must not be treated as runnable.
