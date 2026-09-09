# GPT/Codex App adapter

This built-in adapter maps logical AI Fleas agents to user-visible Codex tasks. It owns Codex-specific task creation,
project binding, exact task-ID receipts, task messaging, model and reasoning selection, and recoverable archival.
It also maps the portable read-only `check-update` lifecycle verb to the host application's trusted stable update channel
when that capability is exposed.

It consumes portable workflow and role contracts from `ai-workflows/`. GPT-specific mechanics and role overlays stay here
and may narrow, but never broaden, those contracts.

The portable vocabulary maps as follows:

| Portable concept | GPT/Codex App realization |
| --- | --- |
| logical agent | configured workflow role binding |
| agent instance | user-visible Codex task |
| instance ID | app-returned task/thread ID |
| logical work scope | complete set of project records registered by the selected profile workflow |
| primary project | first workflow project; hosts rules, commands, workflow definitions, and the Codex saved-project agents |
| associated projects | all later workflow project entries; remain in the group's logical work scope |
| missing saved Codex Project | stop before task mutation; the exact folder-backed Project is a GPT-platform prerequisite |
| logical project / group | one exact folder-backed Codex saved project containing its agent tasks |
| project | one profile-registered folder in that saved project's ordered scope |
| activate | create and initialize a task |
| deactivate | recoverably archive the exact task ID |
| send/receive | exact task-ID message delivery |
| check update | trusted host update-channel query; no automatic installation |
| delete workflow / delete group | recoverably archive its exact bound tasks; preserve the saved Codex project and scoped folders |

The host persists all immutable IDs in the activated profile's configured `gpt-agents-binding-state.v1` registry. The
caller acts only as a mechanical initialization controller: after resolving and verifying the pre-existing project it creates every
missing roster task directly, including the temporary Admin compatibility role, and initializes them concurrently.
