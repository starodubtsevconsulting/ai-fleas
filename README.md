# AI Fleas

<p align="center">
  <img src="img/ai-flea-logo.png" alt="AI Fleas" width="700" />
</p>

## Why AI Fleas?

I remembered an old anecdote about a student preparing for a zoology exam. He had learned only one subject well: **fleas**.

Asked about a dog, he quickly got to its fur — and then to fleas. Asked about another animal, somehow the answer again ended up with fleas. Even when asked about a fish, he found a way back to fleas.

It feels a little like conversations today. It doesn't seem to matter much what people do — software, sales, art, finance, education. Sooner or later, somehow, everyone starts talking about AI.

**AI has become our fleas.**

Some may also hear **AI Fleas** as **AI fleets** — many AIs working together. That fits rather well too. [The original note about the name.](notes/2026-09-04-why-ai-fleas.md)

<p align="center">
  <img src="img/ai-fleas.png" alt="AI Fleas mascot" width="360" />
</p>

## What is inside

AI Fleas is a collection of reusable **configurations, workflows, roles, commands and conventions for working with AI agents across different harnesses** — ChatGPT/Codex, Claude Code, Hermes, local models and others.

Instead of designing the way you work from scratch for every platform, the project provides a common structure that can be adapted to whichever models, tools and runtimes you want to use. The agents may run in different places, but they can still follow the same roles, workflows and operating rules.

The diagram below shows the main pieces and how they fit together.

![AI Workflow Suite](img/ai_workflow_suite.png)

## How it can be useful

AI Fleas can be used as an entry point for setting up a structured way of working with AI agents without tying that setup too closely to one platform.

You can take the pieces you need, extend them, switch between hosted and local models, combine different harnesses, experiment with different agent arrangements, and keep your own profiles, project context and private configuration outside the public reusable definitions.

The goal is not to hide the differences between platforms. It is to keep the **way you organize the work portable**, while letting each harness or provider implement it in its own way.

## How do I start?

It depends on how far you want to take it. The simplest entry point does not require building another AI platform.

Start with the [example AI Profile](https://github.com/starodubtsevconsulting/ai-profile) and create your own profile from it. Then give that profile and this repository to the AI application you already use — for example ChatGPT/Codex or Claude Code — and ask it to initialize the setup for your environment.

Point it to the folder where your Agent/AI instruction files live and connect the project you want to work on through your profile. During initialization, the workflow, role and team rules are projected into the concrete Agents created for that platform. The result is your own configured AI team, ready to work against the project and tasks you provide.

For more advanced setups, the same definitions can be adapted to other harnesses such as Hermes or to locally hosted models. The harness changes; the profile, workflow concepts, role definitions, mappings and operating rules remain the common layer.

### For people who already build this stuff

**This is not another AI agent framework.** Agents, tools, workflows, MCP and many of the individual ideas here already exist in excellent systems, and that is expected.

What is public here is a deliberately selected **slice of a larger working system**: reusable patterns, architectural decisions, rules, commands, workflows, experiments, benchmarks and some of the reasoning behind them. It is the visible tip rather than the complete implementation.

**Do I actually use this? Yes.** What is published here is not a separate demo version. I use these workflows, roles, commands and conventions as an extension of my own proprietary AI platform.

That platform provides the runtime around them: managing agents and workflows, connecting them to my projects and **day-to-day tasks**, coordinating execution, memory, local-model workers, integrations, UI and other operational pieces. AI Fleas contains the reusable and portable layer that can also stand on its own outside that platform.

The public repository is therefore a deliberately selected **slice of a larger working system** rather than the complete implementation. The purpose is not to claim that every building block is new, but to make useful pieces and the thinking behind them visible, reusable and open to experimentation.

## Public collection

The main repository contains **AI Commands** and **AI Workflows** directly. **AI Profile** remains a separate example repository because profiles are configuration rather than part of the reusable command/workflow implementation.

This repository also contains shared reference material that does not belong to one implementation project, including **[local model and hardware benchmarks](notes/benchmarks/local-models/README.md)**.

## AI Workflow Suite vocabulary

These are the main building blocks used across the public collection.

| Term | Simple meaning | Reference |
| --- | --- | --- |
| **Command** | A reusable executable AI capability with a defined contract, inputs and outputs. | [AI Commands](ai-commands/) |
| **Workflow** | A reusable process for a kind of work. It defines roles, rules, collaboration and capabilities. | [AI Workflows](ai-workflows/) |
| **Flow / route** | The path work follows inside a workflow. | [AI Workflows](ai-workflows/) |
| **Role** | A reusable behavioral contract describing responsibilities, boundaries and lifecycle. | [Common roles](ai-workflows/_common/roles/) |
| **Agent** | A runtime participant that realizes a role with concrete configuration and identity. | [AI Workflows](ai-workflows/) |
| **Profile** | Personal or organization-specific configuration that activates workflows and supplies runtime policy. | [AI Profile](https://github.com/starodubtsevconsulting/ai-profile) |
| **Provider** | A concrete implementation behind a generic capability. | [AI Commands](ai-commands/) |

A useful mental model is:

`Profile -> Workflow -> Agents/Roles -> Flow -> Commands -> Providers -> Result`

## AI vocabulary

| Term | Simple meaning |
| --- | --- |
| **Agent** | A running AI participant with a model, context, rules and capabilities. |
| **Roster** | The current list of active agent instances. |
| **Harness** | Runtime machinery around a model: agent loop, sessions, tools, files, terminal, plugins, sub-agents, computer use, etc. |
| **Token** | A small piece of text a language model reads or produces. |
| **Context** | Information currently supplied to the model for a request/session. |
| **Context window** | Maximum amount of tokenized context a model can work with at once. |
| **Prompt** | An instruction or request given to the model. |
| **Tool / tool call** | A capability an agent can invoke outside its generated text. |
| **Memory** | Information preserved so it can be retrieved beyond immediate context. |
| **MCP** | Model Context Protocol: a common interface for exposing tools/resources to AI applications. |
| **Model** | The trained neural network doing language/reasoning work. |
| **Inference** | Running a trained model to process input and generate an answer/action. |
| **Quantization** | Storing model parameters with fewer bits so the model needs less memory. |

### Common harnesses

| Harness | What it is |
| --- | --- |
| Codex | OpenAI agent/coding environment |
| Claude Code | Anthropic agentic coding environment |
| Pi | Extensible agent harness / coding-agent toolkit |
| Hermes Agent | General-purpose extensible agent from Nous Research |

## Projects

### [AI Commands](ai-commands/)

Pluggable executable skills that combine AI-readable Markdown contracts with optional scripts, supporting code, configuration boundaries, reports, and command-owned visual tools.

### [AI Workflows](ai-workflows/)

Reusable business and work processes that coordinate commands and define the agent roles, rules, and collaboration needed to complete a workflow.

### [AI Profile](https://github.com/starodubtsevconsulting/ai-profile)

A sanitized example of personal or organization-specific context that activates workflows, configures commands, binds projects and supplies runtime preferences.

## Current status

AI Commands and AI Workflows live in this monorepo. AI Profile remains separate. Additional pieces are published when suitable for public use.