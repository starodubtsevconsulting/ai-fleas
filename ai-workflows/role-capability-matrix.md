# Workflow access matrix templates

The reusable mechanical policy uses two workflow-local matrices:

- [role-capability-ownership.csv](role-capability-ownership.csv) for capability ownership;
- [role-communication-matrix.csv](role-communication-matrix.csv) for directional communication routes.

Each agent-enabled workflow copies and fills those two schemas in its workflow-local agent directory. Its `agents.yml`
remains the single source for agent identity, lifecycle, human-facing mode, communication mode, provider binding, and other
runtime-facing role metadata, and supplies the unique `matrixColumn` value used by both matrices.

The adjacent `role-capability-matrix.csv` is retained only as a legacy schema and must not be copied into new workflows;
its metadata duplicates `agents.yml`.

Readable role and team documents explain intent and rationale. They must not create capability ownership or a communication
route absent from the workflow-local matrices. Reusable common roles do not link to one workflow's concrete matrices;
the selected workflow manifest and Team page bind those roles to the workflow-local policy.

A missing referenced matrix, missing or duplicate matrix column, empty cell, undeclared role, or disagreement with the
selected role boundary fails closed.
