# Hermes role overlays

Hermes overlays contain only Hermes-specific realization details such as profile naming and model/runtime tuning for a
portable role. Portable lifecycle, scope, human-facing semantics, readiness tokens, ownership, and authority remain in the
portable agent/profile binding and `ai-workflows/_common/roles/`.

Profile-owned provider and model values are referenced rather than copied here. An overlay must not repeat portable values
merely for convenience; it may narrow platform behavior but cannot grant authority absent from its portable role.
