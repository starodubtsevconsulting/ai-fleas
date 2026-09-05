# Elastic managed-agent capacity acceptance

Elastic capacity is an optional host implementation and is unavailable in the standalone public rules layer. Without an
explicit human request, a configured host-owned roster, and a configured elastic-capacity implementation, return
`BLOCKED_HOST_INITIALIZER` with zero task mutation.

A companion implementation may define additional acceptance mechanics, but it must preserve the common
[workflow-agent contract](../agents.md), the selected profile and project boundary, exact identity binding, bounded
capacity, recoverable lifecycle operations, and complete cleanup evidence.
