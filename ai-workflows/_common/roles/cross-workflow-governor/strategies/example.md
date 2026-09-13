# Governor strategy template example

This example shows how to classify a governance idea as policy, principle, method, strategy, profile selection, and mutable instance data. Use it as a reference when adding a new strategy family or method.

## Scenario

A governed human has a goal that depends on being understood correctly by people outside the system. The human changes a public professional profile and performs some outreach. An external contact responds with an opportunity that reflects the human's old positioning rather than the intended new direction.

The response is useful evidence: the external environment did not interpret the signal as intended.

## Policy

Policies define boundaries.

- The human owns the goal and may change it explicitly.
- The Governor must not publish private strategy or human data merely to improve external signaling.
- External effects require the authority provided by the profile/workflow/command contracts.

## Principle

Principles guide reasoning inside those boundaries.

- External responses are evidence about how an action was actually interpreted.
- A mismatch between intended and observed response should trigger diagnosis before simply repeating the same action.
- Attention or activity is not success unless it supports the active goal.

## Method

A reusable method operationalizes those principles:

`external-feedback-loop@v1`

```text
goal
  -> external action
  -> external response
  -> evidence
  -> alignment check
  -> adaptation
  -> next action
```

The method is generic. It does not know about a particular social network, person, programming language, employer, or private goal.

## Strategy

A strategy composes this method with other methods. For example, `default/strategy.v1` may include `external-feedback-loop@v1` while `default/human.v1` includes commitment discipline, execution adaptation, and one-on-one.

The strategy determines the reusable methodology, not the concrete external action.

## Profile

A profile chooses the methodology coordinates and binds mutable data:

```yaml
governorStrategy:
  id: default
  strategyVersion: v1
  humanVersion: v1
  data:
    strategy:
      uri: <private mutable strategy source>
    human:
      uri: <private mutable human source>
```

The profile also determines which workflows and commands are available for any concrete action.

## Instance data

The private mutable strategy data may record facts such as:

- intended external interpretation;
- action performed;
- response received;
- whether the response aligned with the goal;
- diagnosis of the mismatch;
- next experiment/action;
- eventual result.

These facts change frequently and do not belong in the reusable GitHub strategy template.

## How to classify a new idea

Ask in this order:

1. Is it a must/may/must-not boundary? -> **Policy**.
2. Is it a general reasoning rule? -> **Principle**.
3. Is it a repeatable operational approach? -> **Method**.
4. Is it a selected combination of methods? -> **Strategy**.
5. Is it selecting versions, capabilities, schedules, or external sources for one concrete Governor? -> **Profile configuration**.
6. Is it a changing fact, measurement, event, goal, progress value, observation, or learned state? -> **External instance data**.

## Creating another strategy family

Start from the grammar in `README.md`, then create only what is semantically different:

```text
strategies/<new-id>/
  strategy.yml
  strategy.v1.md
  human.v1.md
```

Reuse existing methods where possible. Add a new method only when the operational approach itself is reusable and materially different. Add a new version only when reusable semantics change, not when instance data changes.
