# Test-driven-development strategy

Use executable tests to drive implementation in small feedback loops, making the next expected behavior explicit before
or alongside production code.

- Express the next required behavior as a failing test.
- Confirm the failure is meaningful.
- Implement the smallest coherent change that satisfies it.
- Run the relevant tests and inspect the evidence.
- Refactor while preserving behavior.
- Repeat in small increments.

Typical loop: `required behavior -> failing test -> implementation -> passing test -> refactor -> next behavior`.

The familiar red-green-refactor shorthand describes a feedback mechanism, not a requirement to maximize test count or
to ignore test value, risk, and maintainability.
