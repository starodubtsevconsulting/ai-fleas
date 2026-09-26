# Writing handoff compatibility link

Writing now runs through the hidden [Workflow Router](../../_common/runtime/workflow-router.md), with stage envelopes
defined by [Router routing](editorial-routing.md). Writer, Reviewer, and Release Coordinator are independent endpoints;
they neither exchange packets nor use Admin or the human as a message courier. The host observes terminal endpoint
results and the Router selects the next stage from the workflow definition.

The selected profile determines whether human article acceptance is required before future Medium scheduling. The
human retains immediate publication and submission decisions. Admin may inspect runtime state and repair endpoint
bindings but is not the workflow transport.
