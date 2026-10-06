# Screenshot Sorter - Debugging Guide

## Quick Start

To run the UI and keep it running for debugging:
```bash
export AI_CONFIG_PROJECT="/Users/sergii/projects/sc/ai-fleas"
export AI_WORK_PROFILE_ID="sc"
export AI_FLOW_WORKFLOW="dev.workflow.md"
export AI_AGENT_PLATFORM="sc"
bash /Users/sergii/projects/sc/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui &
```

## App Structure

### Entry Points
- **Shell entry**: `macos-screenshot-sorter.command.sh ui` - sets up environment, launches Electron
- **Electron main**: `launcher/electron/main.cjs` - Node.js backend, reads config, IPC handlers
- **Renderer**: `launcher/renderer/index.html` - UI, calls `window.screenshotSorter.*` methods

### How Config Loads
1. Shell script reads `AI_COMMAND_CONFIG_PATH` (set by profile activation)
2. Script sources config file (shell env format: `KEY="value"`)
3. Electron main process calls `readConfig()` to parse the file
4. `settings()` extracts values and validates them
5. IPC handler `sorter:settings` exposes to renderer

### How Renderer Calls Main
```javascript
// In renderer (index.html)
const settings = await window.screenshotSorter.settings();
```
This calls the IPC handler registered in `main.cjs` line 169:
```javascript
ipcMain.handle('sorter:settings', settings);
```

## Debugging Steps

### 1. Verify Config File Format
The config file uses **shell env format** (not YAML):
```bash
SCREENSHOT_SORTER_SOURCE_DIR="/Users/sergii/Screenshots"
SCREENSHOT_SORTER_DESTINATION_DIR="/Users/sergii/Screenshots"
```
Check with: `cat "$AI_COMMAND_CONFIG_PATH"`

### 2. Verify Shell Parsing
Source the config and check env vars:
```bash
source "$AI_COMMAND_CONFIG_PATH"
echo $SCREENSHOT_SORTER_SOURCE_DIR
```

### 3. Check Electron Config Parsing
The app logs debug output when reading config:
```
[DEBUG] configPath: /path/to/config
[DEBUG] raw config content (first 500 chars): ...
[DEBUG] parsed: SCREENSHOT_SORTER_SOURCE_DIR = /Users/sergii/Screenshots
[DEBUG] values: {...}
```

### 4. View App Logs
The Electron app writes to system log directory:
- Output: `~/Library/Logs/AI Fleas/org.sergii.ai-fleas.screenshot-sorter.out.log`
- Error: `~/Library/Logs/AI Fleas/org.sergii.ai-fleas.screenshot-sorter.err.log`

### 5. Common Issues

| Symptom | Check | Fix |
|---------|-------|-----|
| UI fields empty | `cat "$AI_COMMAND_CONFIG_PATH"` | Ensure config is shell format |
| App exits immediately | Check logs in `~/Library/Logs/AI Fleas/` | Look for errors |
| GPU errors | Run with `--disable-gpu` | Known Electron issue, usually harmless |
| IPC calls fail | Verify `main.cjs` IPC handlers registered | Check lines 169-177 |

## Key Files

| File | Purpose |
|------|---------|
| `macos-screenshot-sorter.command.sh` | Shell entry point, profile activation |
| `launcher/electron/main.cjs` | Electron main process, config parsing, IPC |
| `launcher/renderer/index.html` | UI renderer, calls `window.screenshotSorter.*` |
| `app.sh` | Launch wrapper (passes `"$@"` args) |

## Debug Command

To run with full debug output:
```bash
pkill -f "Screenshot Sorter" 2>/dev/null
export AI_CONFIG_PROJECT="/Users/sergii/projects/sc/ai-fleas"
export AI_WORK_PROFILE_ID="sc"
export AI_FLOW_WORKFLOW="dev.workflow.md"
export AI_AGENT_PLATFORM="sc"
bash /Users/sergii/projects/sc/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui 2>&1 | tee /tmp/screenshot-sorter.log
```

Watch for the `[DEBUG]` lines in the output to verify config is being read.

## Development Workflow

**For rapid iteration, use dev mode** - changes to `index.html` auto-reload in the UI:

```bash
# Start with dev mode enabled
ELECTRON_DEV=1 bash /Users/sergii/projects/sc/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui &
```

When `ELECTRON_DEV=1` is set, the app watches `index.html` every 500ms and auto-reloads the window when changes are detected.

**If changes don't appear after editing `index.html`:**
1. **Check ELECTRON_DEV is set** - Dev mode must be enabled for auto-reload
2. **Check for save conflicts** - Ensure your editor saved the file
3. **Manual reload** - Press Cmd+R in the app window or click the tray icon to reload

**For main.cjs changes** (IPC handlers, config parsing, etc.):
- These require a full app restart since they run in the main process
- Use `pkill -f "Screenshot Sorter"` followed by restarting with the desired mode

## Profile Requirement

The command requires an AI Profile to be set. To run the UI:

```bash
export AI_CONFIG_PROJECT="/Users/sergii/projects/sc/ai-fleas"
export AI_WORK_PROFILE_ID="sc"
export AI_FLOW_WORKFLOW="dev.workflow.md"
export AI_AGENT_PLATFORM="sc"
bash /Users/sergii/projects/sc/ai-commands/_runtime/profile/activate-profile.sh --profile sc --workflow dev.workflow.md --platform sc --command macos-screenshot-sorter

# Then launch the app
ELECTRON_DEV=1 bash /Users/sergii/projects/sc/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui &
```

## Electron Console Logging

**Warning**: Do not use `console.log()` in `main.cjs` for debugging in Electron apps.

The `console.log()` writes to Node.js `process.stdout`, which in an Electron app (especially when launched from a shell script) may not have a valid stdout/stderr stream attached. This causes `EPIPE: write EPIPE` errors when the renderer calls functions that use `console.log()`.

**Rule**: Only use `console.error()` for fatal errors that should cause `app.exit(1)`.

If you need to debug config or other values:
1. Write to a log file instead
2. Send messages to the renderer for display in the UI
3. Use `console.error()` only for fatal issues

## White Screen Detection

**If you see a white screen**: This indicates a fatal error in the renderer process.

**Immediate actions**:
1. **Check renderer console**: Press Cmd+Opt+I to open DevTools in the renderer
2. **Check main process logs**: `~/Library/Logs/AI Fleas/org.sergii.ai-fleas.screenshot-sorter.err.log`
3. **Look for missing files**: Check if `index.html` or other assets exist
4. **Check config**: Ensure config file is valid shell format and all required vars are set
5. **IPC failures**: If renderer calls `window.screenshotSorter.*` and main doesn't respond, renderer throws

**Common causes of white screen**:

| Cause | Fix |
|-------|-----|
| `index.html` not found | Verify file exists in `launcher/renderer/` |
| Config missing required vars | Check config file has all `SCREENSHOT_SORTER_*` vars |
| IPC handler not registered | Verify `main.cjs` registers the IPC handler |
| Unhandled promise rejection in renderer | Check DevTools console for stack traces |
| Renderer crashes on load | Check DevTools console for errors |
| Renderer throws uncaught error | Wrap renderer init in try/catch |

**When you see white screen:**
1. Check DevTools console (Cmd+Opt+I) for errors
2. Look at main process logs for fatal errors
3. Verify all required env vars are set in config
4. Check `main.cjs` registers all required IPC handlers

## Testing Workflow

**Testing always starts with scenario.md** - the acceptance scenario is the master source of truth.

### 1. Acceptance Testing (scenario.md)
- Read `macos-screenshot-sorter.scenario.md` first
- Each step is a manual test to perform
- Record evidence at each step
- Only retire legacy when all steps pass

### 2. Playwright E2E Tests
- Tests live in `launcher/renderer/*.e2e.spec.cjs`
- Each test maps 1:1 to a scenario step
- Tests verify the same behaviors manually checked in scenario.md
- Run with: `cd launcher/renderer && npm test`

### 3. Test-Driven Development
- **Write scenario step first** in scenario.md
- **Add Playwright test** that verifies the same behavior
- **Run manually** via scenario.md to verify
- **Commit both** - scenario and test together

### 4. Running Tests

```bash
cd /Users/sergii/projects/sc/ai-fleas/ai-commands/system/macos-screenshot-sorter/launcher/renderer
npm install
npm test                    # Run all tests
npm run test:ui            # Run with Playwright UI
npx playwright test --debug  # Debug mode
```

### 5. Test Naming Convention

Tests should match scenario step descriptions:
- Scenario step: "Install candidate" → Test: ` candidate installs and loads correctly`
- Scenario step: "Tab order verified" → Test: `Screenshots tab appears before Settings tab`