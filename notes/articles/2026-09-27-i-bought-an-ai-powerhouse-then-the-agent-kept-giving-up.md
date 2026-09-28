---
title: "I Bought an AI Powerhouse. Then the Agent Kept Giving Up."
subtitle: "What tuning Hermes around a local Qwen coder taught me about the layers between a model and useful work."
author: Sergii Starodubtsev
date: "2026-09-27"
locale: en
status: draft
tags:
  - artificial-intelligence
  - ai-agents
  - local-models
  - hermes
  - qwen
  - hybrid-ai
---

# I Bought an AI Powerhouse. Then the Agent Kept Giving Up.

*What tuning Hermes around a local Qwen coder taught me about the layers between a model and useful work.*

I bought an ASUS Ascent GX10 because I wanted serious local AI capacity.

It has 128 GB of unified memory. It can run coding models that do not fit on an ordinary workstation. On paper, this is exactly the kind of machine that should make local AI agents interesting.

Then my coding agent kept giving up on assignments.

That was difficult to reconcile with the hardware. I had a machine people describe as an AI supercomputer, a coding model designed for agentic work, and an agent framework built to use tools. Yet a task that should have been ordinary could turn into a long loop, stop without finishing, or return something that still needed repair.

My first reaction was predictable: perhaps the model was not good enough.

I spent time testing that idea. I tried larger and newer local models. Some were slower. Some consumed much more memory. None gave me a convincing reason to replace my current Qwen3-Coder-Next Q5_K_M worker. I wrote about that experiment in [“I Tried to Replace My Local Coder. The Bigger Model Wasn't the Answer.”](2026-09-27-i-tried-to-replace-my-local-coder.md)

That left a more annoying possibility.

Maybe the model was only one part of the problem.

## The model is not the agent

My setup is not simply “Qwen running on a GX10.”

Hermes runs on my Mac. It keeps the agent session, decides what context the model sees, exposes tools, and manages the work loop. Hermes talks over an OpenAI-compatible API to a llama.cpp server on the GX10. The model then produces text and tool calls, which have to survive the trip back through the server, parser, Hermes, and whatever transport I use between agents.

A simplified version looks like this:

**assignment → Hermes on Mac → context + tools → API → llama.cpp on GX10 → Qwen → tool call → Hermes → filesystem**

And when one agent delegates to another, there is another layer around that.

That changed the debugging question.

Instead of asking, “Why is this model bad at coding?” I started asking, “At which layer does a working model turn into an unreliable agent?”

There was already evidence that mattered. The same Qwen Q5 model had passed a controlled Hermes file-tools test: read a file, transform it, write outputs, calculate checksums, and verify the result. So the model could use tools successfully in this environment.

The failures appeared more often on longer, messier assignments.

That contradiction was useful.

## One innocent-looking number was not doing what I thought

My Hermes profile advertised a 65,536-token context window for the Qwen coder.

I also had a compression threshold of `0.25`. Reading that casually, I expected Hermes to start compacting the conversation around one quarter of the window.

But current Hermes behavior is more nuanced. Its own context-compression documentation says models with context windows below 512K have a **75% minimum ratio threshold**. Hermes also supports an absolute `threshold_tokens` cap, which can force compaction earlier than that ratio would.

For a 65,536-token model window, 75% is roughly 49,000 tokens.

That is very different from the 16,000-ish number I thought I had configured.

So I changed the shape of the configuration rather than shrinking the model itself:

- keep the model context at **65,536 tokens**;
- add an absolute Hermes compaction trigger at **32,768 tokens**;
- target a smaller retained context after compaction;
- preserve more of the most recent conversation.

This distinction matters. I am not serving Qwen with a 32K context. Hermes still knows the model has a 65K window. I am simply asking the agent framework to clean up its working history earlier.

The public AI Fleas runtime did not support that profile setting yet, so I added it in [PR #219](https://github.com/starodubtsevconsulting/ai-fleas/pull/219).

## Then there was the communication layer

Context was not the only moving part.

I had also been using A2A between the hosted coordinator and the Hermes coder. A2A gives separate systems a structured way to exchange tasks. Architecturally, I still like that boundary.

Operationally, I found an unpleasant lifecycle problem.

In one of my real coding experiments, the A2A task reached its timeout and was marked failed, but the underlying Hermes gateway continued working. It made another model call and wrote another file after the caller already believed the task had failed.

That is much worse than a slow answer. It means “failed” did not necessarily mean “stopped.”

A later matched experiment used Hermes CLI one-shot instead. It was not magically faster, but the process lifecycle was much easier to reason about. I could see whether the process was still alive, send a termination signal, and verify that it had exited.

So, for now, I changed my normal coding delegation route from **A2A to CLI one-shot**.

That is not a verdict against A2A. It is a decision about the failure mode I can control today.

I had already been circling this idea in [“Should Your Hybrid AI Start in ChatGPT or Hermes?”](2026-09-26-should-your-hybrid-ai-start-in-chatgpt-or-hermes.md): communication between agents is not automatically the hard part. Sometimes the difficult part is knowing what is actually running, what context it has, and whether a reported state corresponds to reality.

## I have not touched the GX10 server yet

This may be the most important part of the experiment.

There are still plausible GX10-side causes: llama.cpp version, Qwen tool parsing, the exact GGUF artifact, cache configuration, memory headroom, and server flags.

I am deliberately not changing those yet.

If I change Hermes compression, the communication transport, llama.cpp, the model artifact, and the context size at the same time—and the agent improves—I will have learned almost nothing.

So the current experiment changes the Mac/Hermes side first.

Then I will rerun the same bounded coding assignments and look at completion, compaction, unexpected writes, wall time, and whether the worker actually exits when it says it is done.

If the failures remain, I move one layer deeper and tune the GX10 server.

## The expensive lesson

The GX10 may still turn out to be exactly the machine I wanted.

But “powerful local AI hardware” and “reliable local AI worker” are not the same product.

The useful worker is the whole chain:

**hardware + inference runtime + model + context policy + tool parser + agent framework + transport + task design + verification**

A benchmark can tell me that a model generates 50 tokens per second.

It cannot tell me whether my coding agent will spend seven minutes writing the wrong helper file after its parent task has already failed.

That is the part I am learning now.

The model matters. The hardware matters.

But once AI starts doing real work, the plumbing becomes part of the intelligence.

And apparently, I bought the powerhouse before I understood the plumbing.

---

## Sources and provenance

This is a living draft based on the author's September 2026 GX10/Hermes experiments. The current tuning changes have been prepared but have not yet completed the same post-change real-task validation, so they are described as an active experiment rather than a proven fix.

The earlier model-selection experiment is described in [“I Tried to Replace My Local Coder. The Bigger Model Wasn't the Answer.”](2026-09-27-i-tried-to-replace-my-local-coder.md), and the hybrid coordination design in [“Should Your Hybrid AI Start in ChatGPT or Hermes?”](2026-09-26-should-your-hybrid-ai-start-in-chatgpt-or-hermes.md). Controlled GX10 measurements and Hermes lifecycle observations are preserved in the public [GX10 benchmark record](../benchmarks/local-models/gx10.md). The executable public change that adds an absolute Hermes compression cap is [AI Fleas PR #219](https://github.com/starodubtsevconsulting/ai-fleas/pull/219).

Hermes's current [context compression documentation](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/context-compression-and-caching.md) documents the small-context 75% threshold floor and the `compression.threshold_tokens` absolute cap. The profile-specific configuration and machine topology remain private.
