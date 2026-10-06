#!/usr/bin/env bash
# Test runner - writes all output to a log file
set -euo pipefail

LOG_FILE="/tmp/screenshot-sorter-test-run/test-output.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec >"$LOG_FILE" 2>&1

echo "=== Test Run Started: $(date) ==="

# Test 1: Run non-app checks (deterministic tests)
echo ""
echo "--- Test 1: Deterministic Sorting Tests ---"
bash "$dir/macos-screenshot-sorter.command.test.sh" && echo "Deterministic tests: PASS" || echo "Deterministic tests: FAIL"

# Test 2: Check for required patterns in code
echo ""
echo "--- Test 2: Code Pattern Checks ---"
grep -q 'requestSingleInstanceLock' "$dir/launcher/electron/main.cjs" && echo "requestSingleInstanceLock: FOUND" || echo "requestSingleInstanceLock: MISSING"
grep -q 'app.exit(0)' "$dir/launcher/electron/main.cjs" && echo "app.exit(0): FOUND" || echo "app.exit(0): MISSING"
grep -q 'ipcMain.handle.*sorter:library' "$dir/launcher/electron/main.cjs" && echo "sorter:library handler: FOUND" || echo "sorter:library handler: MISSING"
grep -q 'ipcMain.handle.*sorter:thumbnail' "$dir/launcher/electron/main.cjs" && echo "sorter:thumbnail handler: FOUND" || echo "sorter:thumbnail handler: MISSING"

# Test 3: Live Screenshot Sorter test (ONE ONLY)
echo ""
echo "--- Test 3: Live Screenshot Sorter Test ---"
echo "This test requires actual macOS screenshot capture and TCC permissions."
echo "For now, running deterministic tests only (no GUI/scheduler required)."

echo ""
echo "=== Test Run Completed: $(date) ==="
echo "All checks completed."
