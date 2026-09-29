# Education-profile probes

Probe definitions are reusable questions about a model's education/communication, not Qwen-specific answers.

Initial families:

1. **Familiar bounded work** — establish a baseline in the model's declared native domain.
2. **Domain translation** — same frozen task with task-only, raw-domain and translated-domain handoffs.
3. **Boundary discrimination** — positive and misleading/near-match examples.
4. **Invariant reasoning** — map a local rule to a code/data boundary.
5. **Lifecycle/state reasoning** — multi-step state transitions and survivor/failure cases.
6. **Source-to-target transformation** — distinguish implementation from independent design.
7. **Tool/scope compliance** — where the deployment supports tools.
8. **Standardized correction** — measure recovery separately from first-pass understanding.
9. **Transfer** — repeat a promising communication pattern on a second task family.

Every executable probe should freeze its inputs and define independent acceptance before runs begin.
