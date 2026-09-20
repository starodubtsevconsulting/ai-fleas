# Hermes Financial Insights acceptance

Initialize the Financial Insights workflow using the selected private/example profile and verify three distinct Hermes
profiles exist and report their readiness tokens:

- Financial Analyst -> FINANCIAL_ANALYST_READY
- Records / Bookkeeping -> RECORDS_BOOKKEEPING_READY
- Financial Reviewer -> FINANCIAL_REVIEWER_READY

Run the portable Governor delegation scenario from
`ai-workflows/financial-insights/acceptance/governor-delegation.md`.

Until Hermes peer-agent transport is configured, execute the handoffs through the platform-supported orchestrator or
human-visible bounded packets and record that direct peer routing is pending. Do not collapse Analyst and Reviewer into
one profile to make the test pass.

When Hermes A2A/peer transport becomes an authorized adapter capability, rerun the same scenario without changing the
portable Financial Insights flow. The adapter should transport the same bounded packets between the same logical agent
identities.
