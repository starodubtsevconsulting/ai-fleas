# Admin-only initialization on codex-app

This controller-followed route initializes exactly one declared workflow Admin, not
the roster. The portable Admin contract remains authoritative. Do not initialize
Financial Analyst, Records / Bookkeeping, Financial Reviewer, Router, or System.

After direct human agreement, resolve the exact authorized profile, workflow,
non-empty project subset, logical project and saved project. Run the read-only
`launcher.mjs preflight-admin --request REQUEST.json` builder. The JSON request contains
`profilePath`, `profileId`, `workflowId`, `projectIds`, `logicalProjectId`,
`savedProjectId` (the first project's saved host ID), `runtimeScope`, `savedProjects`
(one `{projectId, savedProjectId}` per selected project), positive `generation`, and `authorization` containing
`humanApproved: true` and matching profile/workflow/project/logical scope. Approval
must come from the human; a JSON flag is not independent evidence of agreement.
The prepared authorization is explicitly unverified: the controller's trusted
`verifyApproval` host port must validate actual direct-human approval before effects.

The supported controller transaction in `initialize-workflow-admin.mjs` uses fresh
host ports to inspect the task catalog, saved-project catalog, exact bindings and
platform prerequisites. Reuse only an exact active Admin with matching identity,
scope and verified `ADMIN_READY`. Conflicting or ambiguous identity blocks rather
than creating another Admin. When absent, create one task with the canonical source
references, exact scope, human bootstrap authorization and `INIT` prompt returned
by the builder. Register and queue that initial prompt using the host plugin's
existing `queue-agent-initialization.mjs` transaction, then verify the actual task,
binding and readiness. Queue acceptance or a pending binding is not readiness.

Controller integration imports `initializeWorkflowAdmin(preparedPlan, host)`;
the prepared plan may be JSON-serialized. The host must implement all six ports:

- `verifyApproval` attests actual human approval; `prerequisites` verifies usable canonical sources and the selected platform.
- `catalog` returns fresh, complete `tasks`, `projects`, and generic `bindings`; binding entries expose the existing registry key as `taskId`.
- `create` returns `{taskId, status: 'created'}` for one new Admin task; it must not create a roster.
- `initialize` queues the supplied exact binding and prompt and returns `{taskId, status: 'submitted'}`.
- `wait` returns `{taskId, status: 'complete', turnId, token: 'ADMIN_READY'}`; the fresh active binding must independently carry matching `completedTurnId` and `completedAt` evidence.

No bundled native desktop transport implements these ports yet. The exported
transaction automates checks and sequencing only when a trusted controller supplies
them. Human-only follow-up and actual reading of sources remain controller/role
instructions, not a message firewall or source-reading attestation. Older active
receipts without completion evidence cannot be silently reused or duplicated.

The launcher preflight itself performs no task creation, registration or delivery.
The existing queue helper registers a pending exact binding and queues one prompt;
it does not read fresh task catalogs or prove human authorization. Only call it
after controller verification. Never use a supplied catalog snapshot as fresh host
proof. If the host cannot expose or perform a required operation, report its
concrete unsupported capability and stop without an Admin readiness claim.

Governor's authorization ends after the one-time verified bootstrap and handoff.
Do not send a follow-up to Admin, choose its execution mode, initialize the remaining
roster, or silently switch platform. The human owns subsequent Admin direction.
Admin retains its common scoped capabilities, including human-directed emulated
work and explicitly requested full-roster initialization with normal gates.
