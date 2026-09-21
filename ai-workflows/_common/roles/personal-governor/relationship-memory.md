# Relationship/contact memory

Relationship memory is a governed-human permanent-memory area used by the Personal Governor for strategic reasoning about people and organizations that materially affect goals, commitments, opportunities, or capacity.

## Suggested record

A private implementation may represent a contact with fields such as:

- `id` and display name;
- relationship categories (many allowed);
- active/inactive status;
- temporal goal links: goal id, relevance, status, last-confirmed date;
- value exchange: governed-human contribution and contact/relationship contribution;
- commitments and next actions;
- working patterns/constraints with provenance and confidence;
- current relationship state: the present operating model and strategic relevance;
- history: chronological relationship events, material interactions, experiments, decisions, changes, and lessons that explain how the current state was reached;
- notes/evidence references.

The storage format is implementation-specific. Human-readable permanent memory remains authoritative where configured.

## Capture policy

Relationship memory is selective durable memory, not a transcript of everything said about a contact.

When the governed human provides new information about a known or newly relevant contact, the Governor may update relationship memory without requiring a separate "remember this" instruction when the information materially affects an active or plausible goal/strategy relationship, commitment, opportunity, working boundary, communication approach, value exchange, or useful learning relationship.

Persist:

- direct factual information supplied by the governed human when strategically relevant;
- clearly attributed observations when they affect how the relationship should be handled;
- material changes in role, relationship, commitments, goal relevance, or working model;
- lessons from interactions when supported by evidence and useful to future governance.

Do not persist:

- incidental gossip, casual anecdotes, or details with no foreseeable governance relevance;
- speculative personality judgments presented as facts;
- sensitive or excessive personal information merely because it was mentioned;
- duplicate details that add no useful state or history.

Store facts as facts, self-reports/attributed statements as such, and Governor interpretations as revisable hypotheses. Preserve uncertainty rather than filling gaps. Update current state when new evidence changes the present model; append History only when the event/change is material enough to explain future decisions.

## Interaction activation and guidance

When a known contact becomes active in the current situation, relationship memory should be used as part of the Governor's live reasoning, not merely retrieved on explicit request.

Before recommending a meaningful interaction, commitment, meeting, message, or allocation of effort involving that contact, consider:

- what current human-owned goal the relationship or interaction serves;
- the contact's observed communication and decision-making preferences;
- approaches that have previously worked or failed;
- appropriate medium, level of detail, cadence, and framing;
- current boundaries, commitments, expectations, and coordination costs;
- what the governed human can learn or gain from the relationship and what value they provide;
- whether the expected value is proportional to the governed human's time and attention;
- the smallest useful next action.

If evidence indicates that a narrower interaction would preserve the relationship while reducing unnecessary coordination cost, recommend that narrower boundary. If an ambiguous request would require reconstructing another person's intent, prefer asking for a concrete requirement or success criterion over guessing.

Interaction guidance must preserve evidence levels: direct facts remain facts; recurring patterns remain observations; the governed human's interpretations remain attributed interpretations; Governor conclusions remain revisable hypotheses. Do not convert communication preferences or working patterns into fixed personality labels.

When useful, surface the guidance proactively and concisely. For example, if prior evidence shows that a contact responds better to working demonstrations than architectural explanations, advise showing the result and requesting a concrete acceptance decision rather than sending an unsolicited architecture explanation.

## Reasoning rules

1. Relationship identity is durable; goal links are temporal.
2. Categories are descriptive and may overlap.
3. Record observations before deriving working-pattern hypotheses.
4. Use relationship evidence for allocation and strategy only when relevant to an active governance question.
5. Prefer explicit agreements over inferred obligations.
6. Never use relationship records as covert social scoring.
7. Keep current state separate from history: current state is the Governor's present working model; history is append-oriented evidence of how it evolved.
8. Do not rewrite history merely because the current strategy changes; correct factual errors explicitly and preserve material prior states when useful.
9. Keep real contact data private; public examples use fictional identities only.

## Example

A fictional contact may be both `family` and `research-knowledge-exchange`, currently related to an `improve-local-ai-capability` goal. The Governor can remember that the parties work effectively in parallel with a narrow service boundary, while treating that working pattern as revisable evidence rather than a permanent trait.
