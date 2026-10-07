# storage-health.command

Portable, read-only-first Linux storage inspection. Inventories disks, collects SMART evidence, starts non-destructive SMART self-tests, and emits human/agent-readable health reports.

## Safety

This command does not format, partition, erase, mount, unmount, create RAID, repair filesystems, or write user data. System disks are visible in inventory but are never automatically selected for tests. Persistent private profiles should map roles to stable IDs/serials rather than /dev/sdX paths.

## Actions

- `inspect` — physical disk inventory.
- `health DEVICE` / `health --all` — SMART summary and conservative assessment.
- `report` — alias of health.
- `ai-report DEVICE|--all` — optional second-layer report: physical health plus AI workload suitability.
- `test DEVICE --short|--long` — start non-destructive SMART self-test.
- `test-status DEVICE` — show self-test/progress evidence.
- `--json` on health/report — machine-readable records.

SMART actions require `smartctl` (smartmontools) and normally sudo/root. USB/DAS bridge types are discovered using `smartctl --scan-open` rather than guessed.

Assessment is screening, not a guarantee. FAIL includes overall SMART failure or pending/offline-uncorrectable sectors; WARN includes concerning attributes or incomplete evidence. Important data still requires backup.

Host names, device roles, expected serials, mount policy, and storage purpose belong in the private profile, not this public command.

## Optional AI suitability layer

`ai-report` keeps the generic health evidence and adds recommendations for AI storage roles. It classifies suitability for agent persistent memory, knowledge/document storage, backup/archive, cold model libraries, vector/search workloads, active inference storage, and agent workspaces/builds.

The first-pass classification uses storage medium characteristics such as rotational versus non-rotational media and transport. Rotational HDDs are treated as strong capacity/sequential/archive storage, conditional for vector/search workloads, and poor for latency-sensitive active inference or build/workspace random I/O. SSD/NVMe is treated as broadly suitable, with benchmarking still required for demanding throughput cases.

This recommendation is intentionally separate from `health`: operators can request pure disk health without AI opinions, or explicitly request `ai-report` when deciding how a device should be used in an AI system. Future versions may incorporate optional measured sequential/random-I/O evidence without making destructive benchmarks the default.


## Discovery and role matching lifecycle

The portable command follows this lifecycle when a profile supplies desired storage roles:

**discover → analyze → recommend → approve → bind → monitor**

Discovery reads runtime device facts; profiles do not need to hardcode serial numbers or /dev/sdX paths.

A profile may describe intent only:

```yaml
storage:
  desired_roles:
    agent-memory:
      workload: agent-persistent-memory
      requirements:
        health: healthy
    model-library:
      workload: cold-model-library
      requirements:
        health: healthy
```

The command/runtime adapter may then:

1. discover currently attached physical disks;
2. collect stable runtime identity, medium, capacity, transport, filesystem/mount evidence, and SMART evidence;
3. calculate AI workload suitability;
4. rank candidates against profile role requirements;
5. emit recommendations without changing the machine;
6. require explicit approval before a profile/runtime adapter persists a stable binding;
7. monitor the accepted binding and flag disappearance, replacement, or degraded health.

### Safety and ownership

Recommendation is read-only. The portable command MUST NOT silently bind, mount, format, partition, or replace a device. Persistent binding is a profile/runtime concern after explicit acceptance.

The stable identity discovered at runtime may include filesystem UUID, WWN, or device serial as appropriate. Raw hardware identity does not need to be committed to a profile repository merely to support discovery.

The public command owns generic discovery and suitability semantics. Private profiles own desired roles, minimum requirements, accepted bindings, and deployment-specific mount/share policy.
