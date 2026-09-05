# GPT/Codex App adapter

This built-in adapter maps logical AI Fleas agents to user-visible Codex tasks. It owns Codex-specific task creation,
project binding, exact task-ID receipts, task messaging, model and reasoning selection, and recoverable archival.

It consumes portable workflow and role contracts from `ai-workflows/`. GPT-specific mechanics and role overlays stay here
and may narrow, but never broaden, those contracts.
