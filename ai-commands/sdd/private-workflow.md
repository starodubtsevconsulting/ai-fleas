## SDD command (Spec-Driven Development)

## Tags

#sdd #spec-driven-development #ddd #tdd #english-first #specs #ui-behavior

Use this command to make English-first specifications the source of truth for behavior changes.

The core rule:

- **Spec first, code second**
- When user describes behavior in English, update the matching `*.spec.md` first
- Then write/update a failing test (prefer unit test first) from the spec
- Then implement code changes to match the spec and make tests pass
- Then verify (tests/manual checks) against the spec acceptance examples

---

## Purpose

Tighten development flow so UI/behavior changes are driven by explicit specification files instead of only chat history
or ad-hoc code edits.

This command is especially important for:

- UI interactions ("when I click X it should show/hide Y")
- state transitions
- workflow behavior
- regressions caused by unclear intent
- cross-component behavior that is conceptually one user-facing capability

---

## SDD Loop (mandatory when behavior changes)

1. **Locate or create spec**
   - Find an existing `*.spec.md` for the feature/component/behavior
   - If missing, create one before changing code

2. **Update spec first**
   - Add/modify behavior rules in plain English
   - Add examples / acceptance cases
   - Add or update code mapping (`Code Paths`)
   - Do **not** update the spec for tiny visual polish details (for example exact centering/alignment/spacing wording)
unless they change behavior, accessibility, or an agreed UX rule

3. **Update plan**
   - Reflect spec work + code work in `<session-root>/<work-profile>/<session-id>/session-plan.md`
   - Use checklist items and role tags (`#docs`, `#coding`, `#test`)

4. **Write test first (TDD - Red)**
   - Derive a failing test from the updated spec acceptance examples
   - Prefer a unit test first when the behavior can be verified at that level
   - Use integration/e2e only when unit coverage is insufficient
   - Use `../test/test.command.md` to choose/run the appropriate test path

5. **Implement code (TDD - Green)**
   - Change code only after spec reflects the requested behavior
   - Make the failing test pass with minimal code
   - Keep implementation aligned with spec wording
   - Use `../coding/coding.command.md` for coding rules/expectations

6. **Verify**
   - Tests and/or manual verification against spec acceptance examples
   - If behavior changed during implementation, update spec again first

7. **Commit**
   - Commit spec + code changes together when they belong to the same behavior change

8. **Resync gate for commit/push**
   - Before commit/push, refresh working memory with:
     - `commands/sdd/sdd.command-resync.sh`
   - Commit/push flows are guarded by:
     - `commands/sdd/sdd.command-guard.sh`
   - Guard blocks publication when:
     - active plan/session is missing or closed
     - no checked spec/SDD evidence exists in plan progress
     - changed code has no spec update/backlink evidence
     - potential scope drift is detected
     - `.codex` resync state is stale/missing or does not match current plan/HEAD

---

## Spec Location Strategy (recommended)

Specs and code should stay separate.

Use a docs/specs tree (can be flat-ish for convenience), for example:

- `docs/specs/ai/AiAgents.spec.md`
- `docs/specs/ai/UX.spec.md`

Do **not** force a strict 1:1 folder mirror of code paths.
Instead, each spec must include explicit mapping to code files.

Prefer a single conceptual spec when multiple components/services implement one user-facing behavior.
Example:

- prefer `docs/specs/ai/AiAgents.spec.md`
- avoid splitting too early into files like `AgentPanel.spec.md` and `FlowPanel.spec.md` when both describe the same AI Agents behavior
- prefer `docs/specs/ai/UX.spec.md`
- avoid narrow technical labels like `PanelZoom.spec.md` when the behavior belongs to a broader UX contract

---

## Spec File Conventions

### Naming

- Use `*.spec.md` suffix (example: `AiAgents.spec.md`)
- Spec file names should use **DDD ubiquitous language terms** (the same terms users use when talking to the AI agent)
- Prefer conceptual domain/product terms in stable form, for example:
  - `AiAgents.spec.md` (not generic names like `panel-behavior.spec.md`)
- Prefer names that describe the capability, workflow, policy, or user story concept.
- Prefer names that can survive UI refactors and code moves.
- Avoid naming specs after a specific UI component, Angular/Nest class, controller, panel, dialog, helper, or service
unless that technical artifact is itself the product concept.
- Avoid spec names that mirror implementation structure too closely, for example:
  - `AgentPanel.spec.md`
  - `FlowPanel.spec.md`
  - `PanelZoom.spec.md`
  - `ApiController.spec.md`
  - `AgentCatalogService.spec.md`
- Prefer names that read like DDD concepts or user-story domains, for example:
  - `AiAgents.spec.md`
  - `UX.spec.md`
  - `SessionLifecycle.spec.md`
  - `PlanExecution.spec.md`
  - `WorkProfileSelection.spec.md`
- Preserve canonical term spelling/casing when known:
  - user may say `AI Agents`, `AiAgents`, or `Agent workspace`
  - canonical spec term should be `AiAgents` if that is the agreed ubiquitous-language term

### Naming limits (important)

- One spec may cover multiple components/files when they implement one cohesive user-facing concept.
- Do not split a spec only because there are multiple UI panels, routes, handlers, or services involved.
- Split a spec only when:
  - the behaviors have different business purposes
  - the invariants are materially different
  - the user would describe them as separate concepts
  - separate ownership reduces confusion rather than increasing it
- If two specs would repeat the same user story, merge them.
- If a spec name starts drifting toward an implementation artifact, rename it to the higher-level concept.

### Ubiquitous Language Rule (important)

- The language used in specs is the **source vocabulary** for implementation work
- When users refer to a named concept (for example `AiAgents`), treat it as a DDD clue and reuse that term consistently in:
  - spec file names
  - spec headings
  - code comments (optional)
  - UI/component naming (when appropriate)
- If multiple spellings are used in conversation, pick one canonical term in the spec and keep aliases noted in the spec body if needed

### English-first structure (recommended)

- `Tags` (searchable hashtags)
- `Purpose`
- `Scope`
- `Bounded Context` (when helpful)
- `State Model`
- `Commands / User Actions`
- `Domain Events`
- `Invariants / Rules`
- `User Actions`
- `Behavior Rules`
- `Acceptance Examples`
- `Code Paths`
- `Related Specs`

### DDD style for specs (required mindset)

- Specs are product/domain contracts, not code inventories.
- Write the spec in terms of:
  - user-visible behavior
  - domain meaning
  - business rules
  - state transitions
  - events and outcomes
- A spec should explain how the concept behaves even if the UI framework, component tree, route layout, or backend adapter changes.
- `Code Paths` is only the implementation mapping section; the rest of the spec should stay conceptual.
- Prefer wording like:
  - "when a session starts"
  - "when an agent is selected"
  - "the system emits/records"
  - "the workflow requires"
- Avoid implementation-led wording like:
  - "the component calls"
  - "the service toggles"
  - "the controller renders"
    except in `Code Paths` or rare implementation notes
- Keep domain specs and UX specs separated by ownership:
  - domain specs define the business/domain concept
  - UX specs define reusable interaction conventions
- Before editing any spec, ask this first:
  - "Is this a domain rule, or is this a UI/interaction rule?"
- If the answer is "UI/interaction rule":
  - do **not** put it into a domain spec
  - check whether an existing UX spec already owns it
- If an existing UX spec already owns that interaction category:
  - prefer **no spec edit**
  - implement the code and tests only
- Only update the UX spec if the change introduces a genuinely new reusable UX rule.

### Anti-example (important)

- Do **not** do this:
  - add double-click behavior
  - zoom dialog behavior
  - editor layout details
  - template picker details
  - dialog title rules
    into `AiAgents.spec.md`
- Why this is wrong:
  - `AiAgents.spec.md` is a domain spec
  - those details are UI behavior, not domain behavior
  - they belong to `UX.spec.md` only if they introduce a new UX rule
  - if `UX.spec.md` already covers the rule category, then no spec should be changed
- Correct decision for that exact example:
  - `Session Flow` double-click opens a zoom dialog
  - this is a UX implementation of an already-known zoom pattern
  - therefore: **do not edit `AiAgents.spec.md`**
  - and usually: **do not edit `UX.spec.md` either**
  - just implement the code + tests

### DDD content expectations

- Include domain rules and constraints, not only UI steps.
- Include stable invariants, for example:
  - what must always be true
  - what is required before an action can proceed
  - what cannot happen simultaneously
- Include domain or user-visible events where behavior is eventful, for example:
  - session started
  - session stopped
  - agent selected
  - plan archived
- If the behavior represents a workflow, name the workflow and its transitions explicitly.
- If the behavior is bounded by a user story, keep the story whole in one spec unless there is a strong domain reason to split it.

### Domain event naming (required)

- Domain events and backend-originated transport events must be named from the domain/resource point of view, not from the UI point of view.
- Do **not** use `ui:*` names for events emitted from backend systems, because those events are not owned by the UI.
- Prefer concrete resource/capability channels that match the established socket naming style, for example:
  - `agent:update`
  - `session:update`
  - `plan:update`
  - `terminal:started`
  - `show:open`
    Where: `agent`, `session`, `plan` - are the domain objects, that is part of Ubiquitous Language

- Avoid generic or vague channels when a concrete resource name is known, for example avoid:
  - `ui:update`
  - `ui:show`
  - `domain:event`
- Event names should make sense even if the current frontend is replaced, because the domain meaning survives UI changes.
- In specs, write the domain event names using the same ubiquitous language as the state model and commands.

### Tags convention (recommended)

- Add a `## Tags` section near the top of each `*.spec.md`
- Use searchable hashtags so specs can be found quickly with `rg`
- Tags should reflect DDD ubiquitous language and stable topics, for example:
  - `#flow-panel #session-flow #start-session #validation #ui-behavior`
- Prefer a small stable set over many one-off tags

### Spec Granularity Rule (important)

- Specs should capture behavior and important UX rules, not every micro visual tweak
- Specs should capture conceptual behaviors first, and only secondarily note which UI surfaces express them
- Prefer code-only changes (without spec edits) for minor polish such as:
  - exact centering/alignment
  - spacing tweaks
  - small color/weight refinements
- Update the spec when the change affects:
  - behavior/state transitions
  - interaction outcomes
  - accessibility expectations
  - stable UX rules that should be preserved
- Do not update a spec just to restate an already-covered rule from another owning spec.
- If the current change is only a concrete implementation of an existing conceptual rule, prefer code + tests without spec edits.

### Mapping block (required)

Each spec must list the relevant implementation files, because one behavior often spans multiple files.

Bi-directional traceability is mandatory:

- spec -> code: the spec must include these implementation paths (for example in `Code Paths` / mapping block)
- code -> spec: the primary implementation files/classes must include a `Spec: .../*.spec.md` backlink comment
- both directions must be updated together whenever code/spec ownership changes

Example:

- `libs/ai/ai-frontend/src/components/flow/flow.component.ts`
- `libs/ai/ai-frontend/src/components/flow/flow.component.html`
- `libs/ai/ai-frontend/src/components/app.component.ts`

Optional but recommended:

- add code comments linking back to the spec path in primary implementation files
- The mapping is intentionally many-to-one:
  - one spec can map to many implementation files
  - many files should still point back to one conceptual spec when they implement the same user-facing behavior

### Spec traceability in code (required)

- Every primary implementation class tied to a behavior spec must include a class doc comment that links back to the
owning `*.spec.md` file.
- This is required for ongoing traceability between behavior rules and implementation.
- This is the required second half of the bi-directional traceability contract (`spec -> code` and `code -> spec`).
- Keep the code comment link updated whenever the related spec changes or the implementation moves.
- Use a short `/** ... */` comment directly above the class declaration.
- Preferred pattern:
  - `/**`
  - ` * Spec: docs/specs/ai/AiAgents.spec.md`
  - ` */`
- If a file contains multiple major classes tied to different specs, each class should point to its own primary spec.
- If a class is only partially related to a spec, link the dominant spec and keep method-level comments only when needed for exceptions.

---

## Workflow Integration

This command is tied to dev workflow:

- For behavior/UI changes, run SDD before coding
- `coding` command should follow SDD for behavior changes
- `bug-fix` command should update the spec when the fix clarifies expected behavior

SDD complements (not replaces):

- DDD (domain modeling)
- TDD (tests)
  - test command reference: `../test/test.command.md`

Typical order for behavior work:

- **English Spec -> Unit Test -> Code (via `coding`) -> Verify**
- shorthand: **SDD -> TDD -> Code -> Verify**

---

## Roles selection

- design
- docs
- dev
- test

## Input

- user behavior request in English
- existing `*.spec.md` files (if any)
- related implementation files
- `<session-root>/<work-profile>/<session-id>/session-plan.md`

## Output

- updated/created `*.spec.md`
- aligned code changes
- verification notes/tests

## Session pointer

SDD guard and resync use the selected profile's
`<ai-profile>/<profile-id>/.local/work-session-state/.current-plan-path`
resolver, matching the session command. For `sc-dev`, the canonical profile is
`<workspace>/ai-profile/sc`. Bundle precedence is
`AI_PROFILE_BUNDLE_ROOT`, legacy `AI_CONFIG_BUNDLE_ROOT`, then `APP_ROOT` or
repository topology; SDD does not use a separate fallback pointer.
