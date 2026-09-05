# AI Fleas contribution

## Purpose and scope

<!-- What user-facing outcome does this provide, and what is intentionally outside scope? -->

## Layer and boundary

<!-- Which command, workflow, profile structure, or public platform binding changed? Why does it belong in public rules? -->

## Validation

<!-- List exact checks and tests, including important allowed and blocked paths. -->

## External effects and dependencies

<!-- Publishing, messages, financial actions, providers, migrations, generated artifacts, new dependencies, or none. -->

## Checklist

- [ ] The change is portable and understandable without a private companion repository.
- [ ] No credentials, client data, private identifiers, absolute machine paths, or runtime state are included.
- [ ] Platform mechanics do not leak into portable workflow rules.
- [ ] External effects require explicit authorization and have clear evidence.
- [ ] Executable behavior has proportionate tests.
- [ ] `git diff --check` and relevant public-boundary validation pass.
