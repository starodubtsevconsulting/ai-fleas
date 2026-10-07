---
title: "Who Is Optimizing Your Attention?"
previous_title: "Who Is Optimizing Your Attention?"
subtitle: "Online systems already learn what keeps you engaged. What if a private AI used the context you choose to share to keep your own goals in front of you instead?"
date: "2026-09-01"
version: 2
---

# Who Is Optimizing Your Attention?

*Online systems already learn what keeps you engaged. What if a private AI used the context you choose to share to keep your own goals in front of you instead?*

A surprising amount of software already knows how to compete for your attention.

It learns what you watch, what you click, when you are active, what interests you, and which notification is likely to bring you back.

That intelligence usually serves somebody else's objective: engagement, conversion, another click, another subscription, another purchase.

What if the same basic idea were inverted?

You choose the context to share with a private-enough AI. You also choose the objective: finish a project, improve your health, build financial independence, learn something, spend more time with people you care about.

Then instead of advertising another thing to buy, the system advertises **your own intentions back to you**.

At midnight it might tell you that the best thing for tomorrow's goals is to stop working and sleep. When you are exhausted, it might steer you toward work that requires less cognitive effort rather than pretending every hour is interchangeable. Over time, it can keep patterns and commitments visible when the immediate thing in front of you is trying to make you forget them.

The human still owns the goals. The interesting question is whether AI can help defend the attention required to follow them.

That is the role I now call the **Personal Governor** in AI Fleas.

Commercial personalization can be thought of roughly as:

`behavior/context model + corporation objective -> targeted commercial attention`

The inversion is:

`human-owned context model + human goal -> goal-directed human attention`

Same basic observation: context can help decide what should be put in front of someone next. Different owner of the
objective.

I have been calling this role the **Personal Governor** (earlier: **Personal Governor**). It sits above individual
workflows, can follow several human-owned goals across them, remembers broader context, and asks not only whether an
activity is worthwhile, but whether it is the right activity **now**.

The Governor is intentionally strongly human-facing. It is configured for a governed human, understands the workflows
inside its governance scope, and may use approved provider-neutral commands/capabilities to observe current reality. The
initial contract supports one governed human; multi-human governance is left as a future extension because it introduces
additional authority, consent, privacy, and conflicting-goal semantics.

The portable role contract is defined in
[`ai-workflows/_common/roles/personal-governor.md`](../../ai-workflows/_common/roles/personal-governor.md). It
follows the same profile-aware composition model as the rest of AI Fleas: reusable roles and commands stay provider-
agnostic, while the selected AI Profile supplies enabled workflows, registered commands, supported overrides, provider
bindings, project context, and other operational values. For example, the Governor may use the provider-neutral
`ticket-tracker` command without knowing whether the active profile resolves it to Jira, Trello, or another provider.

Another distinguishing trait is durable external memory: one or more configured, annotated memory references that survive
model sessions. A local Markdown/Obsidian directory is the simplest implementation, but the role contract remains
protocol-neutral so platform adapters can resolve filesystem, HTTP(S), repository, or other supported memory locations.

Maybe the useful personal AI is not the one that knows how to do everything for you. Maybe it is the one that remembers
what you asked your life to optimize for.
