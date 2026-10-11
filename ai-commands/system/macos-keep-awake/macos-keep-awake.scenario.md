# macOS keep-awake acceptance

Manual UI/idle status: NOT_RUN. Requires a human at an authorized local Mac, selected profile/workflow
binding and allowlist, and a foreground interactive terminal. Never run unattended.

| Step | Action | Expected evidence |
| --- | --- | --- |
| Help | Run `bash ai-commands/system/macos-keep-awake/macos-keep-awake.command.sh --help` without profile selection. | Help only; no power assertion. |
| Guard/check | With authorized profile/workflow selected, invoke `--check`; also check absent/unauthorized binding fails. | Ready only when authorized on macOS; no assertion. |
| Arguments | Supply an unknown option or extra argument. | Failure without assertion. |
| Cancel | Invoke `run`; enter anything other than literal `KEEP AWAKE`, or EOF. | Cancelled; no assertion. |
| Noninteractive | Pipe confirmation text to `run` under the authorized context. | Interactive-stdin error; no bypass or assertion. |
| Confirm | Human reads physical-access notice, invokes `run`, types literal `KEEP AWAKE`. In another terminal inspect `pmset -g assertions`. | Foreground caffeinate process owns display/idle/system assertions; user-activity assertion may expire after five seconds. Record sanitized assertion types only. |
| Release | Press Ctrl-C in the command terminal; inspect `pmset -g assertions` again. | This process's assertions disappear; unrelated assertions may remain. |
| Idle | Only with explicit human supervision/approval, leave the confirmed command running for 20 minutes without input, then stop it. | Record actual display/screen-saver/lock behavior and AC-power state; this manual check is pending, not guaranteed by assertion presence. |

Stop if authorization, physical supervision or observed policy conflicts arise. Do not
change screen-saver/security settings to force success. No execution is claimed here.

## Recorded preflight evidence

The parent verified nine mocked controller lifecycle tests and both production and
development Angular builds PASS. `app.sh --dev` launched an Electron process that
remained alive. The Mac was locked, so native UI inspection and the supervised
20-minute idle check remain BLOCKED; no real Start/Stop assertion result is claimed.
After the final app identity and error-state Stop-control adjustments, the lifecycle tests and both builds passed again. Native UI behavior remains unverified while locked.

## UI verification

The authorized runner first installs command-local dependencies/generates the lock,
runs `npm test` in `launcher`, and builds both Angular configurations. Those checks do
not prove real power behavior. The human then follows this scenario on macOS:

| Step | Action | Expected evidence |
| --- | --- | --- |
| Boot | From command directory run `./app.sh --dev` without a profile. | One Inactive window; no assertions, no server or port. |
| Cancel | Start, then cancel the native warning. | Inactive; no child assertion. |
| Start | Approve the native physical-access warning. | Awake only after spawn; one owned caffeinate in `pmset -g assertions`. |
| Concurrency | Click Start repeatedly; open a second app instance. | One child and one app window; existing window focuses. |
| Stop | Stop while work is in progress; inspect assertions. | Stopping until close, then Inactive; only owned assertions removed. |
| Restart | Start/Stop again, including keyboard Tab/Enter/Space. | Accessible focus, native confirmation every new start, no overlapping children. |
| Close/Quit | Close the window or Quit while active/confirming. | Confirmation cannot create a late child; owned child closes before exit. |
| Failure | Runner exercises mocked spawn/kill errors using lifecycle tests. | Sanitized feedback, failed stop never falsely reports Inactive. |
| Idle | Human-approved 20-minute supervised idle observation. | Record actual display/lock/AC behavior; manual result remains pending. |

No tray, installer, password, persistent setting or security-policy override belongs to
this stage. Locked desktop prevents manual UI acceptance; record BLOCKED separately
from build/unit evidence. Never infer successful idle behavior from a rendered status.
# Standalone preview verification record — 2026-10-11

Parent-run Keep Awake 0.0.3 packaging, strict signature verification, ZIP integrity and
nine controller tests passed. The native app opened Inactive from its bundled resources.
Start warning Cancel preserved Inactive; confirmed Start showed Awake with pmset-owned
assertions for caffeinate child 80164 under app PID 80142. Stop returned Inactive.
Confirmed restart followed by closing the active window exited the app and its child;
only the original source caffeinate 66628 under parent 64548 remained.

ZIP size: 128605596 bytes. SHA-256:
`1cfb9774760ef1707c190bb26b241a0272f8db2bb4aa8d269586814cfac7b9d2`.
This is an ad-hoc signed unsigned preview. The 20-minute idle observation and a clean
quarantined-Mac download/install test were not run; no extended-idle or notarization
claim follows from these local checks.
