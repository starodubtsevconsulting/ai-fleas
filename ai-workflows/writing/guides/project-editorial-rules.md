# Project editorial rules

The shared Writing workflow defines portable editorial mechanics. A selected profile/project may add project-specific editorial rules without modifying the public workflow.

## Contract

A writing project MAY register one or more instruction resources in its project configuration. These resources supplement, rather than replace, shared Writing guidance.

Typical project-owned rules include:
- audience and positioning;
- title, subtitle, and opening strategy;
- voice and reader address;
- commercial or non-commercial purpose;
- visual identity;
- disclosure constraints;
- destination-specific packaging preferences.

The Writer MUST resolve applicable project instructions during intake and carry their IDs in the article brief/handoff. Reviewer MUST independently resolve the same applicable instructions and check the revision against them.

Project rules MUST NOT:
- weaken factual verification, provenance, review independence, publication authority, or safety boundaries;
- silently override destination requirements;
- expose private strategy in public article metadata/copy;
- require a particular commercial objective in the shared/public workflow.

## Example profile/project registration

```yaml
knowledge:
  - id: editorial-positioning
    kind: instructions
    ref: knowledge/editorial-positioning.md
    applies_to: [writing, review]
  - id: editorial-packaging
    kind: instructions
    ref: knowledge/editorial-packaging.md
    applies_to: [writing, review]
```

The public workflow owns the extension point. The profile/project owns the actual custom policy.
