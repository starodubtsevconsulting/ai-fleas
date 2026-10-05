# Auxiliary verification gotchas

These are current observations or verifier guarantees, not universal claims about every future Hermes release.

## Configuration changes do not retrofit live chats

Changing a profile route does not rewrite an already running chat's effective binding. Verify a change with a fresh
session and evidence produced after the change.

## Configuration and UI activity are not runtime proof

Model labels, provider labels, YAML, and animations do not prove a call used that route. Require `state.db` evidence or
a bounded `agent.log` segment containing the exact resolved route.

## `goal_judge` may be absent from `session_model_usage`

Goal judging currently runs between foreground turns, outside ambient usage accounting. The verifier therefore accepts
a DB-grounded session log only when it contains both the exact judge route and a verdict.

## `background_review` is a different task

`background_review` has a separate binding and may remain on the foreground model. Its usage does not prove or disprove
the `compression` and `goal_judge` routes.

## Evidence may come from different sessions

Without `--session`, each task finds its newest qualifying evidence independently. Use `--session` when one exact
conversation must demonstrate both paths.

## Log candidates must be grounded in the database

Arbitrary bracketed log text can resemble a session ID. Autonomous discovery considers only session IDs already present
in the profile database before bounding a log segment.

## Compression can be verbose or slow

In the live experiment, one compression response had more output tokens than input and the surrounding delegated run
exceeded its wrapper timeout. Treat routing success and compression quality/performance as separate results.

## A wrapper timeout does not prove the route was unused

Inspect `state.db`, the bounded profile log, the visible checkout, and identifiable task state before retrying. Do not
send a duplicate assignment solely because its wrapper timed out.

## Derive names and endpoints

Never assume a model ID, provider alias, base URL, profile ID, machine, or session in verification logic. Read the
selected profile with `hermes -p PROFILE config get` and compare runtime evidence to those values.
