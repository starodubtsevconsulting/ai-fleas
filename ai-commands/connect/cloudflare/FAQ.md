# Cloudflare FAQ

## Why do we need Cloudflare?

A private service may need to be reached by an authorized client that is outside the home or office network. Cloudflare Tunnel provides an outbound connection from a controlled gateway to Cloudflare, so the deployment does not require a normal inbound router port-forward or a publicly reachable origin address.

If every consumer is local, Cloudflare is not required. Remote publication should be an explicit choice rather than a property of installing the underlying service.

## Why would a secret service need remote access?

It does not always need it. A LAN-only secret service is preferable when all consumers are on the same trusted network.

Remote access becomes useful when an authorized MacBook, server, application, or unattended agent needs to retrieve a secret while outside that network. The purpose is to make the authenticated secret-service API reachable to those authorized clients, not to publish secret values.

## Are we exposing our secrets to the Internet?

No secret values are intentionally published as public content. What becomes reachable is an authenticated service endpoint behind Cloudflare Access/Tunnel and the secret service's own authentication and authorization.

This still increases the attack surface compared with a LAN-only service, so the remote path must remain explicitly configured, authenticated, encrypted, monitored, and revocable. Cloudflare Access is an additional boundary; it does not replace Infisical authorization.

## Why not use router port forwarding?

A tunnel avoids opening a normal inbound port to the origin, hides the origin address from ordinary public routing, supports an identity-aware Access layer, and makes a remote route easier to disable independently. The connector initiates outbound connections instead of accepting arbitrary inbound Internet connections at the router.

## Does Cloudflare store our Infisical secrets?

Cloudflare is the transport/access layer, not the Infisical datastore. Secrets remain stored by the secret service. However, the exact confidentiality boundary depends on the TLS design: traffic processed or terminated by an intermediary should not be described as cryptographically invisible to that intermediary unless the architecture actually provides end-to-end encryption that excludes it.

The command therefore keeps origin certificate verification enabled and treats Cloudflare as part of the trusted remote-access path, not as the secret database.

## If Infisical already requires authentication, why also use Cloudflare Access?

They protect different boundaries. Cloudflare Access decides which users or machines may reach the public hostname. Infisical then authenticates that caller and decides which projects/secrets the identity may use. Defense in depth means an unauthenticated Internet client should normally fail before it reaches the secret service at all.

## How does a machine or 24/7 agent connect?

A machine should use non-interactive credentials intended for machine-to-machine access. At the Cloudflare boundary this may be a narrowly scoped Access service token; at the secret-service boundary it uses its own Infisical machine identity. These are different credentials with different purposes.

```text
24/7 agent / service
      |
      | Cloudflare machine access credential
      v
Cloudflare Access + Tunnel
      |
      | encrypted route to private origin
      v
Infisical API
      |
      | Infisical machine identity + authorization
      v
allowed secret(s)
```

A human browser can use an approved interactive identity provider instead. Human browser credentials should not be reused for unattended services.

## Why does this seem to require several secrets just to retrieve one secret?

Bootstrap credentials are unavoidable somewhere. The goal is not to reach zero credentials; it is to minimize and scope them.

A machine may hold a small bootstrap identity for the remote-access boundary and another identity for the secret service. Those credentials should be narrowly scoped and revocable. They then provide controlled access to many application secrets without copying those application secrets permanently onto every machine.

## Can another application use the same endpoint through an API?

Yes, when explicitly authorized. Infisical is designed for programmatic secret access, so applications and services can use its API/SDK/CLI interfaces with machine identities. Cloudflare can protect that API endpoint in the same way it protects a browser endpoint, using machine-to-machine Access credentials rather than an interactive login.

AI Fleas consumers should normally go through the provider-neutral `connect/secrets` capability when they need portability between secret backends. Applications that have a good reason to integrate directly with Infisical may do so without changing the Cloudflare transport boundary.

## Should every agent share one Cloudflare or Infisical credential?

No. Independent machines/services should have independent identities whenever practical. A 24/7 media worker should not inherit infrastructure, financial, or unrelated application privileges simply because another agent needs them.

Separate identities make access auditable and allow one compromised or retired machine to be revoked without rotating every unrelated credential.

## What happens if a machine credential is stolen?

Treat it as compromised and revoke it. Least-privilege authorization limits the expected blast radius: the stolen identity should expose only the routes and secrets that machine was authorized to use. This is why one universal credential shared by every agent is undesirable.

## Is Cloudflare required by `install/infisical`?

No. Installation and remote access are separate capabilities. Infisical can run privately without Cloudflare. `connect/cloudflare` is one optional way to make an explicitly selected private endpoint remotely reachable.

## Can we replace Cloudflare later?

Yes. The secret-store contract should not depend on Cloudflare. Another VPN, private overlay network, gateway, or access provider can be used if it provides the required authenticated and encrypted connectivity. Keeping installation, secret retrieval, and remote transport as separate capabilities is what makes that replacement possible.
