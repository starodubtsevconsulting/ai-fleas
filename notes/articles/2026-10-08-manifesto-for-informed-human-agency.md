---
title: "Who’s in Control?"
subtitle: "An AI Fleas Manifesto for Informed Human Agency"
date: "2026-10-08"
status: draft
version: 2
---

# Who’s in Control?

*An AI Fleas Manifesto for Informed Human Agency*

AI can now produce work that people once had to understand in order to complete. It can design software, write the implementation, run tests, review changes, prepare a deployment, and present the result for approval.

The human sees a green checkmark, a persuasive explanation, perhaps a clean diagram, and clicks *Approve*.

What exactly was approved?

Sometimes the human knows. Sometimes the human knows the outcome but not the important assumptions behind it. And sometimes the approval has become a formality: a signature at the end of a process nobody has fully examined.

That is a troubling direction for a technology supposed to increase human capability.

**The more we delegate to AI, the more deliberately we must preserve our ability to understand and direct what matters.**

## Delegation must not become disappearance

Delegation is valuable precisely because it frees us from doing everything ourselves. We do not need to inspect every line of generated code, understand every infrastructure setting, or interrogate every suggestion.

But there is a difference between delegating *work* and delegating *judgment without realizing it*.

Consider a software team building a safeguard against charging a customer twice.

An AI agent implements the safeguard. Its tests pass. A second agent reviews the change. The human accepts the pull request.

Yet a consequential question remains unanswered: What happens when two payment requests arrive at almost the same moment? Or when the server fails halfway through processing?

A solution may work perfectly in the tested scenarios while leaving a dangerous edge case unresolved. The human need not become a database specialist. But someone in the chain of responsibility must surface the failure scenario, independently verify the design, and ensure the person accepting the change knows what risk remains.

If the team cannot answer the question, the right response is not a quiz for the human. It is more investigation.

This is why **technical acceptance and informed acceptance are not the same thing**.

## A principle for human-facing AI

Here is the principle we want AI Fleas to follow:

**Every agent exercising delegated responsibility must help preserve informed human agency within its scope and capabilities.**

By *informed human agency*, we mean the ability to understand consequential choices well enough to evaluate them, direct their execution, and remain accountable for their outcomes.

It does not require encyclopedic knowledge. It does not require a human to reproduce an agent's entire reasoning. It requires enough understanding to make the decision meaningfully one's own.

The depth of that understanding should depend on the consequences—not simply on how complicated the implementation looks.

A reversible experiment needs little ceremony. A security change, payment safeguard, production migration, or significant financial commitment deserves more scrutiny.

## It is not only about code

Imagine an AI assistant recommending a twelve-month service contract.

It compares vendors, lists benefits, and concludes that the subscription is worthwhile. Its reasoning sounds convincing, and the user agrees.

But perhaps the assistant never pointed out the cancellation terms, the full annual cost, or the possibility that the promised service will not deliver useful results.

The failure is not that the assistant recommended the contract. The failure is that it helped produce a decision without exposing material consequences.

A better assistant might say: *Before you commit, here are the two conditions most likely to change the decision.*

That short interruption protects the person's judgment. It need not become an examination, and it need not end in disagreement.

The same principle applies to personal planning, purchases, operations, and organizational decisions. In every case, the question is whether AI makes the human **more capable of directing the outcome**, or merely more comfortable accepting it.

## Governance cannot live in one super-agent

It would be tempting to create a powerful Personal Governor that watches everything, questions every decision, and grants permission to proceed.

That would solve one problem by creating another.

No single agent has enough context, expertise, or attention to supervise every domain. And a system that asks for permission at every step becomes slower without necessarily becoming safer.

Governance should be distributed.

In AI Fleas, an operational agent works within its domain. An independent reviewer challenges important assumptions. A workflow manager determines whether acceptance needs additional evidence. A Judge checks applicable governance rules within its delegated authority. The Personal Governor watches the larger picture: priorities, patterns, human capacity, and failures that cross domains.

Each level must take responsibility for the decisions within its reach.

When an agent cannot assess a consequential question, it should **say so and escalate to the nearest appropriate role**. A weak agent must not silently become the last line of defense merely because the workflow placed it there.

Higher-level governance should inspect the health of this process, not micromanage every technical detail.

## Challenge without becoming a bureaucrat

There is an equally real danger on the other side.

Imagine an assistant that cannot let someone make a routine choice without asking three questions to verify their understanding. It could turn going to the library, taking a walk, or trying a new study habit into an approval workflow.

That is not informed agency. It is friction masquerading as care.

The intervention must be proportionate.

For a low-consequence choice, proceed. For a meaningful but reversible decision, explain the main trade-off. For a consequential commitment, identify material assumptions and verify that the human can make an informed choice. If a question cannot be resolved at that level, escalate the uncertainty rather than pretending certainty.

A useful check might be a sentence, a diagram, or a single scenario question. It does not have to be a quiz.

And disagreement is not proof that the human lacks understanding. Someone may fully understand a risk and still choose to accept it within their authority.

**AI must support human judgment, not demand human compliance.**

## What responsible AI Fleas should do

This principle should appear throughout the system, not as a special personality trait of the Governor.

When an agent handles a consequential decision, it should be able to:

- Recognize what could materially go wrong.
- Separate essential consequences from safely delegable implementation details.
- Present the relevant uncertainty in language the human can use.
- Request independent verification when its own judgment is insufficient.
- Escalate unresolved concerns through existing roles.
- Preserve the human's authorized choice without hiding the risk.

The implementation belongs in reusable governance policies, strategies, and methods. Profiles select how those mechanisms apply. Memory retains important decisions and lessons—not every passing conversation or question.

We should start inside an existing workflow, test routine and high-consequence cases, and observe whether the method actually improves decisions. We should not invent a new bureaucracy before demonstrating the need.

## What success looks like

Success is not a higher count of approval gates.

It is a system in which routine work flows without constant interruption, important risks become visible before acceptance, and agents are willing to admit when they do not know enough.

It is a human who can delegate increasingly complex work without quietly surrendering the ability to direct it.

AI should be allowed to move quickly. It should help us accomplish things no individual could reasonably do alone.

But delegation must not become disappearance.

The choice is not between total human supervision and blind trust in automation. There is a third way: **informed delegation**, supported by agents that understand their responsibilities and the limits of their authority.

**AI can assume more work without silently diminishing meaningful human control.**
