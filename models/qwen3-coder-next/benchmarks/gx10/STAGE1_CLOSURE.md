# GX10 Stage 1 closure

Scope: Qwen3-Coder-Next Q5_K_M through the configured SC Dev Hermes CLI Coder route. This is a record of tested local behavior, not a claim about the model family everywhere. Detailed measurements remain in the linked [runtime benchmark](hermes-qwen-coder-runtime-2026-09-28.md) and adjacent JSON records.

| Status | Finding | Decision |
|---|---|---|
| **Accepted** | `hermes chat -Q` applies the configured 20-turn limit; the launcher requires an exact write root and enforces a process deadline. The production process-group helper and reviewed reference pass all six independent cases; the frozen starter fails the intended descendant-cleanup cases. | Keep the bounded CLI route and production cleanup change in PR #225. Verify artifacts independently because exit zero and completion prose can be wrong. |
| **Accepted, fixture-scoped** | On the frozen recognizer, first-pass acceptance was task only 3/9, raw domain 5/9, translated domain 8/9. The translation arm increased accepted work per Coder minute on that fixture; its individual attempts were not always faster. | Use the result as evidence for handoff design, not as a general model-speed claim. |
| **Rejected as defaults** | The proposed 32,768-token early compression cap spent about 110 seconds on four committed summaries in a coding stress pilot with 0/2 accepted fixes in each arm. A six-turn cap made a small accepted source port slower than the existing 20-turn setting. | Retain the realized compression settings and 20-turn cap. Do not adopt these parameter changes from Stage 1. |
| **Provisional** | Domain Context Handoff translated the recognizer rule into familiar data/code concepts. The same kind of explanation did not fix the harder process-group task on the first pass: task only, raw, and later translated batches each had 0/8 accepted first passes. | Keep translation as a scoped strategy with independent checks. Do not infer a general reasoning ceiling from one failure family. |
| **Provisional** | On a reviewed source-copy port, live acceptance-stop produced 8/8 verified artifacts in 268.78 Coder seconds and 29 calls versus 8/8 in 416.69 seconds and 55 calls for ordinary completion. It interrupted all eight final Coder reports. | Treat this as accepted-artifact throughput evidence only. It is not yet a normal delegation default. |
| **Unanswered** | A three-confirmed-no-change-patch stop matched seven historical traces, but the live source-port comparison never triggered it. The recognizer acceptance-stop transfer was prepared but **not run**: its ignored runner failed review of the changed-content observer after four bounded Coder implementation/correction assignments, two of which hit the 240-second deadline. | No live no-change guard or acceptance-stop transfer result is claimed. Leave these questions for a later stage, without changing Hermes runtime. |
| **Unanswered** | Representative long-context accepted-code performance, broader domain/task transfer, and reliable first-pass process-lifecycle implementation remain unproven. | No general local-agent speed or capability claim follows from this stage. |

## Operational versus evidence changes

PR #225 changes the public CLI delegate launcher and process-group timeout helper. Its fixtures, protocols, benchmark JSON, education profiles, strategy prose, and model-first `notes/models/` catalog are evidence or advisory metadata; current launchers do not load or inject education profiles. The local Hermes runtime, Q5 model, and realized compression profile were not changed by these experiments. The SC-specific configuration is in [private PR #57](https://github.com/starodubtsevconsulting/ai-fleas-platform/pull/57), which remained open at closure. The detailed runner outputs and session IDs stay in ignored visible `notes/benchmarks/local-models/runs/` artifacts. The article remains user-owned.

## Checks at closure

- Shell, Python, and Node syntax checks passed for the changed launcher/helper and benchmark verifiers; `git diff --check` passed.
- The independent process-group verifier passed all six cases against both the reviewed reference and production helper; the frozen starter failed timeout, SIGTERM, and SIGINT descendant cases as expected.
- The recognizer verifier rejected its frozen starter and passed a saved accepted translated-context candidate.
- Fourteen Qwen GX10 benchmark JSON records parsed; the recognizer 3/9, 5/9, 8/9 and source-port acceptance-stop 8/8, 8/8 aggregates matched their records. Ten model education YAML files parsed with existing evidence references; the route-specific Qwen education file validated against its JSON schema. Tracked local Markdown links under the model, benchmark, and delegation-strategy trees resolved after the model-first move.
- The configured Coder `check --project ai-fleas` reported ready on the named branch. GitHub reported no CI checks for PR #225 at closure.

## Later connection to PR #237

[PR #237](https://github.com/starodubtsevconsulting/ai-fleas/pull/237) is a conceptual Models/Education architecture: Workflow → Role → Agent → Model → Deployment, with model-owned education and deployment-scoped benchmark evidence. PR #225 currently has an interim `notes/models/` registry plus a separate Dev route-specific education schema. A later integration should map those two evidence shapes into the proposed top-level `models/` entity, update consumers/validators, and preserve exact model, deployment, transport, task, and interpretation scope. No PR #237 integration or path migration was done during Stage 1 closure.
