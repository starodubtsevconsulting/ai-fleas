# springboot-log.command

## Roles

- `devops`

Check the latest Spring Boot log and report whether the app looks started successfully.

## Usage

- `./commands/springboot/springboot-log.command.sh [--project-dir <path>] [--output-dir <path>] [--log <path>] [--tail
<lines>] [--watch] [--interval <seconds>]`

## Defaults

- Uses the newest `*.log` under `${AI_FLOW_OUTPUT_DIR}/springboot/`.
- Falls back to `<repo>/.ai/springboot/` when `AI_FLOW_OUTPUT_DIR` is unset.
- `--interval` defaults to 30 seconds when `--watch` is used.

## Behavior

- Status is `SUCCESS` if a `Started` line is present and no error is found.
- Status is `FAILURE` if an `Exception`, `ERROR`, or `Caused by:` line is found.
- Status is `STARTING` if the PID is still running and neither condition above is met.
- With `--watch`, the command rechecks every 30 seconds until `SUCCESS` or `FAILURE`.

## Example

- `./commands/springboot/springboot-log.command.sh --watch`

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
