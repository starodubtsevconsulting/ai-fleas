# Translated process-group domain context

Use this frozen block before the unchanged [`TASK.md`](TASK.md) for the translated-context transfer probe:

> Think of the launched command and its descendants as a team. `process.wait()` checks whether the team leader—the direct child—has exited. It does **not** tell you whether other members of the same process group are gone. The captured process-group ID is the address for signaling the whole team.
>
> Positive case: a command with no surviving descendants exits normally, and the helper returns that command's status. Cleanup case: a direct child creates a worker that ignores SIGTERM; after timeout or a forwarded external signal, both must be gone before the helper exits. The misleading near-success is that the direct child exits promptly after SIGTERM, so `process.wait(timeout=5)` returns, while the resistant worker remains alive in the group.
>
> The invariant is about the **group**, not the direct child's wait result. At the cleanup boundary in the staged helper, signal the captured group, give the direct child a bounded wait, then attempt group SIGKILL **regardless of whether that wait returned or timed out**, and reap the direct child. Treat `ProcessLookupError` as an exit race around a group signal; it must not skip reaping. Timeout and forwarded SIGINT/SIGTERM should use the same group-cleanup reasoning. Preserve normal exit, streams, validation, the timeout diagnostic, and exit 124.
>
> Requested change and scope follow unchanged:

This block supplies a familiar mental model, a positive case, a misleading case, the invariant, and the relevant code boundary. It changes no runtime parameter. The [existing process-group domain pilot](DOMAIN_CONTEXT.md) tested task-only and raw facts first; this translated arm is a later exploratory transfer probe, not a simultaneously interleaved third arm. Its [independent verifier](verify.py) remains unchanged.

Run eight fresh first-pass sessions from the same frozen starter, with the same Q5 profile, configured CLI route, 20-turn limit, exact staged-file write root, 180-second process deadline, and independent six-case verifier. Do not tune the preface after failures. Give each failed candidate one identical verifier-backed correction under a 120-second deadline using the earlier pilot's unconditional group SIGKILL and reap wording. Count verifier pass and source-reviewed acceptance separately, and include correction time in the workflow total.
