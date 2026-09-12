# Agent scope

Every initialized agent declares a `scope`.

- `workflow` means the agent belongs to one workflow logical project/group.
- `system` means the agent exists outside workflow logical projects/groups and may operate across them only through explicitly granted system capabilities.

Scope defines where an agent belongs, not what it may access. Cross-scope access still requires explicit authority.

A system-scoped agent is not part of any workflow-group lifecycle transaction. Ordinary workflow initialization, reconciliation, reinitialization, and deletion leave it unchanged. System lifecycle uses an explicit system initialization/reinitialization operation. Only one active System agent may exist for a selected platform binding.

System-to-workflow communication is asymmetric and host-mediated. Workflow agents are initialized without System's
runtime identity, do not receive its instance ID or routing address, and cannot directly address it. System may resolve
exact workflow-agent bindings from trusted host lifecycle receipts and contact those agents only for authorized health,
continuity, context-exhaustion, and lifecycle operations. Workflow initialization never depends on System being active.
Any future disclosure of System identity to a workflow agent requires a separate explicit secure-registration contract;
it is not part of current initialization.

Scope does not choose where an agent runs or which provider/model it uses. Those are resolved by the selected profile and platform implementation.

## Workflow logical-project scope

An initialized workflow team belongs to one logical agent project named `<profile-id>-<workflow-id>` or
`<profile-id>-<workflow-id>-<suffix>`. The base profile/workflow prefix is mandatory, and any nonempty suffix is allowed
when it is part of the exact selected logical-project binding. A suffix may identify a repository, workstream, ticket,
client, environment, or another profile-owned distinction; it does not change the profile or workflow identity.
Implementations must validate the known profile and workflow first and then treat the remaining suffix as opaque. They
must not infer profile or workflow identity by splitting on the final hyphen.

The complete logical project ID is the team's communication and policy boundary. Workflow-scoped roles may communicate
only with declared peers in the same logical agent project.

The logical agent project is not a product repository and does not permanently bind a role to one product folder. The
selected profile supplies the authorized project registry, repository bindings, and workspace roots. Each request or work
packet selects one exact authorized project/repository and matching workspace path according to the selected workflow. The
same workflow team may therefore operate across the profile's authorized work targets without being recreated.

Repository and folder coordinates scope the current work; the `<profile-id>-<workflow-id>` prefix scopes the workflow
identity; the complete logical project ID, including any suffix, scopes the agents and their communication.
