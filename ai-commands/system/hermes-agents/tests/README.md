# Hermes Agents tests

The test package separates navigation, human explanations, fixtures, and executable checks. Operational profile IDs,
models, providers, endpoints, and sessions are never embedded as defaults.

```text
📁 tests/
├── 📄 README.md                         navigation and commands
├── 📁 docs/
│   ├── 📄 architecture.md               Hermes at a glance
│   ├── 📄 auxiliary-verification.md     evidence and verifier flow
│   └── 📄 gotchas.md                    observed traps and remedies
├── 📁 fixtures/
│   └── 📄 command-lifecycle-fixture.sh   shared isolated Hermes home
├── 📁 cases/
│   ├── 📄 system-lifecycle.sh            System profile scenarios
│   ├── 📄 workflow-lifecycle.sh          workflow realization scenarios
│   ├── 📄 profile-lifecycle.sh           profile status and deletion
│   └── 📄 secrets-preflight.sh           secrets fail-closed behavior
├── 📄 hermes-agents.command.test.sh     thin lifecycle suite runner
├── 📄 verify-auxiliary-usage.test.sh    synthetic auxiliary fixture
└── 📄 *.test.{sh,mjs}                   focused component suites
```

## Read first

- [Hermes architecture](docs/architecture.md)
- [Auxiliary verification](docs/auxiliary-verification.md)
- [Observed gotchas](docs/gotchas.md)

## Run

```bash
# Focused, offline auxiliary-routing fixture; never calls a model.
bash verify-auxiliary-usage.test.sh

# Aggregate Hermes Agents command suite.
bash hermes-agents.command.test.sh

# Live, read-only verification of one configured profile.
../verify-auxiliary-usage.sh --profile PROFILE
```

See [the command guide](../hermes-agents.command.md) for lifecycle operations and
[the specification](../spec.md#live-auxiliary-acceptance) for the normative acceptance contract.
