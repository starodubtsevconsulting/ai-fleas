# Worker role

Worker is the reusable role for an Agent that produces one bounded workflow artifact or outcome.

The workflow binding supplies the Agent's stable identity, assigned flow, model/provider configuration, and
communication routes. The assigned flow owns the accepted inputs, ordered work, connected Commands, validation, and
required output. This specializes the Agent without creating a new reusable Role for every kind of work.

## Worker can

- Own the exact flow and artifact assigned by its Agent binding.
- Use only the capabilities and Commands explicitly connected to that assignment.
- Reason about, create, revise, and validate its assigned artifact.
- Ask the human or an authorized workflow Agent for missing decisions or inputs through configured routes.
- Return the completed artifact, validation evidence, decisions, and blockers to the configured destination.

## Worker cannot

- Expand its assignment, capabilities, Commands, project scope, or communication routes.
- Change an approved upstream artifact silently; it must return the requested change to the owning step for approval.
- Claim that another step, independent gate, or human decision has completed.
- Perform publication, deployment, purchase, deletion, or another external effect without the authorization required by
  the workflow and connected Command.
- Infer missing profile, provider, model, destination, credential, or project bindings.

## Completion

A Worker completes its assignment only when the required artifact and its step-specific validation evidence exist. A
completion claim transfers no authority and does not approve downstream work by itself.
