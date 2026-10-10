# Local model benchmark learnings

## Pi file-tools working directory

**What happened:** A first Pi file-tools setup run searched the repository for
`INPUT.txt` and wrote no accepted fixture outputs.

**Root cause:** Pi inherited the caller's working directory even though its
configuration directory was isolated under the benchmark run directory.

**How we fixed it:** `run-pi-file-tools.sh` changes into the run directory
before starting Pi.

**How to avoid it:** Keep the Pi working directory and its isolated harness
configuration under the same benchmark run directory. Do not score a run whose
independent verifier finds outputs elsewhere.

**Verification:** `verify.sh <run-directory>` must byte-compare both generated
outputs after Pi exits.

## Hermes benchmark profile flags

**What happened:** `setup-hermes-profile.sh --profile ... --model ...` failed
validation as though no profile had been supplied.

**Root cause:** Its validator reads resolved values from `HERMES_*` environment
variables, while the option parser kept command-line overrides only in shell
variables.

**How we fixed it:** The setup script now exports the resolved values before
calling the validator.

**How to avoid it:** Prefer documented command-line options for one-off
benchmark profiles; do not set `HERMES_HOME`.

**Verification:** A profile setup invocation with explicit `--profile`,
`--workspace`, `--endpoint`, and `--model` passes input validation.
