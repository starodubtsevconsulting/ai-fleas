# Dev Elastic Agent Pool live acceptance

Use this non-product test to verify that the initialized SC Dev Manager scales the configured Coder Agent into multiple
same-generation runtime instances, enforces capacity, and restores the baseline. Run it only in an explicitly named,
disposable logical project such as `sc-dev-elastic-test`; never run it in base `sc-dev`.

## Preconditions

```mermaid
flowchart TD
  Actor["Actor: exact isolated-project Admin"] --> Gate{"Decision: direct human authorization, isolated instance, and idle roster verify?"}
  Gate -->|Allowed| Baseline["Allowed: record exact project, source revision, roster IDs, titles, and states"]
  Gate -->|Prohibited| Blocked["BLOCKED: perform zero lifecycle mutation"]
  Baseline --> Outcome["Outcome: mutation-safe test scope"]
  Blocked --> Outcome
```

The test may create, rename, message, and recoverably archive isolated workflow tasks only. Product files, Git state,
tickets, deployments, commands, credentials, and every task in base `sc-dev` are out of scope. Record the Admin,
Designer Reviewer, Manager, and baseline Coder IDs before mutation.

## Proxy Coder round-trip

```mermaid
flowchart TD
  Actor["Actor: isolated-project Admin"] --> Gate{"Decision: Proxy Coder identity, plugin inventory, and Ticket 57 Gate 1 evidence verify?"}
  Gate -->|Allowed| Handshake["Allowed: perform one non-product Hermes handshake"]
  Gate -->|Prohibited| Blocked["BLOCKED: report exact missing prerequisite and perform no fallback execution"]
  Handshake --> Prompt["Allowed: send one bounded arithmetic prompt through submit then status"]
  Prompt --> Verify{"Decision: correlated receipt and configured executor, provider, and model match?"}
  Verify -->|Yes| Pass["Allowed: record PROXY_CODER_LIVE_TEST=PASS"]
  Verify -->|No| Blocked
  Pass --> Outcome["Outcome: Proxy Coder path is independently proven"]
  Blocked --> Outcome
```

The visible Agent is named `Proxy Coder`; its stable Agent ID remains `proxy-coder`, its Role is `Worker`, and its
structured execution mode is `proxy`.
Use the prompt `Return only PROXY_CODER_4` for `2 + 2`. The Luna wrapper calls only the registered Hermes submit and
status operations and never answers independently. PASS requires a correlated completed status receipt, exact token
`PROXY_CODER_4`, and executor/provider/model values matching the initialization identity card. A missing plugin,
incomplete Ticket #57 Gate 1, submission failure, wrapper-authored answer, or mismatched receipt is a typed blocker—not
permission to ask for approval, start a local service, inspect product files, or substitute another execution route.

## Scale, dispatch, and capacity

```mermaid
flowchart TD
  Actor["Actor: isolated-project Manager"] --> Independent{"Decision: three zero-write assignments are independent?"}
  Independent -->|Yes| Scale["Allowed: bind baseline and create two same-generation Coders"]
  Independent -->|No| Blocked["BLOCKED: create nothing"]
  Scale --> Verify["Allowed: complete two-phase identity binding and title readback"]
  Verify --> Dispatch["Allowed: Designer Reviewer sends three canonical no-tool packets"]
  Dispatch --> Limit{"Decision: fourth assignment exceeds maxActive 3?"}
  Limit -->|Yes| Refuse["Allowed: return BLOCKED_ELASTIC_POOL_CAPACITY and create nothing"]
  Limit -->|No| Blocked
  Refuse --> Outcome["Outcome: scale and hard limit verified"]
  Blocked --> Outcome
```

Use correlation `elastic-live-test-<timestamp>` and these assignments:

- `elastic-a` returns exactly `ELASTIC_A_DONE`;
- `elastic-b` returns exactly `ELASTIC_B_DONE`;
- `elastic-c` returns exactly `ELASTIC_C_DONE`;
- `elastic-d` is requested only after the first three are active and must be refused.

The three active titles are `🔀 Coder (1) [elastic-a]`, `🔀 Coder (1) [elastic-b]`, and
`🔀 Coder (1) [elastic-c]`. Creation retains generation `1` and uses `initializedPoolMemberTaskId: pending` followed by
an exact `POOL_MEMBER_IDENTITY_BINDING`. Each assignment packet includes exact caller/recipient/return IDs, Agent IDs and
names, Roles, all four project coordinates, correlation, label, expected token, direct-human test authorization,
zero-write intent, prohibited effects, and evidence requirements.

Planned calls, prompt text, send receipts, commentary, or copied tokens are not execution evidence. Each token requires
the actual completed destination turn ID. The fourth request must return `BLOCKED_ELASTIC_POOL_CAPACITY` and a roster
readback proving that no fourth Coder was created.

## Settlement and result

```mermaid
flowchart TD
  Actor["Actor: Manager after three terminal receipts"] --> Gate{"Decision: every handoff delivered and no packet pending?"}
  Gate -->|Yes| Restore["Allowed: restore baseline title and archive two created members"]
  Gate -->|No| Blocked["BLOCKED: retain state and report exact pending evidence"]
  Restore --> Verify{"Decision: one original plain Coder remains and created IDs are inactive?"}
  Verify -->|Yes| Pass["Allowed: emit DEV_ELASTIC_AGENT_POOL_LIVE_TEST=PASS"]
  Verify -->|No| Fail["BLOCKED: emit FAIL with first unmet assertion"]
  Pass --> Outcome["Outcome: pool behavior verified and isolated roster restored"]
  Fail --> Outcome
  Blocked --> Outcome
```

PASS requires `PROXY_CODER_LIVE_TEST=PASS`, three distinct same-generation active IDs at peak, three exact completed-turn tokens, refusal without a
fourth creation, two archived created-member readbacks, the original Coder restored to `🔀 Coder`, and zero effects
outside isolated task lifecycle. The terminal receipt includes correlation, logical/runtime project IDs, source revision,
baseline and created IDs, before/peak/after rosters, completed turn IDs, capacity evidence, and archive readbacks.
