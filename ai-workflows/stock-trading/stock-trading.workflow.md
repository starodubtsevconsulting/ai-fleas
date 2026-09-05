# Stock-trading workflow

Use this workflow only for explicitly requested short-horizon market research, planning, journaling, or review under a
human-defined strategy and risk policy.

## Required behavior

- Require an explicit strategy with eligibility conditions, evidence requirements, risk limits, and invalidation or
  exit logic; do not substitute ad hoc model intuition.
- Separate facts, signals, assumptions, planned decisions, execution evidence, and realized outcomes.
- Preserve source provenance and timestamps for market-sensitive evidence.
- Never imply guaranteed performance or hide uncertainty, costs, liquidity, or downside risk.
- Analysis does not authorize execution. Never place, modify, or cancel an order, move money, or alter a brokerage
  account without explicit authorization for the exact action and independently enforced limits.
- Do not weaken a stop, risk ceiling, or other hard constraint merely to preserve a trade thesis.
- Keep accounts, holdings, credentials, order permissions, and limits private and profile-scoped.

Typical flow: `strategy and limits -> observe -> qualify setup -> risk review -> human decision -> optional separately authorized execution -> monitor defined conditions -> close -> retrospective`.

The profile supplies strategy specializations, data sources, allowed instruments, limits, and any execution capability.
The host may implement those mechanics but may not infer authority from technical access.
