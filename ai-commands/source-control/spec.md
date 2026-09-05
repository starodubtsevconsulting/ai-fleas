# Source Control command specification

The command provides a provider-neutral source-control boundary. It must resolve exactly one provider command from the
active profile, preserve profile/workflow/project coordinates, and fail closed before mutation when identity, repository
ownership, remote policy, or credential scope is missing or inconsistent.

Provider implementations own mechanics only. The neutral command owns intent, routing, and policy interpretation.
