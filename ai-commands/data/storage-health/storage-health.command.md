# storage-health.command

Portable, read-only-first Linux storage inspection. Inventories disks, collects SMART evidence, starts non-destructive SMART self-tests, and emits human/agent-readable health reports.

## Safety

This command does not format, partition, erase, mount, unmount, create RAID, repair filesystems, or write user data. System disks are visible in inventory but are never automatically selected for tests. Persistent private profiles should map roles to stable IDs/serials rather than /dev/sdX paths.

## Actions

- `inspect` — physical disk inventory.
- `health DEVICE` / `health --all` — SMART summary and conservative assessment.
- `report` — alias of health.
- `test DEVICE --short|--long` — start non-destructive SMART self-test.
- `test-status DEVICE` — show self-test/progress evidence.
- `--json` on health/report — machine-readable records.

SMART actions require `smartctl` (smartmontools) and normally sudo/root. USB/DAS bridge types are discovered using `smartctl --scan-open` rather than guessed.

Assessment is screening, not a guarantee. FAIL includes overall SMART failure or pending/offline-uncorrectable sectors; WARN includes concerning attributes or incomplete evidence. Important data still requires backup.

Host names, device roles, expected serials, mount policy, and storage purpose belong in the private profile, not this public command.
