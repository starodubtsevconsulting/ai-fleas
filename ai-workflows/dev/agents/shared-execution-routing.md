# Shared execution routing

This portable contract translates the Dev Team policy into exact packets. It does not select a transport or grant a
capability. The selected platform adapter delivers each packet between exact initialized agent instances.

Every packet includes a correlation ID, caller/recipient/return instance IDs and roles, `profileId`, `workflowId`,
`logicalProjectId`, `runtimeScopeId`, bounded intent and inputs, granted and prohibited effects, required evidence, and
terminal condition. The recipient validates trusted runtime identity and Team authority before reading the payload.

Designer/Reviewer dispatches implementation to Coder, deterministic mechanics to Command Runner, visible acceptance to
UI Acceptance Tester, and tracker operations to Manager. Workers return only to the packet's verified return instance.
Manager may contact Command Runner only for a configured mechanical tracker adapter. Judge has no peer route.

The matrix's `manager_to_command_runner` route carries only that registered tracker mechanic; its
`command_runner_to_manager` route is return-only for the exact requesting Manager. Neither grants Manager a general
command-dispatch capability or Command Runner ticket ownership.

## Ticket lookup packets

Designer/Reviewer automatically requests Manager discovery when the human describes an existing ticket without its key.
Use the same route for an explicit "ask Manager" correction. Before sending, resolve the caller, Manager, and return
identities from trusted active bindings and check all four workflow coordinates. The return identity is the requesting
Designer/Reviewer. Unknown lookup facts are permitted; unknown authority or identity is not.

The following is a construction template, not runtime identity or operational configuration. Replace every coordinate
and identity placeholder from trusted initialized state. Fill work-target values only from the authorized request and
profile project record. A ticket key is optional for this read-only assignment.

```yaml
correlationId: <stable lookup correlation>
callerInstanceId: <exact requesting instance>
callerRole: designer-reviewer
targetInstanceId: <exact Manager instance>
requiredExecutionRole: manager
returnInstanceId: <exact requesting instance>
returnRole: designer-reviewer
profileId: <initialized profile>
workflowId: <initialized workflow>
logicalProjectId: <complete initialized logical project>
runtimeScopeId: <initialized runtime scope>
intent: Discover and read the existing ticket described by the human.
inputs:
  projectId: <authorized work-target project>
  repository: <authorized repository>
  workspacePath: <authorized workspace>
  originalRequest: <human's full current request>
  requestedOutcome: <desired work or behavior>
  knownFacts: <supplied component, machine, environment, and other identifiers>
  unknownFacts: <missing lookup facts; ticket key may be unknown>
authority:
  allowedEffects: [tracker-search, tracker-inventory, tracker-read]
  prohibitedEffects: [tracker-mutation, machine-mutation, source-mutation]
requiredEvidence: Exact ticket read and match reasons, or candidates/coverage/blocker and one precise missing fact.
terminalCondition: Return one evidenced lookup disposition to the exact requesting instance.
```

Manager preserves this correlation and the lookup's ticket/work target in candidate, clarification, and terminal responses.
The reply's transport recipient changes to the verified return instance as specified below. Designer/Reviewer
relays any necessary question to the human and supplies the answer as a same-scope correction. A rejected packet is
corrected by its sender from trusted state; the recipient never reconstructs a missing authority header.

### Constructing a lookup reply

Build a new outgoing header from trusted active receipts; do not copy the incoming header wholesale. For a Manager reply:

| Outgoing field | Required value |
| --- | --- |
| `correlationId` | Original accepted lookup correlation. |
| `callerInstanceId`, `callerRole` | This exact initialized Manager instance and `manager`. |
| `targetInstanceId`, `requiredExecutionRole` | The accepted request's verified `returnInstanceId` and `returnRole`. |
| `returnInstanceId`, `returnRole` | The accepted request's verified return route, unchanged. |
| Four workflow coordinates | Original accepted coordinates, identical to all three trusted receipts. |
| Work target, authority, evidence requirements | Original bounded assignment; a correction may narrow effects. |

For the usual return to Designer/Reviewer, `requiredExecutionRole` is `designer-reviewer`. It describes the current
recipient, not the role that performed the lookup. If `targetRole` is also present, it must equal `requiredExecutionRole`.
The messaging tool's destination must equal `targetInstanceId`. Compare every outgoing ID/role pair against its trusted
receipt immediately before sending, including a same-scope correction. A failed comparison blocks the send; a successful
app receipt cannot repair an invalid header. Keep original requester/executor provenance in separate result fields when
needed, without replacing the outgoing caller or recipient.

Evidence capture times must come from an observed clock or provider receipt. Use `capturedAt: null` with an explicit
unavailable reason if the capture time was not recorded. A correction's current time may be `responseCreatedAt`; it must
not be presented as the time of earlier tracker reads. Never fabricate a timestamp or fill a placeholder with guessed
fractional seconds. Header correction preserves the original requirements, searched scope, evidence, and unknowns.

For a configured provider mechanic, Manager constructs a separate complete child packet to one exact available Command
Runner, with Manager as caller and return coordinator. Use a unique child correlation and retain the parent lookup
correlation as a reference. Include the validated provider
execution binding, registered operation and exact argument vector, expected receipt, and the same read-only effect
limits. The provider contract determines valid arguments; a descriptive lookup does not become an exact-summary search
unless that summary is known. Command Runner returns mechanical evidence to Manager, who interprets it and returns the
lookup result to Designer/Reviewer. Use the common delivery contract for acknowledgement and terminal observation.

Missing, stale, duplicated, cross-scope, or unauthorized coordinates are `BLOCKED` with zero payload execution. A
platform may retry definite delivery failure according to its adapter, but it must never infer identity from labels,
presentation order, conversation memory, or physical repository proximity.
