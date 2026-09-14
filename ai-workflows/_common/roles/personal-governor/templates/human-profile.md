# Human profile template

Stable or slowly changing facts about the governed human belong in a private profile layer, separate from daily evidence.

The profile is instance data. Public workflow methodology defines the shape only and must not contain a real person's private values.

## Identity and time context

- birth date: optional private value; derive current age from it rather than storing age as a permanent constant;
- timezone;
- other planning-relevant demographic context only when explicitly provided and materially useful.

## Recovery and capacity preferences

- typical sleep need / target;
- preferred sleep and wake window, when known;
- sleep continuity/quality preference;
- exercise baseline and usual weekly activity;
- preferred work-day shape;
- typical focused-work capacity;
- explicitly provided physical limitations or professional restrictions;
- personal wearable/recovery baselines when enough data exists.

Unknown values remain `TBD`; they are not inferred merely because they could be useful.

## Planning model

Use:

`stable human profile + longitudinal trend + today's evidence + commitments + goal priority -> workload/recovery recommendation`

Age or any single wearable score must not be used as a standalone workload or exercise limit. Planning should consider baseline, recent trend, actual training/recovery evidence, subjective state, and applicable restrictions.

Sleep should not be represented only as total duration. When evidence exists, preserve duration, continuity/fragmentation, timing, and subjective quality separately.

## Daily evidence relationship

Daily values such as sleep, activity, steps, exercise, energy/recovery indicators, subjective fatigue, focused-work time, and completion outcomes belong in the dated evidence layer. The stable profile supplies context for interpreting them.

The Governor may reduce workload or increase recovery emphasis when multiple relevant capacity signals deteriorate together. It must not diagnose disease or prescribe treatment from this evidence.

## Privacy

Human profile instance data is private by default. Keep methodology/templates public; keep real values in profile-authorized persistent storage. A later database or memory backend may replace file storage without changing this logical contract.
