# Context Report: <question or subject>

```mermaid
flowchart TD
  Question["Question"]
  Question --> Evidence["Most relevant evidence"]
  Evidence --> Meaning["What it means"]
  Meaning --> Outcome["Decision or next action"]
```

State in one or two sentences what the reader should understand from this
report.

## Modified Markdown rules

Delete this section when the report is not reviewing changed Markdown rules.
For each modified path, inject every complete changed normative section before
summaries or conclusions. Do not use ellipses inside a changed section.

### `<exact/path/to/rule.md>`

````markdown
## Exact changed section heading

```mermaid
flowchart TD
  Actor["Actor"] --> Decision{"Decision: exact review decision?"}
  Decision -->|Allowed| Route["Allowed: exact route"]
  Decision -->|Prohibited| Blocked["BLOCKED: exact prohibited route"]
  Route --> Outcome["Outcome: exact result"]
  Blocked --> Outcome
```

Exact current prose for the complete changed normative section.
````

## What the visual shows

```mermaid
flowchart TD
  Visual["Visual evidence"]
  Visual --> Meaning["Verified meaning"]
  Meaning --> Inference["Clearly labeled inference"]
```

Explain the important relationship, sequence, or decision shown above. Separate
verified facts from inference.

## Evidence

```mermaid
flowchart TD
  Claim["Claim"]
  Claim --> Source["Smallest supporting source"]
  Source --> Inspect["Reader can inspect it"]
```

Use the smallest useful combination of a table, screenshot, diff, link, or code
snippet. Include source locations. Remove this section if the visual and
explanation are sufficient.

```text
Focused evidence only; do not paste unrelated output.
```

## Decision or next action

```mermaid
flowchart TD
  Understanding["Shared understanding"]
  Understanding --> Outcome["Decision, risk, question, or next action"]
```

State the decision, risk, open question, or next action when the user asked for
one. Otherwise remove this section.
