# Hermes Agents internals

The public command remains `../hermes-agents.command.sh`. Its implementation support is grouped by responsibility:

```text
📁 src/
├── 📄 bootstrap-command-profile.sh  early profile/workflow guard
├── 📄 command-shell-lib.sh          shared entrypoint shell helpers
├── 📄 resolve-*.mjs                 canonical scope resolution
├── 📄 *-receipt.py                  durable receipt writers
├── 📄 realize-workflow.py           workflow realization
└── 📄 configure-group.py            Hermes group configuration
```

Keeping bootstrap separate makes the entrypoint's lifecycle dispatch easier to scan without changing its public
arguments or moving lifecycle effects behind an additional executable.
