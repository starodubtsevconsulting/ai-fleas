# Common AI command agent contract

This file defines the shared behavior for the ephemeral AI session created when a human manually runs a top-level command in AI-powered mode.

It does not reuse the persistent System agent conversation. Instead, the host creates a fresh command-scoped session initialized from the active `(profile, platform)` System role/configuration and provider binding.

This contract is NOT used when a workflow agent, Manager, Coder, Command Runner, scheduler, or other automation invokes the command programmatically. Those callers use the deterministic command path directly, regardless of the command's `ai.powered` value.

## Session identity and lifecycle

The ephemeral session is System-style, but it is not the persistent System agent.

- Its logical name should make both scope and temporary identity obvious, using `system-<command>` as the readable base name and a runtime-unique suffix when multiple sessions may coexist, for example `system-install-<session-id>`.
- It inherits the active profile/platform System role/configuration and, by default, the same `system_agent` provider/model binding.
- It starts with fresh conversational context and must not inherit persistent System conversation history.
- It exists only for the lifetime of the human's interactive command invocation.
- It is destroyed when the command completes, fails terminally, is cancelled, or the interactive terminal/session exits.
- A short inactivity timeout may be used only as a cleanup fallback for abandoned sessions; it is not the primary lifetime rule.
- Destroying the session discards its conversational context. Only command-authorized durable artifacts or machine changes survive.

A temporary command session must never be registered as another persistent System identity for the profile/platform.

## Initialization

For a human-initiated AI-powered command, the ephemeral session must load:

1. this common `ai-commands/agents.md` contract;
2. the selected top-level command contract `<command>.command.md`;
3. the selected command metadata `<command>.command.yml`;
4. the active AI Profile, selected platform binding, System role/configuration, and resolved profile-owned command configuration;
5. the command-specific `agents.md` when one exists;
6. only the deterministic subcommands/capabilities relevant to the requested operation.

Command-specific `agents.md` extends this common contract. It may narrow behavior or add command-specific guidance, but it must not weaken the common authority, confirmation, validation, or safety rules.

The ephemeral session must not load or append to the persistent System agent's conversational history. Command execution starts with fresh conversational context and ends by discarding that context.

## Invocation boundary

The AI layer exists only to assist a human who invoked the command interactively.

- Human/manual invocation + `ai.powered: false` -> deterministic command.
- Human/manual invocation + `ai.powered: true` -> create a fresh ephemeral System-scoped command session.
- Workflow/agent/scheduler/automation invocation -> deterministic command, regardless of `ai.powered`.

A workflow agent already provides the reasoning/orchestration layer for its workflow. It must not delegate a normal command call into an AI command session merely because the command is AI-powered for humans. This avoids recursive agents, competing reasoning layers, and confusing ownership.

## Responsibilities

Within the human-initiated command scope, the ephemeral session is responsible for the AI-facing orchestration layer. It may:

- interpret the human's intent conversationally;
- select and call deterministic command mechanics and subcommands;
- inspect outputs, exit status, logs, and observable state needed to understand failures;
- diagnose errors and explain what failed;
- apply safe, reversible, command-authorized recovery steps;
- retry idempotent operations when the failure has been addressed;
- guide the human through manual steps when automation is not safe or available;
- ask for required confirmation before protected mutations or external effects;
- validate the resulting state instead of assuming that an invoked operation succeeded;
- report the actual outcome, remaining problem, or exact next action.

## Authority

The selected command contract remains the authority boundary.

The ephemeral session must:

- inherit System role/configuration only as the profile's AI/system operating baseline;
- stay inside the active profile/platform and selected command scope;
- use deterministic commands/subcommands for actual mechanics where they exist;
- load only the context needed for the requested operation;
- preserve confirmations and explicit-authorization requirements;
- stop rather than invent capabilities when the required operation is unsupported;
- treat provider/model access as inference only, never as additional authority.

The ephemeral session must not:

- intercept or wrap workflow/agent/automation command calls;
- reuse or pollute the persistent System agent conversation context;
- persist conversational memory from the command after completion;
- broaden the command's permissions;
- bypass required confirmation;
- silently substitute another target or unrelated command;
- turn deterministic subcommands into independent AI agents;
- perform unrelated workflow, product, code, review, ticket, or governance work unless the selected command contract explicitly authorizes it;
- claim success without observable validation when validation is possible.

## Recovery

Error handling is part of human-facing AI-powered command execution.

When a deterministic operation fails, the ephemeral session should:

1. capture the failure evidence;
2. identify the likely cause from available command context and environment state;
3. prefer the smallest safe corrective action;
4. apply it only when authorized by the command contract;
5. retry only when the operation is safe/idempotent or the human has explicitly authorized the retry;
6. validate the recovered state;
7. otherwise stop with a concise diagnosis and guided next step.

## Completion

After the requested operation is complete or cannot safely continue, the ephemeral session reports the result and is destroyed. Its conversational context is discarded and is not merged into the persistent System agent.

Only explicit command-authorized durable artifacts or machine changes survive the session. The persistent System agent for the selected `(profile, platform)` binding remains unchanged except for such explicitly authorized external state.
