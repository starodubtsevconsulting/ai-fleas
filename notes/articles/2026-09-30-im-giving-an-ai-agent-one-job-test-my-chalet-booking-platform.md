# I’m Giving an AI Agent One Job: Test My Chalet Booking Platform Every Day

*The payment flow kept failing in small, inconsistent ways. Fixing it was only the first step.*

I built a chalet-booking platform for myself.

The simplest way to describe it is that it is something like Airbnb, but smaller, independent, and designed around the way I actually want to run a chalet business in Canada.

It started with my own property. Over time, I want it to become a multi-chalet, multi-owner platform. Other chalet owners could add their properties and use it as another way to reach guests.

I do not expect it to replace Airbnb or Booking.com. Those platforms are useful for discovery and for finding new customers. But after someone has stayed at a chalet and built a relationship with the owner, the next booking does not always need to go through the same global marketplace.

A locally built Canadian platform could become a second channel—especially for returning guests.

That was the vision.

Then I had to make the payment flow reliable.

## The most important path was not consistent

The booking experience could look fine while the most important part still failed in small ways.

Sometimes the payment path worked. Sometimes a detail around the checkout, saved payment method, confirmation, price, or cleanup caused trouble. The failures were not always dramatic, and they were not always identical.

That inconsistency made the problem harder.

If a page is completely broken, it is obvious. If a payment path works most of the time, it is easy to tell yourself that the latest successful run proves the problem is gone.

It does not.

For a booking platform, payment is not just another feature. It is the point where a guest’s intention becomes a real reservation and real money changes hands. If that step is unreliable, everything before it is only a demo.

So I fixed the issues I could find and wrote down a testing strategy.

But I did not want the strategy to end as a checklist that I would run manually for a few days and then forget.

I wanted someone—or something—to own it.

## I decided to create a digital QA agent

My next step is to dedicate an AI agent to this job.

Its responsibility is simple to state: every day, prove that the essential booking and payment journey still works.

That does not mean asking a language model to click around randomly. It means creating a bounded digital QA role with a clear scenario, a known environment, spending limits, locks, verification steps, cleanup requirements, and evidence from every run.

The agent will work in a hybrid environment. Some parts can run locally. Some checks need the browser. Some evidence comes from the application, and some comes from the payment provider. Deterministic automation can handle the stable path, while an AI agent can investigate when the interface or behavior changes.

I think of it as a junior QA engineer with an unusually strict operating manual.

It can execute. It can observe. It can diagnose. It can repair a brittle test when the intended customer journey has not changed.

It cannot quietly redefine success.

## The English scenario is the source of truth

The test begins with a Markdown file.

That file explains the workflow in plain language:

- which application and environment to open;
- which test account to use;
- what state must exist before the test;
- how to search, select, book, and pay;
- how much the live test is allowed to spend;
- how to verify the charge;
- how to verify the booking inside the platform;
- how to refund or reverse the test where required;
- how to restore any changed price or data;
- and which uncertainties require the agent to stop.

Playwright can still perform the browser steps. When the interface is stable, scripted automation is faster and more repeatable than asking an AI to rediscover every button.

But the Playwright script is not the ultimate authority.

The Markdown scenario describes what the test means.

That distinction matters because interfaces change. A button gets renamed. A dialog moves. A selector stops matching. Traditional browser automation often reports a failure without understanding whether the product failed or only the script became stale.

The digital QA agent can compare the current interface with the intended workflow. If the customer journey still makes sense, it can repair the automation. If the journey itself changed, it can stop and report that the test contract needs a human decision.

## The agent needs real limits around real money

Testing a live payment flow is valuable because it crosses the boundaries that mocks do not.

It is also the part that needs the strongest controls.

The current strategy includes:

- a hard ceiling of CAD 1.00 for a live test purchase;
- a durable lock so two agents cannot run the same payment scenario at once;
- a persistent record of attempts and spending;
- more frequent tests in the sandbox than in production;
- a strict limit on live production attempts;
- verification in both the booking platform and the payment provider;
- cleanup and refund checks;
- restoration of any temporary price;
- and an immediate stop when identity, payment, or rollback state is unclear.

The working idea is to allow sandbox testing several times per day and one tightly controlled live attempt in a rolling 24-hour period. That production cadence should remain conditional on the locks, recovery process, and monitoring being reliable.

The goal is unattended testing, not unattended spending.

## One Smoke Tester can cover several products

While designing this, I realized the role should not belong only to the chalet platform.

I maintain several projects. Each one has an important path that should be checked regularly. Instead of creating a completely different agent for every product, I can define one reusable **Smoke Tester** role and authorize it for a selected group of projects.

Each product keeps its own scenario close to its code. The agent knows where to discover that scenario, how to acquire the correct lock, what evidence it must keep, and when to move to the next project.

The responsibilities separate naturally:

- the product repository owns the application-specific `SMOKE.md` and optional Playwright implementation;
- the public AI workflow repository owns the reusable Smoke Tester role, safety rules, and evidence contract;
- the private platform configuration owns the real projects, runner, accounts, schedules, credentials, and notification settings.

That division is important. The public role can explain how a safe tester behaves without exposing private infrastructure. The product can describe its own customer journey without knowing how every future agent will be hosted. The private configuration can change runners or schedules without rewriting the meaning of the test.

## This is not conventional test automation

I am not trying to replace good deterministic tests with an AI that improvises everything.

Unit tests, integration tests, and Playwright flows still matter. They are fast, precise, and repeatable.

The AI agent sits above them.

Its job is to run the full scenario, understand the intended outcome, inspect the evidence, and take responsibility for the gap between a hardcoded script and a changing real application.

When the script works, the agent should use it.

When it fails, the agent should not immediately rewrite the test until it turns green. It should first ask:

1. Did the product break?
2. Did the test environment drift?
3. Did the account or test data become invalid?
4. Did the interface change while the intended workflow stayed the same?
5. Is cleanup still safe?

Only then should it repair the appropriate layer.

That is why I call it a digital QA agent rather than an AI browser bot.

## The intelligence should expand only when the problem demands it

For most runs, very little intelligence should be necessary.

If the interface is familiar, the account is ready, the scripted journey works, the expected records appear, and cleanup succeeds, the agent can stay in a low-cost execution mode. It can run the existing mechanics, capture the evidence, and move on.

There is no reason to spend maximum reasoning effort rediscovering a healthy checkout every hour.

The interesting part begins when something goes wrong.

A traditional pipeline usually turns red. It may identify the step or selector that failed, but the investigation still lands on a human. If the test has become outdated, it can remain red for days until everyone learns to ignore it.

The Smoke Tester should respond differently. It can increase the level of intelligence it uses and begin a bounded diagnosis:

- inspect the current page rather than relying only on the failed selector;
- compare the observed journey with the Markdown contract;
- inspect application and payment evidence;
- create a temporary diagnostic or automation script when that is the fastest safe tool;
- identify whether the fault belongs to the product, environment, test data, or test implementation;
- open a ticket with the evidence and a reproducible explanation;
- notify the owner when a decision or risky action is required;
- or delegate a code correction to the authorized development agent.

With the right permissions and release controls, a later version could carry a verified correction through testing and deployment. That does not mean the QA agent should receive unlimited production authority. It means the workflow can hand the problem to the role that owns the next action, preserve the evidence, and follow the repair until the critical journey is healthy again.

This is the self-healing mechanism I have in mind.

It does not force a broken test to pass. It heals the testing system when the mechanics have drifted, routes real product defects to the right owner, and keeps the human informed when the system reaches a boundary it should not cross alone.

The level of intelligence becomes elastic: quiet and inexpensive when everything is normal, deeper and more investigative when the evidence stops making sense.

## Reliability becomes someone’s daily responsibility

The biggest change is not technical.

Before, payment reliability was something I checked when I was working on payments or when a failure reminded me to look.

Now it is becoming an owned responsibility that can watch the platform daily—and eventually more often where the scenario and cost justify it.

Every day, the Smoke Tester should be able to say one of three things:

- the critical journey passed and the evidence is here;
- the journey failed, and this is the layer that appears to be responsible;
- or the test stopped safely because continuing would violate a financial or operational guardrail.

That is a much better relationship with a business-critical feature than “it worked the last time I tried it.”

My chalet platform may begin as an independent option for my own guests. If it grows to support other owners, more properties, and returning customers across Canada, its reliability expectations will grow with it.

I do not want to wait until then to build the habit.

I fixed the payment flow.

Now I am building the agent whose job is to keep proving that it stays fixed.

And if it stops being fixed, I want that agent to do more than turn a pipeline red. I want it to find out why, bring in the right help, and stay with the problem until there is a trustworthy answer.
