# Domain-driven-design strategy

Organize software design around a continuously refined understanding of the domain rather than allowing technical
structure alone to define the system.

- Develop shared language and express domain concepts consistently in discussion, specifications, and code.
- Identify meaningful domain boundaries and bounded contexts.
- Model important domain behavior explicitly.
- Keep context relationships and integration boundaries visible.
- Distinguish core-domain concerns from supporting or generic concerns when useful.
- Refine the model when evidence changes domain understanding.

Typical loop: `understand domain -> define language and boundaries -> model -> implement -> learn -> refine model`.

This strategy can coexist with specification-driven and test-driven development; each addresses a different dimension.
