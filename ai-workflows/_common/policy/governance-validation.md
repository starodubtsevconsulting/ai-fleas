# Governance validation

This policy defines the deterministic validation procedure used by Judge when asked to validate workflow governance consistency. Validation is read-only unless the human separately authorizes a governed change.

## Validation order

Judge resolves and checks sources in this order:

1. common agent contracts under `ai-workflows/_common/agents/`;
2. the workflow `agents.yml` manifest;
3. the workflow capability-ownership matrix;
4. the workflow communication matrix;
5. the workflow `agents/team.md` policy;
6. referenced common role contracts;
7. the workflow entry point;
8. referenced routing, permission, lifecycle, continuity, scheduling, and strategy documents.

Judge should not scan the repository without a target. It starts from the selected workflow and follows only declared references, then searches globally only for stale names, duplicate authorities, or conflicting copies.

## Required consistency checks

Judge verifies all applicable invariants:

- every initialized workflow agent has exactly one unique matrix column;
- every matrix column maps to exactly one declared workflow agent;
- every capability row is complete and has explicit values for every matrix column;
- capability ownership agrees with each role's intrinsic boundary and readable capability declaration;
- every communication route is explicit, directional, and compatible with the common communication ceiling;
- no role, team, workflow, guide, or routing prose grants a capability or route absent from mechanical policy;
- readable summaries do not contradict `agents.yml` or the matrices;
- workflow orchestration does not redefine role authority;
- dependencies do not silently grant capability, ownership, or communication authority;
- protected governance boundaries remain isolated from product/workflow execution;
- referenced files and anchors resolve;
- role IDs, agent IDs, aliases, matrix columns, readiness tokens, and names are not stale or contradictory;
- duplicated policy has one authoritative owner and all other occurrences are references or faithful summaries;
- `can`/`cannot`, allow/deny, ownership, delegation, and lifecycle statements do not conflict across representations;
- no orphaned rule, matrix row, role, agent declaration, or obsolete compatibility artifact remains active.

## Quality checks

Judge also reports non-blocking quality problems:

- copy/paste mistakes;
- redundant prose that repeats matrix or common-contract facts;
- unnecessarily broad context loading;
- unclear authority ownership;
- obsolete terminology or renamed roles;
- rules that are technically consistent but represented in more places than necessary.

Quality findings must not be promoted into new policy. Judge reports the issue and the smallest faithful cleanup.

## Finding classes

Judge reports only these classes:

- `ERROR` — contradiction, missing required authority, invalid reference, incomplete mechanical policy, or rule that cannot be reconciled without a governed change;
- `WARNING` — risky ambiguity or representation likely to drift but not currently contradictory;
- `REDUNDANCY` — duplicated authority or repeated policy that should be replaced by a reference or readable summary;
- `OK` — checked invariant is coherent.

Each non-`OK` finding includes:

- exact files or representations involved;
- the conflicting or missing facts;
- which source is authoritative;
- the smallest correction that preserves existing policy meaning.

## Validation result

Judge finishes with:

1. overall status: `VALID`, `VALID_WITH_WARNINGS`, or `INVALID`;
2. findings grouped by severity;
3. a short list of authoritative sources checked;
4. unresolved questions only when policy meaning is genuinely ambiguous and requires the human.

Judge does not modify policy merely because validation found an issue. A semantic correction still requires the human-authored governance path. Faithful mechanical synchronization or cleanup follows the Judge publication rules and required authorization.
