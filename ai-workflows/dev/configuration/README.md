# Dev workflow parameters

`workflow.yml` references `parameters.json`, the workflow-owned declaration of types, allowed values,
defaults, and reusable artifact references. The descriptor uses `workflow-parameters.v1`, a bounded declaration format;
it is not an unrestricted JSON Schema interpreter.

A profile sets supported values only under its exact `workflows[]` Dev entry:

```yaml
- path: dev.workflow.md
  parameters:
    ux:
      strategy: action-first-outcome-visible
      designMethods: [start-before-sign-in]
      web:
        startBeforeSignIn: true
```

Resolution order is workflow defaults, then that workflow's profile values. Nested objects merge by property;
arrays replace. Unknown properties, wrong types, unsupported IDs, duplicates, invalid defaults, and missing artifacts
fail closed. Other workflows do not inherit these overrides.

The implementation resolves a candidate-bound parameter object into the workflow manifest/catalog and passes it to
startup instructions and process/MCP environment as `AI_WORKFLOW_PARAMETERS_JSON`. UX tasks consume the effective
values, not profile prose. Definition references identify reusable meaning without loading every document at startup.

Adapters must implement the same resolution and propagation contract before claiming activation. A raw profile,
editorial file, or an environment variable without a consumer is not activation evidence. Existing running tasks need
a deliberate context refresh; no restart or deployment is implied.

Supported UX properties are policy, strategy, reviewMethod, designMethods, platforms, and web.startBeforeSignIn.
The common sign-in method remains conditional; enabling a method does not waive applicability, authorization,
or acceptance. Desktop/mobile scope is selectable while their native derivatives await concrete implementations.
