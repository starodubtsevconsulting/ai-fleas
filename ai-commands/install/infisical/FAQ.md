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

## Where does an agent get the Infisical web URL?

Use only the activated profile and workflow. Find the `commands` entry whose `id` is `infisical`, resolve its private
`config` path, and read `SITE_URL`. That is the canonical browser URL the agent may return to the human. Do not copy the
URL from this public package's example configuration, infer it from a machine name, or reuse a URL remembered from another
profile.

Read `ACCESS_MODE`, `SSH_TARGET`, `BACKEND_PORT`, `PROXY_PORT`, and `ORIGIN_SERVER_NAME` from the same configuration when
explaining how the endpoint is reached. `SITE_URL` configures Infisical links; it does not by itself create DNS, a tunnel,
an Access policy, or a firewall route. Before presenting it as usable, status or acceptance evidence must show that the
corresponding access path exists.

If a separately configured `connect/cloudflare` target publishes this service, its selected private configuration supplies
`CLOUDFLARE_PUBLIC_URL`. That value and Infisical's `SITE_URL` should identify the same intended public service. A mismatch
is a configuration blocker, not permission to choose one arbitrarily.

## How is the web UI accessed locally or from outside?

The installer publishes only host-loopback ports. It never exposes PostgreSQL or Redis, and it does not create a direct
LAN listener.

| Configuration | Browser access |
| --- | --- |
| `ACCESS_MODE=core`, on the Docker host | The backend listens at `http://127.0.0.1:<BACKEND_PORT>`. Use the configured `SITE_URL` as the canonical application URL. |
| `ACCESS_MODE=core`, from an operator workstation | Create an authorized SSH forward with `ssh -N -L <local-port>:127.0.0.1:<BACKEND_PORT> <SSH_TARGET>`, then open `http://127.0.0.1:<local-port>`. This is a private maintenance path; it does not create outside access. |
| `ACCESS_MODE=cloudflare`, from outside | Open the configured `SITE_URL`. Cloudflare Access may authenticate the user first; Infisical then performs its own authentication and authorization. |
| `ACCESS_MODE=cloudflare`, origin-local diagnostics | The private origin listens at `https://127.0.0.1:<PROXY_PORT>`. A client must use `ORIGIN_SERVER_NAME` for TLS hostname verification and trust the configured private CA. Do not disable certificate verification. |

For a local browser test of the Cloudflare-mode origin, an operator may forward `PROXY_PORT` over SSH, but the browser
must still connect with the configured origin hostname and trust its private CA. The public `SITE_URL` remains the normal
human-facing link. If `ACCESS_MODE=core` and no separate access provider is configured, there is no outside URL.

## Why can the Access login work while Infisical returns HTTP 503?

Cloudflare Access is evaluated at the edge before the tunnel reaches the private origin. A successful login page or
unauthenticated redirect proves the edge policy is reachable, but it does not prove cloudflared can load its origin CA or
connect to Nginx. In Cloudflare mode, verify that account-side `caPool` equals `origin_ca_file`, the owned CA copy is
mounted read-only at that exact path inside cloudflared, the private TLS origin returns `/api/status`, and an authorized
public request returns HTTP 200. A merely running connector is not sufficient readiness evidence.
