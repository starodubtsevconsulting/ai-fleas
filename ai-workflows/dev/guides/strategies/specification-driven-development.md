# Specification-driven-development strategy

Make an explicit specification the authoritative starting point for a meaningful software change so intent is defined
before implementation drifts into accidental design.

- Define or update intent, scope, behavior, constraints, and acceptance expectations before implementation.
- Resolve material ambiguity at the specification level.
- Derive design, implementation, and verification from the accepted specification.
- Preserve traceability from intent to implementation evidence.
- When requirements change, update the specification and bring implementation and tests back into alignment.

Typical loop: `intent -> specification -> clarify and accept -> implement -> verify against specification -> revise when intent changes`.

The required depth should be proportional to the change; a small bounded change does not require ceremonial paperwork.
