# Included Rules Principle

```mermaid
flowchart TD
  Actor["Actor: author of a rule, policy, contract, or principle"] --> Decision{"Decision: does the document compose external rules?"}
  Decision -->|Allowed| Include["Allowed: place Included rules as the first content and first H2 after the H1"]
  Decision -->|No external rules| Omit["Allowed: omit an empty Included rules section"]
  Decision -->|Missing, partial, copied, or conflicting| Blocked["BLOCKED: do not use an incomplete effective contract"]
  Include --> Outcome["Outcome: explicit transitive rule composition"]
  Omit --> Outcome
  Blocked --> Outcome
```

This principle makes external rule dependencies explicit and loadable. It applies to a rule, policy, contract, or
principle that includes one or more external rules. A document with no external rule dependency does not add an empty
section.

## Rules

```mermaid
flowchart TD
  Actor["Actor: Agent loading a composing rule document"] --> Prerequisite["Prerequisite: read Included rules before local content"]
  Prerequisite --> Decision{"Decision: every canonical dependency and transitive dependency loads without conflict?"}
  Decision -->|Allowed| Apply["Allowed: apply included rules before local extensions and exact overrides"]
  Decision -->|Prohibited| Blocked["BLOCKED: no remembered text, local copy, partial load, implicit override, or dependency cycle"]
  Apply --> Outcome["Outcome: complete effective rule contract"]
  Blocked --> Outcome
```

- `## Included rules` is the first content and first H2 immediately after the H1.
- Use a flat table with one canonical link per included rule and its required application.
- The included-rules table is a reference catalog and does not require a diagram merely to explain the table.
- Load included rules transitively before interpreting or applying local content.
- Local rules may narrow or explicitly extend an included rule. An override must name the exact replaced rule; implicit
  replacement, conflict, dependency cycles, unreadable sources, partial loads, remembered text, and copied substitutes
  are `BLOCKED_INCLUDED_RULE_CONTEXT`.
- A document with no external included rules does not add an empty `Included rules` section.

## Tags

#documentation #principle #included-rules #composition #dependencies #template
