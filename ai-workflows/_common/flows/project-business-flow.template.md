# <Project business flow>

## Purpose and ownership

<Business outcome, owning project, designated semantics owner and relevant source links.>

## Actors and prerequisites

<Actor, starting state, permissions, environment and required inputs. No real secrets or
private operational identifiers.>

## Scenarios

### <Scenario name; optional stable identifier>

1. <Actor action or business trigger.>
2. <Next action and observable expected outcome.>
3. <Terminal outcome, including relevant persistence or external effects.>

<Invariants, alternative paths, failures, safe recovery and conditions requiring a stop or
separate approval. Add an optional diagram only if it improves understanding.>

<Cleanup/compensation for this scenario's effects. For uncertain external outcomes, state
what evidence resolves them, when to stop retries and how the same saved operation is
recovered without duplicate actions. Define the terminal cleanup proof.>

## Verification and open questions

<Derived test/evidence references where available; coverage gaps, unresolved semantics and
their owner. Keep actual run results in the project's acceptance record rather than treating
this normative source as proof of execution.>
