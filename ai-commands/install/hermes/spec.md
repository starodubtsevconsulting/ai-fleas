# hermes Spec

- Manage only the physical Hermes application distribution.
- Require `Darwin/arm64` for every local lifecycle action.
- `status`, `smoke-test`, `check-update`, and `update` are read-only.
- Install and upgrade use the reviewed pinned installer and require post-install smoke success.
- Uninstall fails closed until adapter ownership and data preservation can be proven.
- Never mutate Hermes bot/profile/workflow-group lifecycle or private provider configuration.
