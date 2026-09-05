# GPT role overlays

Role overlays contain only GPT/Codex-specific realization details: task title, model, reasoning, visibility, project/task
ID binding, messaging calls, and archival behavior. Portable ownership, prohibitions, decisions, and required evidence
remain in `ai-workflows/_common/roles/`.

An overlay cannot grant authority absent from its portable role. Missing or conflicting overlays fail closed.
