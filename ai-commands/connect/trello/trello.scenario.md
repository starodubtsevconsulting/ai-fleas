# Trello read-only discovery acceptance

Use an explicitly selected profile/workflow and its authorized workspace and board. Select a human-supplied description
of an existing card; never hardcode an organization's board or card in this public scenario.

1. Verify the profile permits `ticket-tracker` and `trello`, selects Trello, and resolves the registered provider contract.
   For a referenced tracker, verify the command and workflow config paths resolve to the same profile-owned YAML file,
   select the exact active workflow record, and reject a missing, foreign, duplicate, or mixed inline/file binding.
2. Verify the connected read/search capabilities and exact workspace/board/list bindings. Do not use Jira or guessed
   shell paths when the Trello connector is unavailable.
3. Search for the supplied distinguishing terms, scoping both workspace and board; record queries and pagination.
4. Exact-read relevant candidates and compare the outcome and known target facts. Reject a foreign-board result.
5. Verify the human-facing workflow role automatically asks Manager without requiring a card number first; Manager
   returns exact evidence or a precise clarification question through the original correlation and return route.
6. Check status inventory against the configured list identifier, preserving pagination/coverage limits.
7. Confirm no tracker or machine mutation occurred. Report passed checks, evidence, and any untested live-agent gate.

An ambiguous result requires a specific question; incomplete search coverage never proves a card does not exist.
Direct provider-read success does not by itself prove that running workflow agents loaded the corrected binding.
