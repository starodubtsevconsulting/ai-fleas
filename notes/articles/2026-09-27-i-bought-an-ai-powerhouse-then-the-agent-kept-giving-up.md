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

I hate having capacity I cannot quite unlock.

I remember this from when I was a student. I had an old pre-Pentium IBM-compatible computer — I think it was a 486-era machine. It ran at one speed, and I used it that way for years.

Later I sold it. The buyer opened the case, moved a few jumpers on the motherboard — those tiny plastic connectors that bridge pairs of pins — and suddenly the same machine ran dramatically faster. In my memory it was close to twice the speed.

I just stood there watching him.

The hardware had been mine the whole time. The extra capacity had been there the whole time. I simply had never figured out the configuration that unlocked it.

That experience stayed with me. Whenever I own something capable and suspect I am using only part of what it can do, it bothers me disproportionately. I start digging.

That is almost exactly how I feel about my ASUS Ascent GX10.

I bought it because I wanted serious local AI capacity. It has 128 GB of unified memory and can run coding models that do not fit on an ordinary workstation. On paper, this is exactly the kind of machine that should make local AI agents interesting.

The numbers around these models are easy to mix together, so I now try to translate them into something closer to a person.

Think of the model itself as the part of the brain that has already been shaped by years of education and experience. An “80B” model has roughly 80 billion learned parameters. Those parameters are not 80 billion stored facts. They are closer to learned wiring: patterns that affect what the model can recognize, connect, and produce.

Then there is **Q5**, or sometimes “4-bit” in other model names. That is not how educated the brain is. It is closer to how precisely that learned wiring is stored when I load the model onto my machine. Lower precision can make the model much smaller in memory, a little like keeping a compressed copy of something rather than the full-resolution original.

And **64K context** is something else again. I think of that as working memory: how much of the current conversation, code, instructions, tool results, and recent work the model can have “in mind” at once.

So a model can be highly educated but have a crowded desk. It can have a huge desk but work slowly. It can speak quickly without being more capable. These numbers describe different parts of the system.

I wrote a separate primer, [“What 27B, 4-Bit, and 64K Actually Mean in an AI Model”](https://medium.com/@sergii_96457/what-27b-4-bit-and-64k-actually-mean-in-an-ai-model-f43ea724c683), because I realized that throwing around numbers like 27B, Q5, and 64K assumes the reader already knows what kind of number each one is.

Then my coding agent kept giving up on assignments.

That was difficult to reconcile with the hardware. I had a machine people describe as an AI supercomputer, a coding model designed for agentic work, and an agent framework built to use tools. Yet a task that should have been ordinary could turn into a long loop, stop without finishing, or return something that still needed repair.

My first reaction was predictable: perhaps the model was not good enough.

I spent time testing that idea. I tried larger and newer local models. Some were slower. Some consumed much more memory. None gave me a convincing reason to replace my current Qwen3-Coder-Next Q5_K_M worker. I wrote about that experiment in [“I Tried to Replace My Local Coder. The Bigger Model Wasn't the Answer.”](2026-09-27-i-tried-to-replace-my-local-coder.md)

That left a more annoying possibility.

Maybe the model was only one part of the problem.

## The model is not the agent

My setup is not simply “Qwen running on a GX10.”

If Qwen is the brain, Hermes is closer to the executive layer around it. Hermes is an open-source AI agent program: instead of only chatting with a model, it can give the model tools and let it work through a task. It keeps the working session, decides what recent information stays in view, and keeps asking what to do next. The tools are the hands: read this file, edit that one, run a command, check the result.

The brain itself is not even running on the same machine. Hermes runs on my Mac. It talks over an OpenAI-compatible API to a llama.cpp server on the GX10, where Qwen actually runs.

So the path from “please fix this code” to a changed file is already a chain:

**assignment → Hermes on Mac → working memory + tools → API → llama.cpp on GX10 → Qwen → tool call → Hermes → filesystem**

![The model is not the agent: a local AI worker is shown as a stack from task to Hermes on Mac, API, llama.cpp on GX10, Qwen, tool calls, and final files or commands, with possible failure points at each layer.](assets/2026-09-27-model-is-not-the-agent-stack.png)

*Failures can happen at different layers — not only in the model.*

The speed of Qwen generating tokens is roughly the speed at which the brain can produce its next words. It says very little about whether the executive layer keeps the right information in working memory, whether the hands do what was intended, or whether the communication channel reports the right state.

And when one agent delegates to another, there is another layer around that.

That changed the debugging question.

Instead of asking, “Why is this model bad at coding?” I started asking, “At which layer does a working model turn into an unreliable agent?”

There was already evidence that mattered. The same Qwen Q5 model had passed a controlled Hermes file-tools test: read a file, transform it, write outputs, calculate checksums, and verify the result. So the model could use tools successfully in this environment.

The failures appeared more often on longer, messier assignments.

That contradiction was useful.

## One innocent-looking number was not doing what I thought

My Hermes profile advertised a 65,536-token context window for the Qwen coder.

Using the brain analogy, that is the size of the working-memory desk. But an agent does not want to wait until every square centimetre of the desk is covered before cleaning it.

Hermes can compress older context: roughly, take piles of old notes, summarize what still matters, and clear space for the next part of the job.

I had a compression threshold of `0.25`. Reading that casually, I expected Hermes to start cleaning the desk around one quarter of the window.

But current Hermes behavior is more nuanced. Its own context-compression documentation says models with context windows below 512K have a **75% minimum ratio threshold**. Hermes also supports an absolute `threshold_tokens` cap, which can force compaction earlier than that ratio would.

For a 65,536-token model window, 75% is roughly 49,000 tokens.

That is very different from the 16,000-ish number I thought I had configured.

So I proposed changing the shape of the configuration rather than shrinking the model itself:

- keep the model context at **65,536 tokens**;
- add an absolute Hermes compaction trigger at **32,768 tokens**;
- target a smaller retained context after compaction;
- preserve more of the most recent conversation.

This distinction matters. I was not proposing to serve Qwen with a 32K context. Hermes would still know the model had a 65K window; the proposed cap would ask the agent framework to clean up its working history earlier.

The public AI Fleas runtime did not support that profile setting yet, so I added the capability in [PR #219](https://github.com/starodubtsevconsulting/ai-fleas/pull/219). But adding a knob is not proof that turning it helps.

The short coding test never reached the proposed 32,768-token trigger. Its results could not tell me whether earlier compression helped coding. In a separate five-turn source-review trial, the proposed cap did fire, but Hermes spent about 53 seconds summarizing, remained above the cap, started summarizing again, and hit the turn's time limit without an answer. A higher cap completed but was slower than the old setting. That review task was not a coding-quality test, yet it gave me a clear reason **not to promote the early cap**. The live coder profile still uses its previous compression settings.

## Then there was the communication layer

Context was not the only moving part.

I had also been using A2A — basically a protocol for one AI agent to hand a task to another — between the hosted coordinator and the Hermes coder. Architecturally, I still like that boundary.

Operationally, I found an unpleasant lifecycle problem.

In one of my real coding experiments, the A2A task reached its timeout and was marked failed, but the underlying Hermes gateway continued working. It made another model call and wrote another file after the caller already believed the task had failed.

That is much worse than a slow answer. It means “failed” did not necessarily mean “stopped.”

A later matched experiment used Hermes CLI one-shot instead. It was not magically faster, but the process lifecycle was much easier to reason about. I could see whether the process was still alive, send a termination signal, and verify that it had exited.

So, for controlled Dev trials, I selected **CLI one-shot instead of A2A** in a still-open private configuration PR. A separate public launcher change makes the profile's turn limit apply, requires an explicit write boundary, and starts process-group cleanup after 240 seconds by default. Those controls make an overlong CLI run easier to stop and inspect; they do not make unfinished code correct.

That is not a verdict against A2A. It is a decision about the failure mode I can control today.

I had already been circling this idea in [“Should Your Hybrid AI Start in ChatGPT or Hermes?”](2026-09-26-should-your-hybrid-ai-start-in-chatgpt-or-hermes.md): communication between agents is not automatically the hard part. Sometimes the difficult part is knowing what is actually running, what context it has, and whether a reported state corresponds to reality.

## What the coding tests actually found

I needed to measure useful results, not just elapsed time. On a frozen text-recognition task, eight baseline assignments passed the independent verifier twice. Eight assignments with a precise reminder about which text representation preserved word boundaries passed all eight. Total Coder time also fell from about 319 to 243 seconds. That is a real improvement for **this task and this handoff**, with too few runs to claim a general model-speed setting.

The improvement did not carry over to a process-cleanup task. Four attempts with a clearer prompt still failed the independent checks. A later handoff spelling out the cleanup algorithm, followed by one correction based on verifier failures, produced an accepted fix. Porting it to the production helper passed the checks, but the agent spent nearly 144 seconds and kept patching after the useful edit was already present. A tighter six-turn cap made a small matched port task slower than the existing 20-turn setting.

The strongest lesson is less satisfying than finding the right jumper: the same local model can be useful with a precise handoff and review, while its agent loop can still waste time. The process deadline limits that waste. I have not demonstrated a general speed or coding-quality gain from the Hermes compression parameters.

## I have not touched the GX10 server yet

This may be the most important part of the experiment.

There are still plausible GX10-side causes: llama.cpp version, Qwen tool parsing, the exact GGUF artifact, cache configuration, memory headroom, and server flags.

I am deliberately not changing those yet.

If I change Hermes compression, the communication transport, llama.cpp, the model artifact, and the context size at the same time—and the agent improves—I will have learned almost nothing.

The completed comparisons changed the Mac/Hermes side first.

I recorded completion, compaction, unexpected writes, wall time, model calls, and whether the worker actually stopped. The remaining long-context question needs a repeatable coding task that compacts and still produces independently checked code; a read-only review run cannot answer it.

The server is still a separate experiment. I will change it only with a coding failure that points there and a fixed comparison to test that hypothesis.

## The expensive lesson

The GX10 may still turn out to be exactly the machine I wanted.

But “powerful local AI hardware” and “reliable local AI worker” are not the same product.

The useful worker is the whole chain:

**hardware + inference runtime + model + working memory + tool parser + agent framework + communication + task design + verification**

In human terms, that is closer to asking about the whole worker: the brain, what is currently in mind, how quickly thoughts can be expressed, the hands, the instructions, the communication channel, and whether somebody checks the result.

A benchmark can tell me that a model generates 50 tokens per second.

It cannot tell me whether my coding agent will spend seven minutes writing the wrong helper file after its parent task has already failed.

That is the part I am learning now.

The model matters. The hardware matters.

But once AI starts doing real work, the plumbing becomes part of the intelligence.

And apparently, I bought the powerhouse before I understood the plumbing.

Which is why I keep digging. I have seen this movie before: sometimes the missing performance is not another piece of hardware. Sometimes it is a jumper you never knew you had to move.

---

## Sources and provenance

This is a living draft based on the author's September 2026 GX10/Hermes experiments. Matched short coding runs and process-lifecycle checks support the narrow claims above. The proposed early compression cap was removed from the private configuration PR after its long-context review regression; no accepted long-context coding comparison has demonstrated a compression benefit.

The model-number primer is published as [“What 27B, 4-Bit, and 64K Actually Mean in an AI Model”](https://medium.com/@sergii_96457/what-27b-4-bit-and-64k-actually-mean-in-an-ai-model-f43ea724c683). The earlier model-selection experiment is described in [“I Tried to Replace My Local Coder. The Bigger Model Wasn't the Answer.”](2026-09-27-i-tried-to-replace-my-local-coder.md), and the hybrid coordination design in [“Should Your Hybrid AI Start in ChatGPT or Hermes?”](2026-09-26-should-your-hybrid-ai-start-in-chatgpt-or-hermes.md). Controlled GX10 measurements and Hermes lifecycle observations are preserved in the public [GX10 benchmark record](../benchmarks/local-models/gx10.md) and the [Hermes Qwen runtime trial](../benchmarks/local-models/gx10-hermes-qwen-coder-runtime-2026-09-28.md). [AI Fleas PR #219](https://github.com/starodubtsevconsulting/ai-fleas/pull/219) added absolute compression-cap support; draft [PR #225](https://github.com/starodubtsevconsulting/ai-fleas/pull/225) carries the runtime controls and benchmark evidence.

Hermes's current [context compression documentation](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/context-compression-and-caching.md) documents the small-context 75% threshold floor and the `compression.threshold_tokens` absolute cap. The profile-specific configuration and machine topology remain private.
