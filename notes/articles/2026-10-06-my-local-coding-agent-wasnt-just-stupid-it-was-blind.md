---
title: "My Local Coding Agent Wasn't Just Stupid. It Was Blind."
subtitle: "Adding context and auxiliary reasoning helped. For UI work, the next missing capability may simply be sight."
author: Sergii Starodubtsev
date: "2026-10-06"
locale: en
status: draft
project: ai-fleas
commercial_objective: explore-ai-fleas
tags: [artificial-intelligence, ai-agents, local-models, hermes, computer-vision, ui-testing]
---

# My Local Coding Agent Wasn't Just Stupid. It Was Blind.

*Adding context and auxiliary reasoning helped. For UI work, the next missing capability may simply be sight.*

I spent two days watching a local coding agent build something I probably could have built myself in about the same amount of time.

It did produce useful work.

That is the problem.

“Can it produce useful work?” is too low a bar for an autonomous coding agent. If I spend the same two days correcting its turns, supplying missing knowledge, looking at the interface for it, and telling it what went wrong, I have not gained leverage. I have changed the interface through which I work.

The agent writes the code. I remain the reasoning system around it.

That experiment has been frustrating, but it has also become more interesting as I removed one limitation after another.

The coder by itself was close to useless.

Then I gave Hermes an auxiliary model to help with goal and context handling. It improved.

Then I improved expertise extraction and the information available to the worker. It improved again.

The largest jump came when I gave the coder a much larger practical context window. Suddenly it could keep far more of the repository, task, instructions, and recent work available at once. The difference was dramatic. A worker that had felt almost inert became capable of producing real changes.

But it was still expensive in the resource I care about most: my attention.

And after watching where the time actually went, I noticed something embarrassingly simple.

A large part of the work was UI work.

The agent could not see the UI.

## A developer working with the monitor turned off

Imagine asking a developer to change an interface while keeping the monitor off.

They can read the source. They can inspect CSS. They can run tests. They can read browser logs. They can reason about component state. They can even know that the application launched successfully.

But after changing a dialog, they cannot look at it and say:

**That is obviously wrong.**

A human developer gets that feedback almost for free. Change something, refresh, look.

My local coder did not.

Its loop was closer to:

**change → run → infer from code → guess → change again**

Eventually I would look at the screen, recognize the problem immediately, and explain it.

At that point I was not merely reviewing the agent. I was acting as one of its missing sensors.

That can create an absurd number of iterations.

A misplaced component may not require deeper reasoning. A clipped dialog may not require a larger language model. A responsive layout that obviously collapsed may not require another 30,000 tokens of context.

The worker may simply need to see what happened.

## Context made it less blind in one direction

This matters because I have already seen what happens when a missing capability is added around the same model.

Increasing context did not make the underlying coder more intelligent. It gave the coder a larger working desk.

The auxiliary model did not magically turn the coder into a frontier model either. It helped Hermes preserve goals and useful context around the worker.

Expertise extraction gave it more relevant information about the system it was modifying.

Each addition removed a class of unnecessary failure.

The model remained limited, but the system around it became less limited.

That is why I am interested in vision now.

Not because I expect a vision model to make my coder smarter.

I expect it to make some of its stupidity cheaper.

## Give the agent eyes

Today, for UI work, the loop often looks like this:

**Coder → change UI → run application → guess → continue → human looks → human redirects**

I want to try this instead:

**Coder → change UI → run application → screenshot → vision model → visual findings → Coder → fix → screenshot again**

The vision model does not need to write the application. It does not need the entire repository in context. It does not need to decide the architecture.

Its job can be much narrower:

- Is the expected component visible?
- Is anything clipped or overlapping?
- Does the rendered state match the requested state?
- Did the layout break at this viewport?
- Is the dialog positioned correctly?
- Did the previous fix actually improve the screen?

That is an interesting property of compound AI systems: the best next improvement is not necessarily a bigger general-purpose brain.

I had a related experience using agents at work. A relatively inexpensive model coordinated the task, sent simpler work to cheaper models, and escalated harder parts to a stronger model when needed. It kept the overall thread without forcing the smartest model to control every move.

That feels like an inversion of the usual architecture. The smartest brain does not necessarily have to control the dance. A cheaper coordinator can control the dance if it is capable enough to recognize when another kind of intelligence is needed.

The auxiliary capabilities around Hermes point in the same direction. Goal handling, context and expertise extraction, and potentially vision can behave like fast, specialized functions around the main worker. There is a loose connection here to the System 1 / System 2 architecture I have been exploring for the Personal Governor: keep common or bounded cognitive work cheap and specialized, and reserve deeper reasoning for the moments that deserve it. I do not want to push that analogy too far here. The practical point is simpler: intelligence can be composed.

Sometimes the useful architecture is not one model doing everything. It is another specialized capability connected at the right point.

## The metric is not whether vision works

I can already make a vision model describe a screenshot. That proves very little.

The experiment has one useful metric:

**How many times do I personally have to look at the UI and redirect the coding agent?**

If that number falls substantially, vision has created leverage.

If the coder still spends hours making bad architectural decisions, vision has not solved that problem. I should not pretend otherwise.

The underlying model still has a reasoning ceiling. I have seen it take wrong turns even when the necessary information was available. More pixels will not repair that.

But if a meaningful fraction of my interventions exist because the worker cannot observe the result of its own UI changes, removing those interventions matters.

A model does not have to become smarter for the system to become more useful.

## This changed how I think about local agents

I started these experiments asking a familiar question:

**Which local model is good enough?**

I am increasingly interested in a different question:

**What capabilities does the worker need around it before I can fairly measure how useful the model is?**

A coding benchmark can tell me something about a model.

A real coding agent has to operate inside a system: context management, tools, goals, domain knowledge, execution, observation, review, and feedback.

Remove one of those and the failure may look like model stupidity.

Sometimes it is model stupidity.

Sometimes the model is working with the equivalent of a monitor turned off.

AI Fleas is where I have been turning these experiments into explicit roles, workflows, and boundaries instead of treating an agent as one magical model call. The vision experiment is another version of the same idea: give a narrow responsibility to the component that can actually perform it, then measure the whole workflow by the amount of human attention it returns.

My local coder still has a long way to go before I would call it autonomous.

For UI work, though, I want to know how much of that distance is intelligence — and how much is simply blindness.
