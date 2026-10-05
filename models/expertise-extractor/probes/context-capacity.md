# Context Capacity experiment

**Short name:** Context Capacity.

## Three-layer design

### Layer 1: Public contract (this file)

A provider-neutral, immutable specification that defines the experiment structure, semantics, and acceptance criteria. This file contains no machine-specific values and serves as the authoritative reference for implementation.

### Layer 2: Local runtime manifest (git-ignored)

A per-execution `context-capacity/manifest.json` supplied at runtime that discovers and names:

- Hermes profile name and path
- Endpoint/server controls (start/stop/restart commands)
- Health check URLs and expected responses
- Configured context queries (Hermes context window, compression thresholds)
- Model identity/quant/build queries and expected values
- Telemetry endpoints (latency, memory, swap, tool calls)
- Restore commands for model/quant/build drift recovery

The git-ignored manifest MAY contain authorized local hostnames, paths, profile identifiers, and command definitions, but MUST NOT contain credentials/secrets and must never be committed. Secrets (API keys, tokens) come from environment variables or system keychain.

### Layer 3: Runner executable

`run-context-capacity.mjs` (with `test-run-context-capacity.mjs`) must:

1. Reads the local manifest to discover runtime configuration
2. Verifies the discovered active model equals the frozen expected Qwen3-Coder-Next Q5_K_M identity
3. Stops immediately on model/quant/build drift (not configurable)
4. Executes the experiment arms in the defined order
5. Records all evidence and produces a final verification report

## Required future paths

The following artifacts must exist, validate, and have frozen hashes before any live run:

| Path | Purpose |
| --- | --- |
| `models/expertise-extractor/probes/context-capacity/manifest.schema.json` | JSON Schema for runtime manifest validation (draft 2020-12, strict, no machine values) |
| `models/expertise-extractor/probes/context-capacity/fixture-spec.md` | Frozen fixture definition (starter code, domain contracts, verifier) |
| `models/expertise-extractor/probes/context-capacity/integration-task-packet.json` | Frozen primary integration task, delivery, and correction specification |
| `models/expertise-extractor/probes/context-capacity/task-packet.json` | Frozen secondary financial-retention control |
| `models/expertise-extractor/probes/context-capacity/context-sources.json` | Frozen ordered context sources with byte hashes |
| `models/expertise-extractor/probes/context-capacity/packet-manifest.json` | Exact tokenizer, packet hash, measured contract offsets, and chunk hashes |
| `models/expertise-extractor/probes/context-capacity/acceptance.json` | Frozen numeric/configurable thresholds |
| `models/expertise-extractor/probes/context-capacity/evidence.schema.json` | JSON Schema for evidence records |
| `models/expertise-extractor/probes/context-capacity/run-context-capacity.mjs` | Runner executable |
| `models/expertise-extractor/probes/context-capacity/test-run-context-capacity.mjs` | Test/validation harness |
| `notes/benchmarks/local-models/fixtures/hermes-context-capacity-integration/verify.mjs` | External verifier executable |

Live runs are blocked until all exist, validate, and hashes are frozen.

### Fixtures

The financial recognizer remains the small retention control. Its fixture spec defines:

1. **Starter code**: Exact `recognizers/snow-removal-contract-recognizer.mjs` from the frozen commit hash (from hermes-financial-recognizer-coding fixture).
2. **Domain contracts**:
   - `normalizedText` preserves word boundaries (for exact `PAYMENT` matching)
   - `compactText` is a permissive search form (substring search unsafe for exact English keywords)
   - Business invariant: standalone `PAYMENT` counts; `REPAYMENT` alone does not count; separate `PAYMENT` still counts beside `REPAYMENT`
3. **Verifier**: `verify.mjs` runs independently after Coder stops, checking only the target file and accepted work.
4. **Independent verification**: Acceptance criteria identical to hermes-financial-recognizer-coding fixture (7 checks).

## Frozen financial-recognizer semantics (task-packet.json)

The task packet extends the existing financial-recognizer translated-domain evidence. All arms use identical semantics:

- **normalizedText** versus **compactText**: normalizedText preserves word boundaries for exact matching; compactText is a permissive search form that joins text.
- **PAYMENT positive**: standalone PAYMENT word counts.
- **REPAYMENT/coexistence is not accepted as PAYMENT evidence**: `REPAYMENT` alone does not count; if both `REPAYMENT` and a separate `PAYMENT` appear, the separate word still counts.
- **One-file write scope**: only `recognizers/snow-removal-contract-recognizer.mjs` may be written.
- **External verifier**: `notes/benchmarks/local-models/fixtures/hermes-financial-recognizer-coding/verify.mjs` runs independently after Coder stops.

Provenance citations (from existing 2026-09-28 three-arm comparison):

- Task-only: 3/9 first-pass accepted
- Raw domain context: 5/9 first-pass accepted
- Translated domain context: 8/9 first-pass accepted

**Process-group fixture remains secondary control**: 0/8 first-pass baseline is not a clean primary capacity measure and is not used for arm selection.

The primary integration benchmark is the checked-in `hermes-context-capacity-integration` fixture. It uses one pure-function coding change whose elementary requirements are distributed across three zones. Its verifier reports EARLY, MIDDLE, LATE, and legacy groups separately. This separates retained-contract use from the harder lifecycle reasoning that confounded the process-group task.

## Fixed packet and delivery rules

Every A/B/C integration run receives the same byte-identical 205,080-token packet in the same 53-message order. The frozen measured positions are EARLY 20,000, MIDDLE 90,000, LATE 150,000, and final task 205,000. Each contract appears exactly once; the final task names requirement IDs without restating their meanings.

Each payload chunk is at most 4,096 tokens. The runner wraps it in the frozen delivery template: chunks 1–52 are explicitly context-only and must receive only the frozen acknowledgement before the next message; chunk 53 is explicitly the execute-task turn. Delivery templates are identical across arms and frozen in the packet manifest. Every observed model input plus the frozen 8,192-token output headroom must fit the arm context. The cumulative session intentionally exceeds A and B: declared Hermes compression or oldest-context eviction is the capacity behavior under test. Silent per-request truncation, packet/hash drift, delivery-template drift, unmeasured final input, changed compression policy, or post-task rereading of contract sources invalidates the run.

Arm B is eligible only when the largest observed model input exceeds 65,536 tokens. Arm C is eligible only when it exceeds 131,072 tokens. Record cumulative delivered tokens, largest and final model inputs, compaction events/time, and eviction evidence when available.

Freeze meaningful intervening corpus by:
- Ordered source IDs
- Byte hashes of each source
- Rendered packet hash
- Tokenizer identity and version
- Measured token count

## Design: exploratory and confirmation phases

### Exploratory phase

Run the complete cyclic orders ABC, BCA, and CAB once: nine exploratory runs total, three per arm. Packet bytes, message boundaries, acknowledgement, task, starter, verifier, model, quant, sampling, toolset, limits, and correction remain fixed.

### Confirmation phase

After frozen review, use all six A/B/C permutations, one run per arm in each permutation: 18 confirmation runs total.

- Fresh session each run
- No prompt tuning after failures
- Hashes immutable

## Evidence collection

For each run, record:

| Field | Meaning |
| --- | --- |
| Configured/observed server context | Hermes context window, compression trigger |
| Expected/discovered model | Exact model, quant, build |
| Packet/input tokens | Cumulative delivered, largest model input, and final model input |
| Headroom H | Reserved output headroom |
| Context management | Compression events/time, eviction evidence, and unexpected truncation |
| Exit/confirmed stop | Process/gateway termination evidence |
| Requirement-level retention | EARLY/MIDDLE/LATE/legacy verifier scores and retained IDs |
| External verifier command ID/exit/assertions/files/hashes | Verification result |
| Latency | Wall time per run |
| Peak memory | Process memory peak |
| Swap | Swap usage if measured |
| Tool calls | Number and types |
| Corrections | Correction count per run; corrected results remain diagnostic |

External acceptance after confirmed stop even on nonzero model exit.

## Thresholds (acceptance.json)

All thresholds live here and freeze before execution. Do not invent final values in prose.

| Threshold | Description |
| --- | --- |
| `no_invalid_runs` | Maximum invalid run count (must be 0) |
| `accepted_work_improvement` | Minimum accepted work improvement over baseline |
| `retention_threshold` | Minimum requirement-level retention rate |
| `max_crash_oom_swap_rate` | Maximum crash/OOM/swap rate per 100 runs |
| `latency_ceiling` | Maximum wall time per run |
| `memory_ceiling` | Maximum peak memory per run |
| `required_c_over_b_delta` | Minimum C-over-B accepted work delta |

## Sequential state machine

The runner follows this state machine. Any failure stops.

1. **preflight** - Validate manifest and required artifacts exist
2. **validate_model** - Verify expected/discovered model and profile match Qwen3-Coder-Next Q5_K_M
3. **snapshot** - Capture baseline Hermes context snapshot
4. **configure_arm** - Configure one arm's server/Hermes context size and frozen compression policy
5. **restart_if_needed** - Restart server if context requires
6. **health** - Verify server health check passes
7. **verify_values** - Confirm observed values match configured
8. **fresh_task** - Stage the frozen starter, deliver all 53 packet chunks through one fresh resumable Hermes session, require the exact acknowledgement on chunks 1-52, and let chunk 53 execute the task
9. **confirm_stop** - Verify task/gateway actually stopped
10. **external_verify** - Run external verifier and capture result
11. **evidence** - Record all evidence fields
12. **restore** - Restore server to baseline state
13. **verify_restore** - Verify byte-for-byte restore to pre-snapshot state
14. **next_arm** - Proceed to next arm

No inherited live config. Each run starts from baseline.

## Narrow interpretation

This experiment measures:

- Reliable retained requirements (whether domain contract appears in output)
- Accepted work (whether external verifier passes)

It does not measure intelligence or permanent chat memory.

## Concrete canonical requirements

### Artifact/hash requirements

| Artifact | Hash algorithm | Verification |
| --- | --- | --- |
| integration-task-packet.json | SHA-256 | Must match pre-run validation |
| context-sources.json | SHA-256 | Must match pre-run validation |
| verify.mjs | SHA-256 | Must match pre-run validation |
| run-context-capacity.mjs | SHA-256 | Must match pre-run validation |
| test-run-context-capacity.mjs | SHA-256 | Must match pre-run validation |

### Command requirements

All commands must have explicit timeouts:

| Command | Timeout | On failure |
| --- | --- | --- |
| Server start | 60s | Fail preflight |
| Health check | 10s | Fail health stage |
| Task execution | 600s | Fail confirm_stop stage |
| External verify | 60s | Fail external_verify stage |
| Restore | 60s | Fail verify_restore stage |

**Restore policy**: After any post-snapshot failure (stages 4-13), attempt restore and verify_restore before stopping. If verify_restore fails or cannot be completed, hard stop and flag manual recovery.

### Correction requirements

Exactly one standardized correction opportunity per RUN (not per arm). Its prompt/template and allowed verifier feedback fields are frozen in integration-task-packet.json. Record first-pass acceptance separately; confirmation/promotion uses first-pass results, while corrected acceptance is secondary diagnostic only. A second correction in a run is forbidden.

### Context zone rules (deterministic, frozen)

Exact zone targets and tolerance are frozen before execution. Validation uses measured tokenizer tokens. Require:

- EARLY target <65536
- MIDDLE target >65536 and <131072
- LATE target >131072

with non-overlapping tolerance ranges.

**Packet algorithm**: Ordered frozen sources are concatenated deterministically. Insert each frozen domain contract exactly once when the next source would cross its target. Pad only with next meaningful frozen source fragments to reach tolerance. Append the unchanged final task once. Hash rendered bytes, tokenize it, and split it into the frozen ordered chunks. Reject inability to hit tolerance or any chunk/hash drift. Every arm receives these same chunks in the same order.

### Execution requirements

- No in-process tuning between runs
- No prompt edits after first run
- No shared conversational context between runs
- Each run starts from fresh server process or clean Hermes session

## Status

**Frozen inputs and offline-tested runner implemented; local runtime manifest and live results pending.**
