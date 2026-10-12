# Local model benchmark learnings

## Generated PDF fixture Git attributes

**What happened:** Git treated ASCII-encoded ReportLab PDFs as text and flagged their format-required trailing whitespace.

**Root cause:** A PDF without a NUL byte can be classified as text without explicit attributes.

**How we fixed it:** Mark the fixture PDF path as `binary` in `.gitattributes`; preserve the original PDF bytes and cross-reference offsets.

**How to avoid it:** Set scoped binary attributes before staging generated PDF assets. Never strip PDF whitespace to satisfy a source-code whitespace check.

**Verification:** `git check-attr binary diff text -- <fixture.pdf>` reports binary handling, and the complete feature diff passes `git diff --check`.

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

## Model aggregate output shape

**What happened:** Review before live evidence publication found that malformed
model aggregate output could crash verification instead of recording a failure.

**Root cause:** The verifier sorted or converted `included_documents` and
`excluded_documents` before validating their JSON shapes.

**How we fixed it:** Validate output field shapes before sorting or set
conversion, and record failed verification for malformed output rather than
throwing.

**How to avoid it:** Valid JSON does not guarantee the requested schema. Treat
all model output as untrusted input to the verifier.

**Verification:** Five verifier unit tests pass, including malformed aggregate
output cases.
