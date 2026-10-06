# Screenshot Sorter - Debugging Guide

## Quick Start

To run the UI and keep it running for debugging:

**IMPORTANT**: Always run the last committed version of the app. Before launching:
1. Commit all changes: `git add -A && git commit -m "your message" && git push`
2. Kill old processes: `pkill -f "Screenshot Sorter"`
3. Launch the app with the latest code

### Method 1: Using Hermes Desktop (Recommended)

When running from Hermes Desktop, the profile is automatically activated. Simply run:

```bash
bash /Users/sergii/projects/sc/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui &
```

### Method 2: Using Terminal (Manual Profile Setup)

If running from a regular terminal, you must activate the profile first:

```bash
# Activate the profile (sets up environment variables)
bash /Users/sergii/projects/sc/ai-commands/_runtime/profile/activate-profile.sh \
  --profile sc --workflow dev.workflow.md --platform sc --command macos-screenshot-sorter

# Then launch the app
bash /Users/sergii/projects/sc/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui &
```

### Verify App is Running

Check the logs for activity:
```bash
# Watch for screenshot activity
tail -f ~/Library/Logs/AI\ Fleas/org.sergii.ai-fleas.screenshot-sorter.out.log

# Check for errors
tail -f ~/Library/Logs/AI\ Fleas/org.sergii.ai-fleas.screenshot-sorter.err.log
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
| `EPIPE: write EPIPE` error | Check for `console.log()` in `main.cjs` | Use `console.error()` only |

## Key Files

| File | Purpose |
|------|---------|
| `macos-screenshot-sorter.command.sh` | Shell entry point, profile activation |
| `launcher/electron/main.cjs` | Electron main process, config parsing, IPC |
| `launcher/renderer/index.html` | UI renderer, Angular component, calls `window.screenshotSorter.*` |
| `app.sh` | Launch wrapper (passes `"$@"` args) |

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

**The command requires an AI Profile to be set.**

### When Running from Hermes Desktop
The profile is automatically activated before the command runs. No manual setup needed.

### When Running from Terminal
You must activate the profile first:
```bash
bash /Users/sergii/projects/sc/ai-commands/_runtime/profile/activate-profile.sh \
  --profile sc --workflow dev.workflow.md --platform sc --command macos-screenshot-sorter
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
| JavaScript errors from code changes | Check DevTools console for syntax/runtime errors |
| Missing function/method definitions | Verify all referenced functions exist |

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

## Common Testing Pitfalls

### Do NOT poll for test results with repeated sleep commands

When running background tests, do NOT use this pattern:
```bash
# WRONG - this wastes hours polling
while [ ! -f test-results/result.json ]; do
  sleep 30
done
```

**Correct approach**:
1. Start the background test once with `notify_on_complete=true`
2. Wait for the completion notification
3. Read the log file and check the exit status
4. If results are written to a file, read it once after the test completes

### Test Result Location

Playwright test results are written to the configured `outputDir` in `playwright.config.*`. If the `test-results/` directory exists but is empty after a successful run (exit 0), check:
- `playwright.config.js/cjs` for `outputDir` setting
- Environment variables that might override output location
- Whether the reporter is configured to write files (some reporters like `list` don't)

### Background Test Script Template

Use this pattern for any test run that should output to a single log file:

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/tmp/test-run-output.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec >"$LOG_FILE" 2>&1

echo "=== Test Run Started: $(date) ==="

# Run test 1
echo "--- Test 1: Deterministic Sorting Tests ---"
if bash macos-screenshot-sorter.command.test.sh; then
  echo "Deterministic tests: PASS"
else
  echo "Deterministic tests: FAIL"
  exit 1
fi

# Run test 2
echo "--- Test 2: Code Pattern Checks ---"
grep -q 'requestSingleInstanceLock' launcher/electron/main.cjs && echo "requestSingleInstanceLock: FOUND" || echo "requestSingleInstanceLock: MISSING"

echo "=== Test Run Completed: $(date) ==="
echo "All checks completed."
```

Then run with:
```bash
bash test-runner.sh
cat /tmp/test-run-output.log
```

## Testing Without Profile

**Both test methods run WITHOUT profile requirements:**

1. **Deterministic tests** (`macos-screenshot-sorter.command.test.sh`):
   - Uses temp working dir with `--source-dir`/`--destination-dir`
   - Creates its own test profile only for shell wrapper validation
   - No manual profile setup needed

2. **Playwright E2E tests** (`launcher/renderer/*.e2e.spec.cjs`):
   - Runs HTML file directly from filesystem
   - Uses mock IPC instead of real Electron
   - No profile or config file needed

## Critical Testing Gotchas

### Never hardcode personal paths in E2E tests

E2E tests must work on any machine and must never contain personal/user-specific paths like `/Users/sergii/...`.

**WRONG:**
```javascript
fullImage: async () => `file:///Users/sergii/Screenshots/2026-10-05/Screenshot%202026-10-05%20at%2010-30-00.png`
```

**CORRECT:**
```javascript
fullImage: async () => {
  // Use data URLs instead of file:// URLs in tests
  // - Works on any machine without hardcoded paths
  // - No security restrictions in Playwright tests
  // - In real Electron app, this returns file:// URL from backend IPC
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6twAAAABJRU5ErkJggg==';
}
```

### Why data URLs over file:// URLs in tests?
- **Security**: Browsers block `file://` URLs in Playwright tests for security
- **Portability**: No hardcoded paths needed - works for any developer
- **Simplicity**: One-line return value instead of file creation logic
- **Real app**: In Electron, `window.screenshotSorter.fullImage()` returns `file://` from backend IPC

## Development with Angular

**The app is built with Angular 18.2.1.**

### Running Angular in Dev Mode

To develop with live reload:
```bash
cd /Users/sergii/projects/sc/ai-fleas/ai-commands/system/macos-screenshot-sorter/launcher/renderer-angular
npx ng serve
```

### Building for Production

```bash
npx ng build --configuration production
# Output: dist/browser/
```

### Angular Project Structure

| File | Purpose |
|------|---------|
| `src/main.ts` | Angular bootstrap entry |
| `src/app/app.component.ts` | Main component with all logic |
| `src/app/app.component.html` | Component template |
| `src/app/app.component.css` | Component styles |
| `src/app/models.ts` | TypeScript interfaces (Settings, Folder, Screenshot) |
| `src/app/window.d.ts` | Global `screenshotSorter` type definitions |

### Key Angular Patterns Used

- **Standalone components**: No `NgModule`, everything is standalone
- **Template-driven forms**: Simple input binding with `[(ngModel)]`
- **Event binding**: `(click)="hideHero()"` for user interactions
- **Property binding**: `[hidden]="selectedTab !== 'library'"` for conditional rendering
- **Structural directives**: `*ngIf`, `*ngFor` for conditional/repeated rendering
- **CSS scoping**: Component styles are encapsulated

### Hero Image Implementation

The hero image in the Library tab uses Angular's conditional rendering:

```html
<div class="hero-container" *ngIf="showHero">
  <img class="hero" src="..." alt="...">
  <button class="close" (click)="hideHero()" aria-label="Close hero image">×</button>
</div>
```

The `showHero` boolean is initialized to `true`, and `hideHero()` sets it to `false`, hiding the hero until the next app restart.

## Default Tab Behavior

**Library (Screenshots) panel is visible by default. Settings panel is hidden.**

To verify Settings content in tests, click the Settings tab first.

## macOS Status Bar Icon Issue

**Known limitation on macOS Sonoma and later**: The app's tray icon in the top status bar may not be visible.

**Cause**: macOS requires apps to be properly code-signed to show status bar icons. The development build is not signed, so macOS silently blocks the tray icon.

**Workarounds**:
1. **Click the app icon in the Dock** to open the main window
2. **Right-click the app icon in Dock** → "Show Screenshot Sorter"
3. **Use the menu bar item** (if visible in System Settings → Dock & Menu Bar)

**To fix permanently**:
- Build a signed version of the app with proper Developer ID certificate
- Or use `electron-builder` with proper notarization

The app itself is fully functional - the full-screen screenshot view works correctly. The only visible difference is the missing tray icon.
