---
title: "My Local Coding Agent Wasn't Just Stupid. It Was Blind."
subtitle: "A coding model can produce code and still fail to save time. I am testing which missing capabilities turn a model into a useful agent."
author: Sergii Starodubtsev
date: "2026-10-06"
locale: en
status: draft
project: ai-fleas
commercial_objective: explore-ai-fleas
intended_reader: engineers, architects, technical founders, and practitioners building local or hybrid AI agents
tags: [artificial-intelligence, ai-agents, local-models, hermes, computer-vision, ui-testing]
---

# My Local Coding Agent Wasn't Just Stupid. It Was Blind.

*A coding model can produce code and still fail to save time. I am testing which missing capabilities turn a model into a useful agent.*

I spent two days watching a local coding agent build something I probably could have built myself in about the same amount of time.

It did produce useful work.

That is the problem.

“Can it produce useful work?” is too low a bar for an autonomous coding agent. If I spend the same two days correcting its turns, supplying missing knowledge, looking at the interface for it, and telling it what went wrong, I have not gained leverage. I have changed the interface through which I work.

The agent writes the code. I remain the reasoning system around it.

That distinction is becoming the real subject of this experiment. A coding benchmark can tell me whether a model can produce code. It cannot tell me whether an agent built around that model gives me back time. For anyone building local or hybrid agents, I think that is the more useful question.

I am not doing this because I expect local models to replace hosted models tomorrow.

I keep running into a more practical problem: I can exhaust my hosted AI allowance while there is still work to do. When that happens, I want a backup path that is actually usable. It does not have to beat the strongest hosted model. It has to let me continue working without turning me into a full-time supervisor of the machine.

And there is a funny psychological effect once the hosted tokens are gone. The fight for what suddenly feels like “free tokens” becomes much more intense. The local machine is already sitting there. Every useful token it can produce feels like capacity I own and should be able to unlock. When the hosted option is temporarily unavailable, the motivation to make that local capacity work becomes considerably stronger.

That is why I keep fighting with this setup even when the economics of my attention tell me to stop. I have the local hardware. I have the agent framework. I can see pieces of the system improving. Each time I remove one bottleneck, I want to know whether the next one is the thing standing between an expensive experiment and a useful fallback.

So far, that fight has been frustrating. I have removed one limitation after another and still have not crossed the line where I would call the local coder good enough.

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

That is an interesting property of compound AI systems: the best next improvement is not necessarily a bigger general-purpose brain. The practical engineering problem is to identify which capability is actually causing the human to remain in the loop.

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

I started these experiments asking the same question many people ask when evaluating local AI:

**Which local model is good enough?**

I am increasingly interested in a different question:

**What capabilities does the worker need around it before I can fairly measure how useful the model is?**

A coding benchmark can tell me something about a model.

A real coding agent has to operate inside a system: context management, tools, goals, domain knowledge, execution, observation, review, and feedback.

Remove one of those and the failure may look like model stupidity.

Sometimes it is model stupidity.

Sometimes the model is working with the equivalent of a monitor turned off.

This is also the problem I am using AI Fleas to explore: turning these missing capabilities into explicit roles, workflows, and boundaries instead of treating an agent as one magical model call. The vision experiment is another version of the same idea: give a narrow responsibility to the component that can actually perform it, then measure the whole workflow by the amount of human attention it returns.

I am not trying to prove that this local coder can replace the hosted models I use. Right now, it cannot. After two days of babysitting it through work I could probably have done myself in roughly the same time, calling it a replacement would be absurd.

What I want is resilience: when hosted tokens run out, I want another lane I can move into without losing the day. The auxiliary model helped. Better expertise and context helped. A much larger context window helped the most. None of them made the underlying coder smart enough.

Vision is the next fight because UI blindness appears to be responsible for a surprising number of wasted iterations. If giving the system eyes removes enough of those iterations, the local stack may become a useful backup even while remaining clearly weaker than the hosted one.

My local coder still has a long way to go before I would call it autonomous.

For UI work, though, I want to know how much of that distance is intelligence — and how much is simply blindness.

At this point, I sometimes feel I could write a couple of books about everything I have tried to make local agents useful. I am only half joking. If these experiments can save someone interested in the same path a few weeks, a pile of tokens, or a few thousand dollars in hardware experiments, then perhaps all this struggle is becoming useful expertise after all.
