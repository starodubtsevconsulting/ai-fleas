# demo.command

## Purpose

Prepare a user-facing demo plan and walkthrough for recorded videos or live demonstrations.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Detailed command inputs | As documented below | User, workflow, profile, or artifact | Command-specific values and preconditions. |

Collect or infer these before drafting the final demo package:

- Audience: users, stakeholders, engineers, support, leadership, or mixed.
- Format: recorded video, live real-time demo, or both.
- Time box: target duration and hard stop.
- Feature/topic: what is being shown and what is out of scope.
- Environment and data: URLs, accounts, fixtures, feature flags, test data, and cleanup needs.
- Success criteria: what the audience should understand or be able to do after the demo.
- Risks: fragile flows, latency, auth, environment instability, data privacy, or open product gaps.

Ask only for missing inputs that would materially change the plan. Otherwise make conservative assumptions and mark them in the output.

## Outputs

| Output | Destination | Description |
|---|---|---|
| Detailed command outputs | Caller, configured artifact path, or authorized external system | Observable results, evidence, and effects documented below. |

- A demo plan and talk track in chat or a Markdown artifact when the user asks for a file.
- Any generated artifact should go under the active output directory when available, not an untracked project root file.

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `demo/demo.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

Committed configuration template: `demo/demo.command.example.config`. Copy it into the selected profile, set only supported command value overrides, reference the copied file through `commands[].config`, and let the host expose it as `AI_COMMAND_CONFIG_PATH`. The committed example is documentation and must never be used as operational configuration.

## Intent Mapping

Use this command when the user asks to:

- prepare a demo
- create a demo script
- plan a walkthrough
- rehearse a user demo
- prepare a recorded demo video
- prepare a live demo
- explain what to say at the beginning or end of a demo

## Show-Context Integration

Use `show-context` as the normal first step for demo preparation unless the user already supplied exact context. The
goal is to make the same docs, UI, screenshots, reports, and conversations visible to the operator before drafting the
talk track.

When demo prep needs several pages open, keep the browser context grouped: use one `show-context` call or one
`browser.command.sh` invocation with all URLs so the operator gets one browser window with multiple tabs, not separate
browser windows.

Default patterns:

```bash
${AI_COMMANDS_ROOT}/show-context/show-context.command.sh --project <label> --feature <topic> --open-links
${AI_COMMANDS_ROOT}/show-context/show-context.command.sh --see
${AI_COMMANDS_ROOT}/discussion/discussion.command.sh lookup-conversation --query "<topic>" --show
${AI_COMMANDS_ROOT}/discussion/discussion.command.sh current-conversation --summary --show
```

Use the rendered context to identify:

- the feature behavior and source of truth
- the UI/API path to demo
- examples and realistic data
- screenshots or visual proof points
- support/observability links when relevant
- limitations, rollout state, and risks

If repeated demo prep needs the same links or artifacts, update the feature doc `## Show Context` section through `doc`
so future `show-context --feature` calls find it directly.

## Output Format

Create a concise demo package with these sections:

1. `Demo Goal`
   - One or two sentences describing what the demo is about and who it is for.

2. `Audience And Setup`
   - Audience, format, time box, environment, credentials/data assumptions, and any pre-demo checks.
   - Include a `Context Used` line naming the docs, UI pages, screenshots, reports, or conversations opened through `show-context`.

3. `Opening Talk Track`
   - What to say at the beginning: context, problem, and what the viewer will see.
   - Keep it short; avoid implementation details until the audience knows why they should care.

4. `Problem And Value`
   - What problem this solves.
   - Why the existing/current approach is painful or incomplete.
   - What success looks like from the user perspective.

5. `Positioning And Alternatives`
   - How this solution differs from alternatives when alternatives are relevant.
   - Call out tradeoffs honestly: what this is optimized for and what it is not trying to solve.

6. `Walkthrough Plan`
   - Step-by-step path through the UI/API/workflow.
   - For each step include: action, expected result, talk track, and fallback if the environment misbehaves.
   - Prefer a realistic use case over a tour of every control.

7. `Examples And Use Cases`
   - Concrete scenarios that prove the feature matters.
   - Include at least one happy path and, when useful, one edge case or failure case.

8. `Code Walkthrough`
   - Include only when the audience or request calls for it.
   - Focus on architecture, domain rules, extension points, and tests; avoid reading code line by line.

9. `Closing Summary`
   - What to say at the end: recap the problem, solution, key proof points, and next step.

10. `FAQ`

- Likely questions and short answers.
- Include known limitations, rollout/availability, permissions, monitoring/support, and alternatives when relevant.

11. `Recording Or Live Checklist`

- For recorded demos: script timing, clean browser/profile, notifications off, zoom level, tabs preloaded, restart
point after mistakes, and retake notes.
- For live demos: backup data, screenshots/video fallback, links ready, observability/support tabs ready, and a
recovery line if something fails.

## Quality Bar

- Lead with audience value before feature mechanics.
- Keep the demo narrative problem-driven: problem -> solution -> proof -> recap.
- Use realistic data and examples; avoid toy examples unless the feature is abstract or dangerous to demo with real data.
- Make the first two minutes clear enough for a non-implementer to follow.
- Do not overpromise. Name limitations and rollout status plainly.
- Prefer one polished path over many shallow paths.
- Include operational readiness when relevant: permissions, observability, support handoff, and rollback/fallback.
- For recorded demos, optimize for clarity and pacing. For live demos, optimize for resilience and audience questions.

## Command Composition

Use related commands when needed:

- `projects` to resolve project registry context.
- `show-context` as the primary way to open docs, UI pages, reports, screenshots, local artifacts, and prepared context
before planning and rehearsal.
- `discussion lookup-conversation --show` or `discussion current-conversation --summary --show` when the demo depends
on Zoom/chat/current-meeting context.
- `doc` to update a durable feature doc, especially its `## Show Context` section, when the demo reveals missing
product explanation or missing recurring demo links.
- `browser` only for direct URL opening that does not need a rendered context handoff.
  When multiple direct URLs are needed, pass them together in one command invocation so they open as one browser window with tabs.
