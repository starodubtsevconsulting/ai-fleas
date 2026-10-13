|# Hermes Financial Insights acceptance
|
|# Initialize the Financial Insights workflow using the selected private/example profile and verify two distinct Hermes
|# profiles exist and report their readiness tokens:
|
|- Admin -> ADMIN_READY
|- Bookkeeper -> BOOKKEEPER_READY
|
|# Bookkeeping acceptance follows the quarter and bounded financial-question flows.
|# Optional external Governor integration scenarios live separately in
|# `ai-workflows/_common/policy/personal-governor/financial-evidence.acceptance.md`;
|# these cover external integration, not bookkeeping prerequisites.
|
|# Until Hermes peer-agent transport is configured, execute the handoffs through the platform-supported orchestrator or
|# human-visible bounded packets and record that direct peer routing is pending.
|
|# When Hermes A2A/peer transport becomes an authorized adapter capability, rerun the same scenario without changing the
|# portable Financial Insights flow. The adapter should transport the same bounded packets between the same logical agent
|# identities.
