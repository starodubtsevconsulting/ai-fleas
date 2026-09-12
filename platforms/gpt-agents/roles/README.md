# GPT role overlays

Role overlays contain only GPT/Codex-specific realization details such as task title, model, reasoning, GPT visibility,
project/task ID binding, messaging calls, and archival behavior. Portable lifecycle, scope, human-facing semantics,
readiness tokens, ownership, prohibitions, decisions, and required evidence remain in the portable agent/profile binding
and `ai-workflows/_common/roles/`.

An overlay must not repeat portable values merely for convenience. It may narrow or realize platform behavior but cannot
grant authority absent from its portable role. Missing or conflicting overlays fail closed.
