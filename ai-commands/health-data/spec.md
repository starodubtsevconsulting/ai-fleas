# health-data command specification

## Purpose

Provide a provider-neutral, read-oriented contract for health/activity evidence that authorized agents such as Personal Governor may use as one input to capacity and execution reasoning.

Health data is evidence, not a planning decision, diagnosis, or direct capacity score.

## Provider pattern

`health-data` delegates acquisition to a profile-selected provider such as `health-data-garmin`. Providers remain flat/directly callable for provider-specific setup and diagnostics.

## Operations

- `check` — provider/configuration availability
- `info` — provider/capability summary
- `summary [date]` — normalized daily evidence
- `sleep [days]`
- `activity [days]`
- `recovery [days]` — provider measurements related to recovery/energy when available
- `raw <provider-resource>` — explicitly requested provider-native data for diagnostics/provenance

Normalized output should preserve source, observation time/date, units, and missing/unknown values rather than inventing measurements.

## Scope

V1 is read-only. It does not write health records or issue medical/fitness instructions.

Personal Governor may use normalized evidence only through explicit profile authorization and the minimum-necessary-observation rules of its human evidence model.

## Provider neutrality

Future providers may include Garmin, Apple Health/HealthKit exports, Health Connect, Fitbit, local datasets, or other authorized sources without changing Personal Governor strategy.
