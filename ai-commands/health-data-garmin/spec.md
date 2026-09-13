# health-data-garmin provider specification

## Purpose

Implement the `health-data` evidence contract using data originating from the governed human's Garmin account/devices.

## Acquisition modes

V1 recognizes two provider modes so the abstraction is useful before/without official API approval:

1. `export` — parse a user-owned Garmin data export/local dataset.
2. `api` — use an explicitly configured Garmin Connect Developer/Health API integration when credentials/access are available.

The provider must expose which mode is active and must not silently fall back to unofficial credential scraping.

## Normalized evidence

When available from the selected source, normalize evidence such as:

- sleep duration/score/stages
- resting/observed heart-rate summaries
- stress measurements
- activity/steps/intensity
- respiration/Pulse Ox when present
- Garmin Body Battery or equivalent provider-native recovery/energy observations

Missing metrics remain missing.

## Interpretation boundary

Garmin measurements are external evidence. `Body Battery`, sleep score, stress, or similar provider metrics must not be translated by this provider into `work`, `rest`, `healthy`, `unhealthy`, diagnosis, or another Governor decision.

## Security/privacy

- read-only in v1;
- profile-owned configuration;
- no committed tokens, passwords, OAuth secrets, exports, or personal datasets;
- never log secret credentials;
- raw data remains private by default;
- Personal Governor access requires explicit profile authorization.

## Non-goals

No therapy, diagnosis, medical interpretation, exercise prescription, Garmin account modification, device control, or undocumented password/session scraping.
