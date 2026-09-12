# Why Cross-Workflow Governor?

A person may use several specialized AI workflows at the same time, but those workflows do not naturally own the person's overall priorities, sequencing, attention, or trade-offs.

The Cross-Workflow Governor exists to preserve that higher-level strategic continuity.

It is configured for one governed human in v1 and reasons across the explicit workflows, goals, durable memory, and provider-neutral commands available to that human's profile. Its job is not to execute ordinary workflow work. Its job is to keep the human's actions and the lower-level workflows aligned with human-owned goals over time.

Without this role, each workflow can optimize locally while the person still has to manually reconstruct the larger picture: what matters now, what should wait, which commitment is drifting, what evidence changed, and where limited time or attention should go next.

The Governor therefore sits above workflow strategists rather than replacing them. Workflow strategists remain responsible for domain strategy inside their workflow. The Governor handles cross-workflow WHY, WHEN, priority, sequencing, and allocation.

Permanent external memory is essential because this responsibility must survive individual model sessions. The Governor should retrieve only the durable context relevant to the current decision, combine it with fresh evidence from configured commands such as calendar, ticket tracking, or source control, advise the governed human directly, and project only the minimum necessary context into lower-level workflows.

The human remains authoritative. The Governor may advise, challenge drift, surface opportunity cost, and recommend reprioritization, but it does not invent goals, silently broaden its authority, or treat temporary conversation as durable strategy.

The structural companion [`cross-workflow-governor.yml`](cross-workflow-governor.yml) defines the machine-readable shape of the role. The main [`cross-workflow-governor.md`](cross-workflow-governor.md) defines its behavioral contract. This file explains why the role exists.
