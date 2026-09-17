# The New Way of Work Starts With Rules

The first time I help someone move beyond casual AI chat, I usually hit the same problem.

They have already used AI.

They have asked questions. Written emails. Summarized things. Maybe generated a presentation.

Then, sooner or later, they say some version of:

> I already told it that.

That sentence is where AI adoption gets interesting.

The problem is often not that the AI cannot follow a rule.

The problem is that the rule lived in yesterday's conversation.

So I have started explaining a different way of working with AI. It begins with something surprisingly old-fashioned:

**write the rules down.**

## Give the AI a front door

Imagine someone comes to stay in your house.

You probably have a few rules.

Leave your shoes here. Wash your hands. Don't let the dog out. Be polite to the neighbours.

You would not explain the architecture of the house first. You would give them the small set of rules they need when they walk through the door.

An AI workspace needs something similar.

In software-agent tools this is often an `AGENTS.md` file or an equivalent instruction file. The name is less important than the job.

I think of it as the **front door**.

It tells the AI how to behave when it enters this workspace: where things are, which rules outrank others, what a phrase means here, what it may change, and what it must not assume.

Then the rest of the house can have rooms.

A work profile can contain work-specific context and rules. A personal profile can contain different ones. A workflow folder can describe how a recurring activity is done. One workflow might be sales preparation. Another might be writing. Another might be bookkeeping.

You do not need to teach the AI your whole life every morning.

You teach it how to find the right rules.

## Why not just put the rules in Google Drive?

That is a reasonable question.

You can store text almost anywhere: Google Drive, OneDrive, Dropbox, a wiki, a notes application.

But rules are different from documents you occasionally open and read.

The AI may need them constantly.

So I prefer the working copy to be **local**: ordinary small text files sitting beside the work they govern.

They open immediately. They still exist when connectivity is poor. An agent does not need a cloud round trip just to discover how it is supposed to behave. And the rule system does not depend on a synchronization client continuously noticing and propagating tiny changes.

Cloud storage is excellent for many things. I just don't think every read of a basic operating rule needs to be a cloud-storage problem.

Local does not mean unshared or unprotected.

That is where Git becomes useful.

## Rules become much more useful when they have history

This is where I introduce Git, even to someone who has no intention of becoming a software developer.

Not because everyone needs to learn programming.

Because rules change.

Today you tell the AI:

> Always summarize a customer call after the meeting.

Next week you realize that is not enough:

> Summarize the call, extract commitments, and put follow-ups into the task system.

Later you discover that some follow-ups should not be created automatically.

That is not a random chat history anymore. It is the evolution of a working system.

Git gives that evolution a very simple property: **every meaningful change can have a name and a history.**

The working loop can stay small:

```text
change locally -> try it -> keep improving -> commit when meaningful -> push when ready
```

The important distinction is that **editing and publishing are not the same operation**.

Your local rules can change while you work. When a change becomes established enough to keep, commit it. When it is ready to share or preserve remotely, push it.

You do not need every keystroke continuously synchronized somewhere merely because synchronization exists.

If the new rule was stupid, Git also tells you exactly what changed.

This is version control applied not only to code, but to **how you work with AI**.

And surprisingly, that idea is not particularly technical.

Everyone's life already contains rules.

How you prepare for a customer meeting. How you write. How you organize expenses. What the AI may do automatically. What it must ask before doing. What "prepare this" means when *you* say it.

Software developers happened to build very good machinery for changing rules carefully because software is full of them.

There is no reason they should be the only people who benefit from it.

## Then the folders stop looking like folders

At first, a structure like this can look unnecessarily technical:

```text
AGENTS.md
profiles/
  work/
  personal/
workflows/
  sales/
  writing/
  bookkeeping/
```

But the folders are not the point.

The point is separation.

The AI should not need your bookkeeping rules when helping prepare a sales call. Your personal routines should not accidentally become instructions for a work project. A writing workflow should be reusable without copying it into twenty chats.

Gradually, those files become an external operating system for the relationship between you and AI.

Not one giant prompt.

Not one magical agent.

A collection of small rules that improve as you discover what actually works.

## This is where adoption starts for me

I used to think AI adoption mostly meant learning what the models could do.

I increasingly think that is only the first stage.

The bigger change happens when you stop treating every conversation as a fresh conversation.

You start building continuity.

A rule survives the chat where you invented it.

A workflow improves after it fails.

A profile lets the same AI behave differently in different parts of your life.

A commit tells you when and why the system changed.

And eventually you stop saying:

> I already told you that.

because the important things are no longer something you merely **told** the AI.

They are part of the system you built around it.

That is what I mean by a **new way of work**.

It does not begin with autonomous agents replacing everyone.

It begins much more quietly:

**one useful rule that does not disappear when you close the chat.**

---

If you want to see what happens when those rules start governing the day itself, the companion article is [I Asked AI to Plan My Day. It Told Me to Go Back to Bed.](2026-09-17-what-if-ai-planned-your-day.md)
