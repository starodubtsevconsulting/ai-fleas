# Process-group domain-context pilot

The task-only arm received the unchanged [`TASK.md`](TASK.md). The domain-context arm received this frozen block immediately before that same task:

> Domain model before the coding request:
> - A command started with start_new_session=True has a process group. Waiting for its direct child tells you about that child, not every descendant in the group.
> - A descendant can ignore SIGTERM and remain alive after the direct child exits. Cleanup must settle the captured group even when the direct-child wait returns promptly.
> - ProcessLookupError while signaling is a race with process exit; it must not skip the direct-child reap.
> - Timeout and forwarded external signals must leave the same process-tree invariant: no same-group descendant survives after the helper exits.
>
> Requested change and scope follow unchanged:

Eight runs per arm used fresh sessions in an A, B, B, A sequence repeated four times. Each began from the frozen starter in a visible ignored run directory, with an exact-file write root, the same Q5 model/profile/CLI route, a 20-turn cap, and a 180-second process deadline. Admin ran the unchanged six-case [`verify.py`](verify.py) after each process stopped. Every initial candidate failed the three descendant cases. Each then received one identical 120-second-bounded verifier-backed correction that required unconditional group SIGKILL after a bounded direct-child wait, followed by reaping. Keep verifier pass distinct from source-review acceptance. The [sanitized pilot record](../../gx10-process-group-domain-context-pilot-2026-09-28.json) gives the result; exact prompts and candidates remain in ignored local `runs/` artifacts.
