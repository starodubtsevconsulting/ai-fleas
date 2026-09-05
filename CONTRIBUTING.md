# Contributing to AI Fleas

Contributions should remain portable, publishable, bounded, and understandable without a private companion repository.

## Choose the correct layer

- Put reusable behavior and deterministic capability contracts in `ai-commands/`.
- Put platform-neutral domain rules, roles, and workflow manifests in `ai-workflows/`.
- Put sanitized profile structure and examples in `ai-profile/`.
- Put public host bindings in `platforms/` only when they implement the adapter contract without private configuration.
- Keep launchers, private profiles, credentials, machine paths, client data, runtime state, and private integrations out of
  this repository.

The dependency direction is one way: platform implementations consume AI Fleas. Portable rules must not depend on a
private platform.

## Contribution shape

Keep each change focused and document the user-facing outcome, authority boundary, inputs, outputs, failure behavior,
and observable completion evidence. Executable behavior needs proportionate deterministic tests. Examples must contain
placeholders rather than credentials, private identifiers, or real local paths.

Commands that need environment-specific values receive them from the selected profile or ignored local configuration;
they must not infer them from a company name, nearby directory, URL, or prior conversation. Workflows describe required
behavior and capabilities without prescribing transports, servers, UI frameworks, or provider-specific mechanics.

## Validate before review

Run checks relevant to the changed files. At minimum, workflow changes must pass:

```sh
bash ai-workflows/validate-public-boundary.sh
```

Also run `git diff --check` and the tests owned by every changed command or adapter. In the pull request, list the exact
checks and important allowed and blocked paths covered.
