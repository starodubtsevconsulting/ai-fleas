# Action-first UX principles

## Purpose and scope

Help people understand a product by doing a useful task and seeing its outcome. Apply these principles to websites, applications, and relevant interface changes through the selecting workflow and profile. They complement the existing design system, accessibility rules, and independent acceptance gates.

## Principles

1. **Offer the first useful action immediately.** Make a concrete task visible and usable at the point of entry. Do not make a visitor read a manifesto, learn internal terminology, or complete unrelated setup before starting. Where authentication or context is necessary, preserve progress where feasible and explain the next requirement.
2. **Show the value concretely.** Show a representative result near the action or in the next natural section: a real product view, clearly labeled illustrative preview, worked example, or interactive demo. The visitor should recognize what they will obtain without translating a feature list into an imagined outcome.
3. **Explain progressively.** Give enough context to choose the action and understand its consequences. Introduce terminology, setup, and detailed help at the step that needs them. Keep optional background available without making it a prerequisite.
4. **Make the next step and feedback clear.** Give each stage a clear primary action. Secondary paths may serve different user goals but should not compete equally for attention. Show loading, success, and failure states in plain language; preserve recoverable input and explain how to continue.
5. **Demonstrate truthfully.** A preview must distinguish available behavior, fictional/illustrative data, and planned features. Connect displayed results to their actual sources and semantics. A saved document is not proof of payment, and a recorded process is not proof of every broader claim about authorship.
6. **Make meaning accessible.** Keep the task and demonstration useful on phone and desktop, with keyboard access, meaningful labels, readable text, and visible focus. Color and graphics reinforce meaning; labels, amounts, and status text must also convey it.

## Applying the principles

Start from the user's task and desired result, then choose the entry action and demonstration. Do not prescribe upload controls, charts, a particular color palette, or a screenshot carousel for every product. Content itself can be the useful experience on a reading surface; a representative item and an obvious next step may be sufficient.

Action-first does not require an action before necessary consent, authorization, material consequences, or a consequential decision are understood. Put required information at the decision point. Do not hide essential explanation, prices, or limitations to reduce text.

Keep the scope proportional: a small component change does not require redesigning the whole site. Record an exclusion with a concrete reason when a principle is not applicable.

## Acceptance evidence

For an affected entry journey, the selecting workflow records:

- the intended user, task, first useful action, and visible expected result;
- the route and candidate revision, phone/desktop viewports, and relevant states;
- whether the task can be started without developer explanation or unnecessary setup;
- whether the demonstration makes the benefit and current capability understandable;
- what identity/context is required, when it is requested, and whether progress survives the transition;
- observed loading, success, failure, and recovery behavior where affected;
- labels and non-color meaning, keyboard access, and supported-language coverage;
- pass, fail, or not run for each applicable check, with evidence and unresolved follow-up.

A screenshot supports visual findings; it does not prove an interaction works or establish that a new user understood it. Distinguish reviewer inspection from observed usability feedback. Preserve independent UI acceptance where the workflow requires it.

## Selection and integration

Profiles may select this policy as their UX default in their existing agent instructions or specification. The selection is normative instruction, not a new runtime configuration key. Workflow planning, implementation handoffs, review records, and UI acceptance must carry the selected principles through to evidence. Reuse this document rather than copying its rules into each product.
