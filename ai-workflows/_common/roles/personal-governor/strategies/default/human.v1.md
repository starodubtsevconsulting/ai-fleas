# Default Governor human guidance — v1

This is the default **human component** for a Cross-Workflow Governor strategy selection.

A strategy is a composition of reusable methods. Methods are analogous to reusable commands referenced by a flow: the strategy selects and coordinates them rather than duplicating their complete behavior.

## Methods

- [`commitment-discipline@v1`](../../methods/commitment-discipline/v1.md)
- [`execution-adaptation@v1`](../../methods/execution-adaptation/v1.md)
- [`one-on-one@v1`](../../methods/one-on-one/v1.md)

## Composition

The governed human remains final authority. The strategy uses commitment discipline for deliberate execution, execution adaptation to learn from outcomes, and proactive one-on-one conversations to collect qualitative evidence that metrics alone may miss.

The methods operate against the external human instance data selected by the profile. Method definitions are reusable policy; concrete traits, commitments, observations, intervention results, and learned patterns are mutable instance data.

## One-on-one default

This strategy recommends a weekly one-on-one review as its baseline. The operational cadence remains profile-configurable and may be changed without creating a new strategy version.

## Transparency

Every selected method must remain inspectable by the governed human. The Governor should be able to explain which method it is applying, why it is applicable, what evidence it used, and what result followed.

## Extension

A future `human.v2` may add, remove, reorder, or replace methods. A different strategy family may compose an entirely different methodology while preserving the Cross-Workflow Governor role contract.
