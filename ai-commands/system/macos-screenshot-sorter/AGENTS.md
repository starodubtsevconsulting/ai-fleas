# Screenshot Sorter - Debugging Guide

## Quick Start

To run the UI and keep it running for debugging:
```bash
export AI_CONFIG_PROJECT="/Users/sergii/projects/sc/ai-fleas"
export AI_WORK_PROFILE_ID="sc"
export AI_FLOW_WORKFLOW="dev.workflow.md"
export AI_AGENT_PLATFORM="sc"
bash /Users/sergii/projects/sc/ai-fleas/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui &
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
bash /Users/sergii/projects/sc/ai-fleas/ai-commands/system/macos-screenshot-sorter/macos-screenshot-sorter.command.sh ui 2>&1 | tee /tmp/screenshot-sorter.log
```

Watch for the `[DEBUG]` lines in the output to verify config is being read.

## Electron Console Logging

**Warning**: Do not use `console.log()` in `main.cjs` for debugging in Electron apps.

The `console.log()` writes to Node.js `process.stdout`, which in an Electron app (especially when launched from a shell script) may not have a valid stdout/stderr stream attached. This causes `EPIPE: write EPIPE` errors when the renderer calls functions that use `console.log()`.

**Rule**: Only use `console.error()` for fatal errors that should cause `app.exit(1)`.

If you need to debug config or other values:
1. Write to a log file instead
2. Send messages to the renderer for display in the UI
3. Use `console.error()` only for fatal issues
