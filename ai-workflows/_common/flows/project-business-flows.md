# Project business flows

Project business flows and scenarios are the normative source of expected product behavior.
Write them in English Markdown in the project that owns the behavior. This is a
business-scenario/BDD source: smoke, integration and end-to-end checks derive their expected
outcomes from it. Test code and current implementation do not silently redefine that source.

These documents describe what a user or business actor can accomplish and what must happen.
They are distinct from [AI workflow flows](contract.md), which assign agents, commands and
execution gates. A business flow grants no runtime authority and is not registered with the
workflow Router.

## Discover before changing or testing

Read the project's applicable AGENTS notes, documentation index and existing business flows
before planning behavior changes or selecting tests. Projects must designate the canonical
business-flow source or index through an AGENTS link or project documentation index for
applicable business work. Resolve that source and relevant scenarios in the handoff or test
plan. Existing locations remain valid; do not
move them merely to fit a convention. A new project may use `docs/flows/` with an index or
AGENTS link. Different projects bind their own flows; a shared technical component does not
imply one universal business journey.

If the entry point or source is missing, incomplete or contradictory, identify the gap and the owner who
can resolve expected behavior. Draft the smallest relevant flow or scenario before dependent
implementation/test changes; do not bulk-retrofit unrelated flows. Do not manufacture
business approval from observed behavior.

## Content and ownership

Use the [optional template](project-business-flow.template.md) or the project's established
format. State actors, prerequisites, ordered actions, observable outcomes, relevant failure
and recovery paths, and completion/stop conditions. Include business invariants and external
effects where relevant. Optional diagrams clarify the Markdown; they do not replace it.
Stable scenario identifiers or versions may help a project but are not mandatory.

The project's designated business/product owner approves intended semantics. The assigned
writer maintains the source; in Dev, Designer/Reviewer resolves expected semantics with that
owner, Coder implements the accepted source and tests, and gate owners collect their own
evidence. Workflow execution and human approval requirements still apply.
Existing task or workflow approval of the intended semantics is sufficient within its
scope; this contract adds no fresh human approval gate for every documentation edit.

## Maintain the origin first

When intended behavior changes, update the owning business flow/scenario first, resolve its
approval, then change implementation and derived tests. A regression correction that restores
an existing approved flow need not change its intended behavior. If the regression exposes a
missing condition, recovery path or ambiguous case, refine that source first, then encode the
regression. Keep related test guidance and operations instructions consistent with the source.

Record discovered deviations separately: expected scenario, actual observation, candidate and
environment, evidence, owner and next action. A failing implementation or test does not justify
rewriting the flow to pass. Actual acceptance records distinguish passed, failed, not run,
not applicable and blocked observations; source approval is not execution evidence.

## Derived tests and coverage

Select smoke and end-to-end journeys from the applicable project scenarios and risk; narrower
checks prove their technical parts. A test facade may express those journeys without copying
selectors into the business source. Preserve project-specific prerequisites, boundaries and
expected effects when reusing technical test support.

The eventual goal is explicit one-to-one traceability between each named business scenario
and its corresponding smoke/end-to-end case, followed by observed evidence. A flow may
contain several named scenarios; this is not one test file per flow. Record relevant
coverage gaps when planning or reporting a change. Establishing that mapping is deferred:
this contract requires no immediate mapping, bulk test rewrite or migration of existing flows.
