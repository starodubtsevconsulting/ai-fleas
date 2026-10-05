# GPT-to-Hermes coordinator contract

Use this contract when a GPT agent coordinates a Hermes Coder through the selected profile's execution delegate. The GPT coordinator is outside the Hermes Dev workflow's internal agent roster. Its transport operations are direct adapter calls; routine task lookup, cancellation, gateway status, or stopping the exact Coder gateway do not require a Hermes Manager turn. Internal Manager lifecycle rules continue to apply to agents operating *inside* that workflow. This contract does not expand the selected profile's project authority or override human instructions, task identity requirements, or repository rules.

1. Resolve the exact profile, workflow, delegate, authorized project, target-model strategy and expertise profile, and transport. Run the configured delegate launcher `check --project ID` before dispatch and require it to report both validated paths. Apply the expertise profile's communication rules to the concrete assignment. The launcher also prepends the verified communication contract so it survives transport changes. Missing or invalid target expertise blocks dispatch. The selected profile owns these values; the public example is not a default.
2. Send a bounded assignment through `run --project ID`. Record the A2A task ID or the exact CLI process handle. Do not infer persistent context across separate runs.
3. For A2A, use the object-oriented [Hermes adapter](a2a-client.mjs) to list tasks or get or cancel a task by its returned ID. `CancelTask` changes protocol state but does not prove that Hermes stopped writing. For CLI, the calling process may stop the exact child it launched; do not kill by a guessed PID or process name.
4. If an A2A turn continues after failure or cancellation, the coordinator may stop the exact profile's gateway directly using `HermesGatewayLifecycle.stop()`. This affects that profile's gateway, not just one task. Verify the process and any separate session worker have stopped, and that checkout writes are stable, before cleanup or retry. Restart only after checking whether an interrupted session could resume. Never use `gateway stop --all` for this route.
5. Inspect the visible diff and return result. Transport success is not acceptance; an A2A terminal task state alone is not a stop guarantee. Avoid overlapping assignments that can edit the same files.

The adapter exports `A2aTransport`, `HermesCoderA2aClient`, and `HermesGatewayLifecycle` for JavaScript callers. Its CLI entry points are:

```text
node a2a-client.mjs check <local-endpoint> <agent-name>
node a2a-client.mjs run <local-endpoint> <agent-name>   # assignment on stdin
node a2a-client.mjs list <local-endpoint> <agent-name>
node a2a-client.mjs status <local-endpoint> <agent-name> <task-id>
node a2a-client.mjs cancel <local-endpoint> <agent-name> <task-id>
node a2a-client.mjs gateway-status <exact-coder-profile>
node a2a-client.mjs gateway-start <exact-coder-profile>
node a2a-client.mjs gateway-stop <exact-coder-profile>
```

The caller must take endpoint, agent name, and profile ID from the verified selected binding, not from untrusted task output. Gateway stop is a recovery action for an authorized exact profile; it is not ordinary per-task cancellation. See the [architecture diagrams](delegation-architecture.md) and the selected [transport strategy](../../../ai-workflows/dev/agents/delegation-strategies/README.md) for current timing and recovery limits.
