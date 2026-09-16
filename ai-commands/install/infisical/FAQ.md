# Infisical FAQ

## Why do we need Infisical?

Profiles, workflows, agents, and applications need credentials, but those values should not live in Git, prompts, logs, Governor memory, or copies of `.env` files spread across machines. Infisical provides one controlled secret service where actual values can be stored, authorized, audited, rotated, and retrieved at runtime.

The AI Fleas contract remains provider-neutral: consumers should depend on the `secrets` capability rather than depending directly on Infisical. Infisical is the initial self-hosted backend.

## Why do we need PostgreSQL?

PostgreSQL is Infisical's durable source of truth. It stores the encrypted secret dataset and the metadata needed to operate the service, including identities, projects, authorization/policy information, audit information, and other persistent application state. PostgreSQL is not an additional secret API; it is an internal dependency of Infisical and is not exposed to clients.

## Why do we need Redis?

Redis supports operational state such as sessions, caching, queues, and background/scheduled work. It is not the durable secret database. The installation authenticates Redis and keeps it private to the application stack.

## Why not just use `.env` files?

A local `.env` file is simple for one process on one machine, but it becomes difficult to manage when the same profile is used by a MacBook, an always-on controller, servers, and unattended agents. Copies drift, rotation becomes manual, revocation is coarse, and it becomes easy to accidentally expose values through Git, logs, backups, or prompts.

A secret service lets the profile contain stable logical references while each authorized runtime retrieves only what it needs.

## If the secret store contains secrets, do we need another secret to access it?

Yes. This is the bootstrap-identity problem; a secret manager does not eliminate authentication.

The intended model is that each machine or unattended runtime keeps one protected bootstrap credential representing its own machine identity. That identity authenticates to the secret service and is authorized for a narrow set of secret paths. It should not contain a copy of every application secret.

```text
profile / workflow
      |
      | requests logical secret name
      v
connect/secrets
      |
      | machine identity
      v
Infisical API
      |
      | authentication + authorization
      v
requested secret only
      |
      v
process that needs it
```

Compromising one narrowly scoped machine identity should therefore not automatically disclose unrelated secrets.

## Where should the bootstrap machine credential live?

Outside Git and outside the AI Profile, in protected local machine storage with permissions appropriate to the operating system and runtime. It must not be written into prompts, ordinary logs, Governor memory, screenshots, or reusable command examples.

For unattended 24/7 services, the credential must be available to the service after reboot without requiring an interactive human login, while still being scoped to that service's identity.

## Can 24/7 agents use Infisical without a human logging in?

Yes. That is one of the main reasons for using machine identities. An unattended agent authenticates as its own machine/service identity and receives only the secrets authorized for its work. Human credentials should not be reused as unattended-agent credentials.

## Can applications and services use Infisical directly through an API?

Yes. Infisical provides programmatic interfaces intended for applications and machine identities. A normal application may use an appropriate Infisical API/SDK/CLI integration directly when that is the best boundary.

Inside AI Fleas, workflows and generic commands should normally use the provider-neutral `connect/secrets` capability. That keeps workflow contracts independent of the current secret-store product and allows the backend to be replaced later without rewriting every consumer.

## Does a retrieved secret become visible to the agent?

It should not unless the operation genuinely requires the model itself to know the value. The preferred path is execution-time delivery to the child process or service that needs the credential. Secret values must not be copied into prompts, model context, receipts, reports, or logs merely because an agent initiated the operation.

## Is the system secure if the Infisical host is compromised?

No design should assume that a fully compromised running secret-service host is harmless. Encryption at rest protects stored data in important scenarios, but a sufficiently privileged attacker controlling a running authorized host may be able to access decrypted material or runtime credentials.

The design therefore uses defense in depth: private datastore networks, authenticated Redis, protected files, encrypted transport, least-privilege identities, narrow secret authorization, no values in Git/logs/memory, revocable machine identities, backups, and restricted remote access.

## What happens when Infisical is unavailable?

New secret retrievals should fail closed. AI Fleas must not silently fall back to invented credentials or an unrelated secret source. A process that already received a credential may continue until that process or credential expires, depending on the consumer; availability and credential caching are consumer-specific concerns.

## Does installing Infisical expose it to the Internet?

No. The installation capability is responsible for the secret-service stack and its private/local endpoint. Remote publication is a separate connection concern. A deployment can remain LAN/loopback-only when no remote client needs it.
