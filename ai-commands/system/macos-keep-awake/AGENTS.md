# Keep Awake UI development

Canonical human development entry is `./app.sh --dev` from this command directory.
It builds static Angular and runs command-owned Electron; no profile is required merely
to open the Inactive UI. CLI `--check`/`run` remain profile/workflow-guarded. Do not copy
the screenshot sorter's Git pull, server/port termination, temp logs or tray behavior.
No shared runtime is borrowed; package versions are pinned locally and the authorized
runner generates the lock. Code author does not claim installation/build/UI checks.

Start requires the native confirmation dialog; CLI retains literal KEEP AWAKE. The
controller owns one fixed caffeinate child, marks Awake only after spawn, waits for
close on Stop, and uses `-w` parent PID. Quit/close stops and exits. Preserve narrow
own-main-frame IPC, sandbox/context isolation and blocked navigation/new windows.
Lifecycle regressions use injected spawn/confirmation; actual native UI and supervised
idle verification remain separate manual acceptance in the scenario.

# macOS keep-awake knowledge

What happened → A manually bundled preview exited before opening its own window while
the source launcher held an awake session. Root cause → Electron 44.3.0 computes
`app.isPackaged` from the executable basename; preserving `Electron` makes it false,
so the preview selected the source user-data directory and lost its single-instance
lock. How we fixed it → Select preview user data using the exact `keep-awake` package
name written by the standalone packager. How to avoid → Do not infer package identity
from `app.isPackaged` in a manually copied Electron runtime. Verification → Exact
upstream v44.3.0 `App::IsPackaged` source confirms the name check; parent-owned native
0.0.3 verification passed launch, warning cancellation, confirmed Start, owned pmset
assertions, Stop and active-close cleanup while preserving the original source session.
Nine controller tests passed. Extended idle and clean quarantined-Mac acceptance remain
unrun. No self-learning extraction was executed.

What happened → A platform interaction was interrupted by an idle lock despite checking
display sleep. Root cause → A separate screen-saver idle timer of 1200 seconds can
matter independently of display-sleep settings. How we fixed it → Provide an explicitly
confirmed, foreground process-scoped caffeinate command rather than changing permanent
security settings. How to avoid → Distinguish screen saver, display sleep and system
sleep; explain physical-access risk and that `-u` defaults to five seconds, while
`-d/-i/-s` persist with the process (`-s` on AC power). Manual lock/lid/policy remain
outside this guarantee. Verification → Follow the adjacent scenario: profile guard,
cancel/noninteractive checks, process assertions and Ctrl-C release, then a human-approved
20-minute idle observation. That manual observation is pending; no execution is claimed.
