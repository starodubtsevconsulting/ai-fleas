# Workflow access matrix templates

The reusable mechanical policy uses one workflow-local matrix:

- [role-capability-ownership.csv](role-capability-ownership.csv) for capability ownership.

Each agent-enabled workflow fills that schema in its workflow-local agent directory. Its `agents.yml` remains the single
source for agent identity, lifecycle, human-facing mode, runtime mode, provider binding, and other endpoint metadata,
and supplies the unique `matrixColumn` value used by the capability matrix. Workflow sequencing and endpoint dispatch
come from the selected Router runtime and workflow stage declarations, never from a role-to-role matrix.

The adjacent `role-capability-matrix.csv` is retained only as a legacy schema and must not be copied into new workflows;
its metadata duplicates `agents.yml`.

Readable role and team documents explain intent and rationale. They must not create capability ownership or a Router
transition absent from the workflow-local policy. Reusable common roles do not link to one workflow's concrete matrix;
the selected workflow manifest and Team page bind those roles to the workflow-local policy.

A missing referenced matrix, missing or duplicate matrix column, empty cell, undeclared role, or disagreement with the
selected role boundary fails closed. A communication matrix is unsupported and must not be loaded as policy.
