# springboot-stop.command

## Roles

- `devops`

Stop a running Spring Boot app started by `springboot-run.command.sh`.

## Usage

- `./commands/springboot/springboot-stop.command.sh [--project-dir <path>] [--output-dir <path>] [--log <path>] [--pid
<pid>] [--wait <seconds>]`

## Defaults

- If neither `--log` nor `--pid` is provided, uses the newest `*.log` under `${AI_FLOW_OUTPUT_DIR}/springboot/`.
- Falls back to `<repo>/.ai/springboot/` when `AI_FLOW_OUTPUT_DIR` is unset.
- Waits up to 10 seconds before sending SIGKILL.

## Example

- `./commands/springboot/springboot-stop.command.sh`

## Inputs

- See command description
- AI_FLOW_PROJECT_DIR / AI_FLOW_OUTPUT_DIR when applicable

## Output

- Updated files/logs/reports described above
- Terminal output and exit status
