# Who Is Optimizing Your Attention?

**September 1, 2026**

We already allow systems to build surprisingly detailed models of us: what we watch, where we go, what interests us,
when we are active, and increasingly even signals from devices we wear.

Most of that intelligence is useful because somebody has an objective for it. Usually that objective is not ours. It may
be engagement, conversion, another click, another subscription, another purchase.

What if the same idea were inverted?

Instead of giving all that context only to systems trying to decide what to put in front of us next, we could give the
context we choose to share to a private-enough agent whose objective is explicitly ours.

You tell it what you want: finish a project, improve your health, build financial independence, learn something, spend
more time with people you care about. Then it remembers those goals when you conveniently do not.

Instead of advertising another thing to buy, it advertises **your own intentions back to you**.

At midnight it might tell you that the best thing you can do for tomorrow's goals is stop working and sleep. The next day,
if you are exhausted, it might suggest work that requires less cognitive effort instead of pretending every hour of the
day is interchangeable. Over months it can learn patterns you repeatedly forget about yourself.

The point is not to let an agent decide what your goals should be. The human owns the goals. The human can change, pause,
replace or delete them. But while a goal is active, the agent keeps it present when deciding what deserves attention now.

There is something almost Stoic about that. The problem is often not that we do not know what matters. The problem is
that the immediate thing in front of us is very good at making us forget.

Commercial personalization can be thought of roughly as:

`behavior/context model + corporation objective -> targeted commercial attention`

The inversion is:

`human-owned context model + human goal -> goal-directed human attention`

Same basic observation: context can help decide what should be put in front of someone next. Different owner of the
objective.

I have been calling this role the **Cross-Workflow Governor** (earlier: **Global Governor**). It sits above individual
workflows, can follow several human-owned goals across them, remembers broader context, and asks not only whether an
activity is worthwhile, but whether it is the right activity **now**.

The Governor is intentionally strongly human-facing. It is configured for a governed human, understands the workflows
inside its governance scope, and may use approved capabilities such as calendars, task systems, repositories, or metrics
to observe current reality. The initial contract supports one governed human; multi-human governance is left as a future
extension because it introduces additional authority, consent, privacy, and conflicting-goal semantics.

The portable role contract is defined in
[`_common/roles/cross-workflow-governor.md`](../_common/roles/cross-workflow-governor.md). Another distinguishing trait is
durable external memory: one or more configured, annotated memory references that survive model sessions. A local
Markdown/Obsidian directory is the simplest implementation, but the role contract is deliberately protocol-neutral so
platform adapters can resolve filesystem, HTTP(S), repository, or other supported memory locations.

Maybe the useful personal AI is not the one that knows how to do everything for you. Maybe it is the one that remembers
what you asked your life to optimize for.
