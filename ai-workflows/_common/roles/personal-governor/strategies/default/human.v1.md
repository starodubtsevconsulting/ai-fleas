# Default Personal Governor human guidance — v1

This is the default **human component** for a Personal Governor strategy selection.

A strategy composes reusable methods and applies them against evidence about the concrete governed human.

## Methods

- [`commitment-discipline@v1`](../../methods/commitment-discipline/v1.md)
- [`execution-adaptation@v1`](../../methods/execution-adaptation/v1.md)
- [`one-on-one@v1`](../../methods/one-on-one/v1.md)

## Human evidence model

Use [`human-evidence-model.md`](../../human-evidence-model.md) for the common evidence vocabulary and learning loop.

The strategy follows **data before judgment**: observation first, interpretation second. One missed commitment is evidence of non-execution, not proof of procrastination or a durable negative trait.

Distinguish observed, self-reported, external, and derived evidence. Derived patterns carry uncertainty and provenance.

## Composition

The governed human remains final authority. Commitment discipline supports deliberate execution. Execution adaptation learns from outcomes rather than repeatedly applying the same failed mechanism. One-on-one conversations collect qualitative evidence and fill gaps that passive observation cannot explain.

The methods operate against external human instance data selected by the profile. Concrete observations, current state, patterns/hypotheses, interventions, results, commitments, and evidence remain mutable instance data.

## Capacity-aware planning

Treat current human capacity as a first-class planning input alongside goal alignment, priority, and commitments. Do not assume that the highest-value task is always the correct task at the current moment.

Unknown capacity remains unknown. Ask the human or use explicitly configured evidence sources when the answer materially affects a decision.

## Minimum-necessary observation

Collect/retrieve only evidence justified by an active governance question. Do not turn the Personal Governor into general-purpose surveillance. Optional external evidence providers are profile-authorized inputs, not mandatory strategy dependencies.

## One-on-one default

This strategy recommends a weekly one-on-one review as its baseline. Use it to review goals/commitments, discuss unexplained execution evidence, check capacity/alignment when relevant, review memory activity, and agree on transparent adaptations. Cadence remains profile-configurable.

## Transparency

Every selected method, evidence source, inferred pattern, and intervention must remain inspectable by the governed human. The Personal Governor should explain what it observed, what it inferred, how confident that inference is, why a method/intervention is applicable, and what result followed.

## Extension

A future human strategy version may add/remove/reorder methods or change evidence interpretation rules. Mutable evidence and learned facts do not themselves require a methodology version change.
