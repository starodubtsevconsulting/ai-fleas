## Code Review Command

## Tags

#command #ai-command #code-review #review #risk #testing

Purpose: provide a structured code-review response focused on risk, correctness, and coverage.

Process:

1. Understand the problem and the intended changes.
   - First, try to find documentation (markdown) that defines expected behavior.
   - Use the `doc` command guidance to locate relevant docs.
   - Look for edge cases implied by the docs or existing behavior.
2. Identify the single most critical issue or risk.
   - Articulate it clearly to the user as the top priority to fix.
3. List other findings, but only enumerate them.
   - Elaborate on each item only when the user asks.
4. Propose additional test coverage focused on the critical parts.

Output format:

- Start with the most critical issue.
- Then list other findings without deep detail.
- End with targeted test coverage recommendations.
