# Workflow map: common questions

## Who knows which agent should go next?

The workflow definition declares the next stage and its role. The hidden Router only executes that declaration and
resolves the role to one exact registered task.

## How does the hidden Router resolve it?

The endpoint returns its current stage and an event. The Router performs this lookup:

```text
(current stage, event) -> next stage -> owning role -> exact task ID
```

For example, `review + changes_required` selects the `correction` stage. That stage is owned by `writer`, so the host
registry supplies the exact active Writer task ID for the same workflow scope.

## What is the registered workflow map?

It is the host's executable runtime record for one workflow scope. Initialization combines:

1. the portable `*.workflow-map.json`, containing stages, roles, events, transitions, and evidence requirements; and
2. private runtime data containing the exact scope and receipt-backed task ID for each role.

Agents receive only their own endpoint binding. The complete map and peer task IDs remain host-only.

## How does it look?

The portable map is JSON. A transition looks like this:

```json
{
  "review": {
    "role": "reviewer",
    "transitions": {
      "changes_required": {
        "to": "correction",
        "requiredReferenceKinds": ["findings"]
      }
    }
  },
  "correction": {
    "role": "writer",
    "transitions": {}
  }
}
```

At initialization, the host adds role resolution such as `writer -> <exact Writer task ID>` without committing private
profile data to the public workflow repository.

The GPT adapter passes the portable JSON and a private runtime overlay to `register-workflow.mjs`; the overlay supplies
only the exact scope and role-to-task bindings.

## How does the map prevent a repeated agent loop?

A transition that must demonstrate progress may declare a retry ceiling and the reference kinds that identify that
progress. For example, a correction route can use the exact `revision` reference. The Router dispatches at most the
declared number of attempts for that same revision, then stops visibly; a new revision reference resets the count.

```text
same revision attempt 1 -> dispatch
same revision attempt 2 -> dispatch
same revision attempt 3 -> stop as non-progress
new revision            -> dispatch
```

## Does the workflow map have a companion diagram?

Yes. Every portable `*.workflow-map.json` should have a same-name `*.workflow-map.mmd` Mermaid companion. The Mermaid
file is generated from the JSON map, so it is a human view of the same transitions rather than a second workflow
definition.

For Writing, see [the executable map](../../writing/writing.workflow-map.json) and its
[Mermaid companion](../../writing/writing.workflow-map.mmd). Regenerate the diagram with:

```bash
node ai-workflows/_common/runtime/workflow-map.mjs \
  ai-workflows/writing/writing.workflow-map.json \
  ai-workflows/writing/writing.workflow-map.mmd
```

The authoritative policy remains `*.workflow.md`; the JSON is its executable projection, and Mermaid is a generated
human-readable view.
