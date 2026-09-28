# Translated domain-context handoff preface

Use the following block before the unchanged `TASK.md` assignment for arm C. The block is frozen before the three-arm comparison.

> There are two representations of the same PDF text. Think of `normalizedText` as ordinary text: it keeps word boundaries, so a whole-word check has a meaningful boundary. Think of `compactText` as a fuzzy search form: it is deliberately permissive and may join text. It is useful for some broad matches, but unsafe when a rule depends on one exact standalone word.
>
> The business rule is that a standalone `PAYMENT` counts. For example, `SNOW REMOVAL CONTRACT — PAYMENT DUE` is a positive English case. `SNOW REMOVAL CONTRACT — REPAYMENT DUE` is a misleading near match and must not count: its letters contain `payment`, but it is not the word `PAYMENT`. If both `REPAYMENT` and a separate `PAYMENT` appear, the separate word still counts.
>
> This distinction matters at the recognizer's English payment check. In the staged recognizer, derive the English `PAYMENT` condition from a whole-word match in `normalizedText`; a substring search in `compactText` cannot establish that condition. Keep the existing French recognition and result contract intact.
>
> Requested change and scope follow unchanged:

Arm A receives the unchanged task alone. Arm B receives the previously frozen [raw domain preface](DOMAIN_CONTEXT.md), then that same task. All arms use the same starter, model, profile, route, turn and process limits, exact-file write boundary, independent verifier, and acceptance criteria.
