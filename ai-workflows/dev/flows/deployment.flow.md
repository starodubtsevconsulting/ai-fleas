# Deployment flow

## Purpose

[Dev](../dev.workflow.md), step 8 when applicable. Deploy and verify one exact authorized candidate/target.

## Entry

Known component, candidate/artifact, target, registered deployment route, readiness/runtime gates, and recovery policy.
PR/build success does not authorize deployment; production follows its selected release policy.

## Steps

1. Designer/Reviewer resolves applicability, existing exact authorization, candidate/target, and expected runtime proof.
2. Command Runner verifies required terminal checks for that candidate/artifact using [delivery guidance](../guides/delivery.md).
3. Command Runner dispatches through the profile-selected route; returns run identity, candidate, target, terminal result, and evidence.
4. Designer/Reviewer invokes [testing](testing.flow.md) for proof the intended candidate is active and behaves correctly in the target.
5. Manager records the verified outcome through authorized configured tracker persistence when applicable.

## Exit

Return to the deployment acceptance checkpoint, then closure only when required evidence exists. Dispatch success alone
is not runtime acceptance. Preserve candidate/target/run evidence on failure; debug, correct within scope, and reassess
readiness for the new candidate. Follow existing rollback authorization, never infer production effects or providers,
and use bounded waiting/status output for long operations.
