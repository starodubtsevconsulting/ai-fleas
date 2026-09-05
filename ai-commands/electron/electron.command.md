# electron.command

## Roles

- `developer`
- `qa`

Use for AI Workflow Suite app-mode work: Electron shell, Angular UI, Nest websocket backend, launcher lifecycle, and
app-mode e2e validation.

## Intent mapping

- Requests like `app mode`, `Electron app`, `open the app`, `show the app`, `launcher`, `desktop launcher`, `Angular
UI`, `Nest backend`, `websocket terminal`, `blank screen`, `app error`, or `close the app stops servers` map to
`[dev][electron]`.
- Use more specific activity labels in progress updates when helpful:
  - `[dev][electron] launch`
  - `[dev][electron] ui`
  - `[dev][electron] backend`
  - `[dev][electron] e2e`
  - `[dev][electron] docs`
  - `[dev][electron] launcher`

## Contract

- Keep `documentation/app/AppMode.spec.md` as the behavior contract.
- Update the spec in the same change as app behavior changes.
- Keep spec rows mapped to e2e proof commands.
- App mode is dev-first: Angular serve + Nest backend + Electron.
- For routine app-mode verification, prefer the running dev stack, targeted backend checks, or focused `e2e:dev`; do
not default to repeated `npm run ui:build`.
- Use `npm run ui:build` only when the user explicitly requests a production build, packaging/release work needs it, or
serve-mode proof is insufficient.
- App mode intentionally starts with no implicit bundle; the UI should remain unloaded until the user or a test selects
an `ai-profile` folder.
- `./_electron-agent-launcher.sh` is not the default no-bundle startup surface for app-mode testing; it requires a
selected bundle unless `--config-bundle-root` or `AI_CONFIG_BUNDLE_ROOT` is provided.
- Workflow-specific app-mode tests must use a bundle that actually contains the target workflow and layout mapping;
simplified e2e fixture bundles are not proof for workflows they do not define.
- `start.sh` remains terminal/tmux bootstrap mode and must not be repurposed for app launcher behavior.
- App mode must force `USE_TMUX_VIEW=false` and must not run tmux refreshes or `codex logout`.
- App mode may run `codex login` only for `web_sso` when `codex login status` reports missing auth, so a desktop
launcher click after reboot can open the normal browser SSO flow without relaunching `start.sh`. App mode uses browser
SSO for the standalone `sc` profile and must not run `codex logout`.
- Closing Electron must stop Angular/Nest dev server process trees.
- The user should never see a blank app window for known startup/backend failures; add visible fallback/error UI before
risky runtime wiring.

## Commands

- Launch for user inspection: `npm start` or `./app.sh`.
- Install optional Linux desktop launcher: `npm run app:install-launcher`.
- Syntax check: `npm run electron:check`.
- Fallback/error e2e: `npm run e2e`.
- Serve-mode e2e: `npm run e2e:dev`.
- For workflow-specific layout proof, prefer focused `e2e:dev` runs that select the real bundle, or extend the fixture
bundle first so it defines the target workflow and `workflow_layouts`.
- Launcher lifecycle e2e: `npm run e2e:launcher`.
- Backend type-check: `npx tsc -p tsconfig.server.json --noEmit`.

## Reporting

- When launching the app for visual inspection, report that the app is running and return control. Do not wait
indefinitely in a tool session just because the user is inspecting the window.
- If the app remains running, say so explicitly and include the launch command.
- If the user closes the app, check for leftover Angular/Nest/Electron processes only when it matters for the next command.
- If an app-mode test starts unloaded with no selected bundle, treat that as the expected baseline unless the scenario
explicitly preselects or loads an `ai-profile` folder.
