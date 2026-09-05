# install.command

## Tags

#command #ai-command #install

Install and configure dev tooling using the local `commands/install/` tree.

## Usage

- `./commands/install/install.sh` (run all installs)
- `./commands/install/<tool>/install.sh` (run a single tool)
- `./commands/install/check.sh` (optional, if present)

## Rules

- Prefer running `./commands/install/check.sh` first to see what is already installed.
- Each folder owns its own `install.sh` and README.
- If a tool supports update checks, add a `check-update.sh` and have `install.sh` call it to decide whether to prompt
for updates or reinstall.
- For language runtimes, use `v_matrix.json` to pick recommended versions.
- All install scripts must initialize logging via `report_log_init`; logs go to `commands/install/logs/install.log`.
- Install logs are local artifacts and must not be committed.
- Reinstalling is OK; scripts should be idempotent where possible.
- After running installs, open a new shell (or run `exec zsh`) to activate changes.

## Roles selection

- dev

## Input

- `commands/install/*`

## Output

- Local machine tooling configured by the selected `install.sh` (some tools install under the home directory, others system-wide).
