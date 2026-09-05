# Development: coding

- Inspect the smallest relevant file or narrow search first.
- Make the smallest reviewable change that solves the request.
- Follow existing local patterns and keep unrelated files untouched.
- For every domain-affecting change, apply the active code-style command's DDD
  contract strictly across backend and UI. A purely technical leaf change does
  not require new domain objects, but it must not bypass or weaken the existing
  domain model.
- Use a focused check when it provides useful proof.
- Designer/Reviewer selects each Java/Maven validation gate and dispatches the exact Command Runner for registered
  execution. Coder may edit source and tests but must not invoke Maven directly.
- Before the first implementation packet, record applicable Definition-of-Done gates and owners in the active session
  plan. Implementation evidence never substitutes for unfinished verification.
