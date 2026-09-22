# Independent review: Your AI Agents Do Not Need to Talk to Each Other

- Reviewed revision: `sha256:3edb39b524ced7c5d384e1cea92847a5d5a5a9a78e140e59711e58b1f47b4dc1`
- Source: `notes/articles/2026-09-21-your-ai-agents-do-not-need-to-talk-to-each-other.md`
- Review date: 2026-09-21
- Verdict: changes required

## Reader-level assessment

The article promises to show that declared workflow transitions can coordinate specialized AI agents without making
the agents discover, message, or orchestrate one another. It fulfills that promise with a clear progression from a
workflow map, through the Router runtime and host hooks, to exact bindings and human waiting states.

The strongest material is the separation of workflow, Router, hooks, and dispatcher; the treatment of waiting as a
real state; and the boundary between deterministic routing and domain judgment. The prose is direct, the examples are
concrete, and the conclusion gives the piece a memorable cadence.

## Findings

### 1. Blocking: terminal-result example does not match the implemented contract

Passage: lines 145-156.

The example prints `COPY THAT` before `WORKFLOW_ROUTER_RESULT`, but its JSON object omits the required
`"acknowledgement": "COPY THAT"` field. The current hook validator requires that field inside the result envelope.
A reader copying the displayed example would therefore produce a rejected result.

Direction: add the acknowledgement field to the JSON object and keep the envelope aligned with the validator's exact
allowed fields.

### 2. Substantive: the executable projection contains an unresolved target

Passage: lines 37-65.

The projection sends `human_action_required` to `human_review`, but the displayed object defines only `review` and
`correction`. Calling this an executable projection implies that the shown map is internally runnable, while its target
stage is absent.

Direction: either identify the snippet as a partial excerpt or add the `human_review` stage with its
`human_accepted` and `human_rejected` transitions.

### 3. Substantive: implementation claims need durable provenance

Passages: lines 105-139, 173-195, 245-289.

The article makes testable claims about Codex lifecycle hooks, ingress routing, exact task bindings, result validation,
transactional dispatch, runtime history, and scope isolation. The source currently contains no provenance section or
links to the public contracts and implementation on which those claims rely.

Direction: add a Sources and provenance section linking the Workflow Router runtime contract, Writing executable map,
Writing editorial-routing contract, and Codex plugin/adapter documentation. State explicitly that the workflow and
Router contract are portable while the hook mechanism is one host-specific implementation.

### 4. Optional: qualify the absolute claim near the opening

Passage: line 16.

The headline's provocation works, but the body supports the narrower proposition that agents need not talk to each
other for declared workflow transitions. The later discussion of ambiguous intent supplies the nuance only after the
claim has been repeated absolutely.

Direction: qualify the early thesis with “for declared workflow transitions” while retaining the headline.

### 5. Optional: compress one repetition of the central distinction

Passages: lines 67-72, 100-103, 141-171, and 291-307.

The distinction between routing and specialist work is intentionally reinforced and mostly effective. One of the two
middle explanations can be shortened without weakening the argument, improving momentum into the human-ingress
section.

## Gate disposition

The first three findings require Writer-owned source work. Human listen-through and final acceptance should follow a
corrected revision, not this one. The two Mermaid blocks are relevant and structurally support the argument, but their
destination rendering remains a separate presentation check when an unpublished destination draft exists.
