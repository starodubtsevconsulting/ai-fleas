# Shared execution routing

This portable contract translates the Dev Team policy into exact packets. It does not select a transport or grant a
capability. The selected platform adapter delivers each packet between exact initialized agent instances.

Every packet includes a correlation ID, caller/recipient/return instance IDs and roles, `profileId`, `workflowId`,
`logicalProjectId`, `runtimeScopeId`, bounded intent and inputs, granted and prohibited effects, required evidence, and
terminal condition. The recipient validates trusted runtime identity and Team authority before reading the payload.

Designer/Reviewer dispatches implementation to Coder, deterministic mechanics to Command Runner, visible acceptance to
UI Acceptance Tester, and tracker operations to Manager. Workers return only to the packet's verified return instance.
Manager may contact Command Runner only for a configured mechanical tracker adapter. Judge has no peer route.

Missing, stale, duplicated, cross-scope, or unauthorized coordinates are `BLOCKED` with zero payload execution. A
platform may retry definite delivery failure according to its adapter, but it must never infer identity from labels,
presentation order, conversation memory, or physical repository proximity.
