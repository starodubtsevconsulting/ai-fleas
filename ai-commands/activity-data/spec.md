# activity-data command specification

## Purpose

Provide provider-neutral read-only evidence about how the governed human allocates device/application attention over time.

Activity data is evidence, not a judgment about productivity, distraction, or intent.

## Provider pattern

`activity-data` delegates acquisition to a profile-selected provider such as `activity-data-android`. Providers remain flat and directly callable for provider-specific setup/diagnostics.

## Operations

- `check`
- `info`
- `summary [date]`
- `screen-time [days]`
- `apps [days]`
- `categories [days]`
- `timeline [date]`
- `raw <provider-resource>` for explicit diagnostics/provenance

Normalized evidence may include total screen time, app/category duration, social-media duration, unlock/pickup counts when available, and time-of-day usage. Missing values remain unknown.

## Privacy boundary

V1 is usage metadata only. Do not collect message contents, notification contents, typed text, browser contents/history, photos, microphone/camera data, contacts, or location merely to infer attention.

Personal Governor access requires explicit profile authorization and follows minimum-necessary observation. Prefer aggregates relevant to an active governance question over detailed timelines.

## Interpretation

High screen/social-media time does not by itself establish procrastination or a problem. It may become supporting evidence when correlated with commitments, schedule, capacity, self-report, and other observations.
