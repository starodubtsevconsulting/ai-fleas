# Social Publish — architecture/design

## Problem

Useful artifacts already emerge from development, writing, multimedia, research, and product work. Distribution should reuse those artifacts with minimal incremental attention rather than creating a separate content treadmill.

The human-facing workflow should be: **produce real work -> intentionally enqueue/share it -> return to work**.

## Command vs workflow

`social-publish` is a command/capability, not a social-media workflow.

Writing, Blogging, Multimedia, Development, or another workflow may prepare an artifact. Their release/publishing policy decides whether distribution is applicable. `social-publish` performs the provider-neutral queue/publication operation and returns evidence.

If repeated cross-workflow distribution later requires shared orchestration (adapt media, approve, enqueue, collect receipts), introduce a small reusable distribution flow. Do not create that flow before repeated use proves it is necessary.

## Provider adapter

Initial candidate: Buffer.

Buffer-specific authentication, API/CLI behavior, channel identifiers, limits, and response translation belong behind an adapter. The portable command contract should survive replacing Buffer.

Re-verify provider capabilities, pricing/free-plan limits, API/CLI availability, and destination support from official provider documentation at implementation time. Do not encode today's commercial limits as permanent AI-Fleas rules.

## Proposed portable operations

- `draft` — prepare provider-side unpublished state when supported.
- `queue` — enqueue according to provider/profile scheduling semantics.
- `now` — publish immediately only with explicit authority.
- `status` — retrieve normalized state/receipt.

A provider that lacks one operation should fail clearly or map only when semantics are equivalent.

## Artifact contract

Minimum conceptual input:

```yaml
text: short caption
media:
  - path: artifact.png
link: https://example.invalid
channels:
  - instagram
mode: queue
```

Profiles own provider/account capability bindings, secrets, and the profile-local configuration attached to project references. A project reference may declare distribution intent: which configured account/channel references that project may target, plus defaults such as draft/queue policy. The referenced project repository/folder itself does not need to contain personal/profile distribution policy. Workflows prepare artifacts but do not choose the project's audience. Do not place credentials in the artifact.

Media resizing/cropping and destination-safe caption adaptation may be delegated to authorized multimedia/image capabilities, but `social-publish` should not invent new substantive content merely to fill a channel.

## Authority

Publication is an external side effect.

- Agent default: create draft/queue only when profile policy authorizes it.
- Immediate publication requires explicit human approval or an explicit pre-authorized profile policy.
- A draft/queue operation must not silently become immediate publication because a provider lacks draft semantics.
- Return the exact provider/channel/status and resulting URL/identifier when available.

## Secrets and privacy

Provider credentials/tokens are profile/runtime secrets. Resolve them through the configured secrets mechanism.

Private/client artifacts must not be projected into public social channels merely because the command is available. The invoking workflow/profile owns classification and publication eligibility.

## Relationship to existing workflows

**Writing/Blogging:** article publication and social distribution are separate. A published/scheduled article may produce a prepared social artifact; social distribution does not grant article-publication authority.

**Multimedia:** may prepare destination-appropriate image/video assets; distribution remains separate.

**Development:** screenshots/diagrams/tips that naturally emerge from real work may be intentionally distributed as side outputs. Development does not gain autonomous marketing authority.

## Initial validation

1. Create/configure one real social account intended for AI-Fleas distribution.
2. Connect it to the initial provider.
3. Re-check official provider API/CLI/free-plan capabilities.
4. Prepare one existing real-work artifact.
5. Dry-run when provider tooling supports it.
6. Queue/draft once under explicit human authority.
7. Verify provider status and final destination.
8. Record normalized receipt and observed friction.
9. Only then decide whether implementation belongs in AI-Fleas and whether more channels are justified.

## Non-goals

- social feed consumption;
- a content calendar;
- manufacturing posts to satisfy cadence;
- rebuilding a third-party social scheduler;
- provider-specific command names in workflow contracts;
- automatic expansion to every social network.

## Open design questions

- Best command category: `publish/social`, `distribution/social`, or another existing command taxonomy.
- Whether a generic distribution flow becomes justified after real use.
- Exact adapter interface and normalized receipt schema.
- Whether media adaptation is invoked by the caller or by a distribution flow.
- How queued posts are reconciled back into durable publication evidence.
