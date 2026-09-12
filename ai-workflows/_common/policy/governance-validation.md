# Governance validation

This policy defines the reusable validation procedure for governance consistency. It is not specific to the Dev workflow.

A Judge, Cross-Workflow Governor, or another explicitly authorized governance role may use this procedure when that role is present and the selected workflow or governance scope grants it the required read access. Validation is read-only unless the human separately authorizes a governed change.

## Validation order

Start from the selected governance target and follow declared references in this order:

1. common agent and governance contracts;
2. the selected workflow `agents.yml`, when the target is a workflow;
3. capability-ownership and communication matrices, when present;
4. the workflow Team policy;
5. referenced role contracts;
6. the workflow entry point;
7. referenced routing, permission, lifecycle, continuity, scheduling, strategy, and profile-facing contracts.

Do not scan the repository indiscriminately. Follow authoritative links first, then search globally only for stale names, duplicate authorities, orphaned representations, or conflicting copies.

## Required consistency checks

Verify all applicable invariants:

- every declared agent has a unique and resolvable identity;
- every declared matrix column maps to exactly one declared agent and vice versa;
- every capability row is complete and explicit;
- capability ownership agrees with intrinsic role boundaries and readable capability declarations;
- communication routes are explicit, directional, and compatible with common communication ceilings;
- no role, team, workflow, guide, or routing prose grants authority absent from mechanical policy;
- readable summaries do not contradict manifests or matrices;
- workflow orchestration does not redefine role authority;
- dependencies do not silently grant capability, ownership, or communication authority;
- governance boundaries remain isolated from product/workflow execution where required;
- referenced files and anchors resolve;
- role IDs, agent IDs, aliases, matrix columns, readiness tokens, and names are not stale or contradictory;
- duplicated policy has one authoritative owner and all other occurrences are references or faithful summaries;
- `can`/`cannot`, allow/deny, ownership, delegation, and lifecycle statements do not conflict across representations;
- no orphaned rule, matrix row, role, agent declaration, or obsolete compatibility artifact remains active.

## Quality checks

Also report non-blocking quality problems:

- copy/paste mistakes;
- redundant prose that repeats matrix or common-contract facts;
- unnecessarily broad context loading;
- unclear authority ownership;
- obsolete terminology or renamed roles;
- rules represented in more places than necessary.

Quality findings must not be promoted into new policy. Report the issue and the smallest faithful cleanup.

## Finding classes

Report only:

- `ERROR` — contradiction, missing required authority, invalid reference, incomplete mechanical policy, or irreconcilable rule;
- `WARNING` — risky ambiguity or likely drift without a current contradiction;
- `REDUNDANCY` — duplicated authority or repeated policy that should become a reference or summary;
- `OK` — checked invariant is coherent.

Each non-`OK` finding includes:

- exact files or representations involved;
- the conflicting or missing facts;
- which source is authoritative;
- the smallest correction that preserves current policy meaning.

## Validation result

Finish with:

1. overall status: `VALID`, `VALID_WITH_WARNINGS`, or `INVALID`;
2. findings grouped by severity;
3. authoritative sources checked;
4. unresolved questions only when policy meaning is genuinely ambiguous and requires the human.

Validation never changes policy by itself. Semantic policy changes still require the human-authored governance path. Faithful synchronization or cleanup follows the governing role's publication rules and authorization requirements.
