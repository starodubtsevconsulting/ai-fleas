# macOS keep awake

UI-first Angular + Electron utility with human-confirmed, process-owned power assertions for a local Mac. This
command does not change passwords, screen-saver preferences or persistent power settings.

## Human UI

From this command directory, the canonical development launch is:

```sh
./app.sh --dev
```

`./app.sh` builds production instead. Both build a static Angular renderer with relative
assets and open it in the command's own pinned Electron runtime; no web server/port,
Git update, global install or automatic process killing is used. Missing command-local
dependencies are bootstrapped with `npm ci` when a lock exists, otherwise `npm install`.
If npm security policy skips the Electron vendor download, the launcher stops with
an actionable `node node_modules/electron/install.js` instruction from `launcher`; it
does not change global npm policy. The authorized runner owns generating the initial
lock and verification.
`macos-keep-awake.command.sh ui` is a convenience route to this launcher.

Direct human UI startup intentionally needs no profile: it has no operational settings
and opens Inactive. This is a UI-specific exception; CLI check/run retain the profile
and workflow guard below. Start opens a native warning dialog with Cancel as default;
only approval starts the fixed child. No typed CLI phrase is required in the UI.

The status is Awake only after spawn; Stop remains available during start/stop work.
Stop waits for child closure before Inactive. Close or Quit stops the owned child and
quits, with no tray/hidden execution. If termination fails, the app remains open with
an error rather than pretending assertions ended. The child uses fixed arguments
`-disu -w <Electron-parent-PID>`; parent death also ends its assertions.

Electron is single-instance, sandboxed and context-isolated with Node integration off.
Only own-main-frame status/start/stop IPC is exposed; navigation/new windows are blocked.
No configuration, arbitrary process arguments or external code are accepted by IPC.

## CLI invocation and authority

Invoke through the selected profile's command runner, or after profile/workflow selection:

```sh
AI_CONFIG_PROJECT='/absolute/path/to/profile-project' AI_WORK_PROFILE_ID='<profile-id>' AI_FLOW_WORKFLOW='<workflow-id>' bash ai-commands/system/macos-keep-awake/macos-keep-awake.command.sh --check
AI_CONFIG_PROJECT='/absolute/path/to/profile-project' AI_WORK_PROFILE_ID='<profile-id>' AI_FLOW_WORKFLOW='<workflow-id>' bash ai-commands/system/macos-keep-awake/macos-keep-awake.command.sh run
```

Replace placeholders with an authorized existing profile/workflow; normal profile
resolution also applies. The profile must bind `macos-keep-awake` to its own config
and the workflow must allow it. Illustrative additions to the selected private profile
(use the existing workflow path, retaining its other configuration):

```yaml
commands:
  - id: macos-keep-awake
    config: commands-config/macos-keep-awake/config.env
workflows:
  - path: '<workflow-id>.workflow.md'
    commands:
      - macos-keep-awake
```

The profile-relative config file can contain only the example comments; these snippets
do not create or modify a profile. The [example](macos-keep-awake.command.example.config)
is comments-only because there are no operational settings. No profile is modified.

Only `--help`, `--check`, `run` and `ui` are accepted; no argument means `run`. Extra/unknown
arguments fail. Help has no profile requirement or effects. Operational check/run
source the shared profile guard and require this exact command's authorization.
Check validates macOS and executable `/usr/bin/caffeinate`, without power assertions.

Run requires interactive terminal stdin and literal `KEEP AWAKE` confirmation. Decline
or EOF cancels without assertions. There is no noninteractive bypass. Only after
confirmation does the process become `/usr/bin/caffeinate -disu`.

## Effects and stopping

Keeping a Mac awake can expose it to physical access. The human must supervise it.
No password is needed. Keep the command in the foreground and press Ctrl-C to stop;
process exit releases its assertions. No permanent setting is changed.

`-d` prevents display idle sleep; `-i` prevents system idle sleep; `-s` prevents system
sleep while on AC power. `-u` briefly declares user activity (default five seconds),
not continuous simulated activity. The process-scoped `-d/-i/-s` assertions continue
until exit. These assertions cannot guarantee prevention of manual lock, lid closure,
reboot, screen-saver locking or managed policy. Do not alter security policy to make
an acceptance check pass. Screen-saver idle timers and display sleep are separate.

See [acceptance scenario](macos-keep-awake.scenario.md) and [learning](AGENTS.md).
