# Workflow role capability matrix template

The adjacent [role-capability-matrix.csv](role-capability-matrix.csv),
[role-capability-ownership.csv](role-capability-ownership.csv), and
[role-communication-matrix.csv](role-communication-matrix.csv) are empty reusable schemas. They grant no capability.

Each agent-enabled workflow copies all three schemas into its workflow-local agent directory. It fills the role matrix
with exact initialized roles and extends the ownership and communication headers with those role IDs before adding rows.
Every role contract links its readable top capability declaration to all three filled workflow-local matrices.

The readable declaration summarizes the effective boundary; the filled CSV files are the mechanical routing authority.
A missing link, empty workflow-local matrix, undeclared role, or declaration/matrix disagreement fails closed.
