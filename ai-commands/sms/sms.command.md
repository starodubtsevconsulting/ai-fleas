## Tags

#command #ai-command #sms

- send an SMS to the configured phone number (used by workflows/policies, e.g. pomodoro notifications)

## Implementation

- `sms.command.sh` sends via Twilio (true SMS)
- configuration:
  - env vars (preferred): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
  - or `commands/sms/sms.command.config` (gitignored by `*.config`)
  - recipient:
    - `--to "<number>"`, or
    - `SMS_DEFAULT_TO`, or
    - `sms.command.config` key `user-phone-number: ...`, or
    - an explicit `--recipient-config <path>` file

## Usage

```bash
./commands/sms/sms.command.sh --message "Pomodoro: 5m left"
./commands/sms/sms.command.sh --to "+15145551234" --message "Break: 1m left"
./commands/sms/sms.command.sh --healthcheck
```
