# Agent scope

Every initialized agent declares a `scope`.

- `workflow` means the agent belongs to one workflow logical project/group.
- `system` means the agent exists outside workflow logical projects/groups and may operate across them only through explicitly granted system capabilities.

Scope defines where an agent belongs, not what it may access. Cross-scope access still requires explicit authority.
