# Writing manual handoff

The human chooses which initialized Writing agent to address next. There is no ordinary agent-to-agent route in this
roster. An agent finishing its owned step reports the exact archived revision, destination-draft URL and status,
evidence, unresolved findings, and the next suggested role to the human. It does not send a peer message, impersonate
the next role, or claim the next gate has passed.

The human may then address the next verified agent in the same `profileId`, `workflowId`, `logicalProjectId`, and
`runtimeScopeId`, pointing it to that exact archive record. The receiving agent independently verifies those
coordinates, artifact revision, and its own capability before acting. A title or copied report is not identity proof.

Writer suggests Reviewer after preparing a clean copy. Reviewer reports findings to the human and suggests Writer for
revisions; after the human accepts the exact final revision, Writer or Reviewer may suggest Release Coordinator.
Release Coordinator proposes a day only after review and history checks and hands the decision to the human. The human
alone publishes or schedules. `show-context` is a human-facing presentation command, never a peer transport.

Admin and Judge retain their common human-facing administration and oversight boundaries. Initialization and lifecycle
mechanics follow the selected platform contract; this manual editorial route grants no extra lifecycle authority.
