# Live acceptance-stop comparison

Question: can a coordinator save Coder time by stopping an active source-port run as soon as its artifact independently satisfies the fixed acceptance gate, while preserving accepted work?

Use the frozen [starter](starter/run-installer-with-timeout.py), [reviewed reference](reference/run-installer-with-timeout.py), [task](TASK.md), and six-case [verifier](verify.py). Each run gets a fresh staged target in the visible checkout. Keep Qwen3-Coder-Next Q5_K_M, the configured Hermes profile, CLI `chat -Q` route, 20-turn cap, exact target-file write root, 180-second deadline, and one identical focused source-port assignment fixed. Coder may read the task, target, and reference, may edit only the target, and may not run tests. The production helper and Hermes runtime remain read-only.

Both arms run the same read-only observer. It waits for a completed target-file write, then, if the candidate bytes equal the reviewed reference, runs the independent six-case verifier against a stable snapshot of that candidate. It records the first verified acceptance time. The observer must not mistake a partial write, a passing intermediate file that later changes, or a process exit for accepted final work.

- **A, ordinary:** record the acceptance event and allow Coder to finish normally.
- **B, acceptance stop:** after the same acceptance event, terminate only that launched delegate process group with SIGTERM, allow five seconds, attempt SIGKILL if it still exists, and reap it. Preserve the accepted candidate; do not edit it. If the delegate already ended, record no intervention.

First run one pilot to establish that the observer sees a target-file change while Coder is live. Then run eight fresh starts per arm in the fixed order **ABBA, BAAB, ABBA, BAAB**. Freeze the assignment and observer logic before the batch; do not tune either from individual outcomes. Restore the starter for every target. Admin verifies the final candidate after process exit and checks byte equality, six cases, write scope, process stop, and profile hash.

Report final accepted artifacts, completed Coder handoffs, observer acceptance events, actual interventions, accepted artifact time, total Coder wall time, model calls/tokens, patch/write calls, scope errors, compactions, and deadlines. Compare accepted work per Coder minute only after the whole batch. A stopped accepted artifact is useful but not a completed Coder report. This source-copy port can estimate a coordinator stopping opportunity; it does not establish a general Hermes guard or coding speedup without a second task.
