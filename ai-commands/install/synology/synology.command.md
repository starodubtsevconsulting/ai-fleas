# Synology

## Purpose

Use `synology` to discover, open, diagnose, and configure a Synology NAS. Reusable mechanics and safety rules live in
this public command. Server addresses, share names, account names, permission choices, and secret references belong to
the selected private profile or operator record.

## Supported operations

| Operation | Implementation |
| --- | --- |
| Discover a NAS on the local network | `find-synology-ip.sh` |
| Open DSM for administration | `open-synology.sh` |
| Run a bounded connectivity diagnostic | `beep-diagnostic.sh` |
| Validate a private named-share catalog | `synology.command.sh validate` |
| Produce a value-free reconciliation plan | `synology.command.sh share plan <share-id>` |
| Create a named, least-privilege agent share | `synology.command.sh share apply <share-id> --apply` |

`find-synology-ip.sh` is non-mutating. On macOS it uses the ARP table and Synology's registered MAC prefix, then
requires a live DSM, SMB, or Synology Drive port. On Linux it may additionally use an already-installed `nmap`; it never
installs packages or requests `sudo`. Prefer the stable Finder SMB service name when Bonjour exposes one, while keeping
the current numeric IP as diagnostic evidence rather than durable configuration.

The profile config owns NAS and share names, source and mount paths, and access mode. Credentials are injected only as
environment variables by `secrets run synology -- ...`; the command never accepts a password argument. Mutation remains
fail-closed until its DSM driver has been verified against the selected NAS version.

## Agent memory contract

A share with `usage: memory` is an agent retrieval surface. Agents may search, list, and read it through its dedicated
read-only identity. When `mutation: source-control`, durable changes must be proposed in the mapped repository and
branch/subpath; an `on-merge` publisher updates the persistent memory after validation. The mounted Synology projection
must not be edited directly, even when the local operating system happens to permit a write.

Use `mutation: direct` only for a purpose-built writable share such as a download inbox or generated-artifact drop.
Declare that as a separate share and credential boundary rather than widening an existing memory identity.

## Safety

- Never place a DSM, SMB, or share password in Git, command arguments, terminal history, documentation, or agent text.
- Use a dedicated non-admin Synology identity for each independently revocable share or trust boundary.
- Grant only the selected shared folder and required protocol. Prefer read-only access unless the workflow must write.
- Require read-only access for a source-controlled memory projection.
- Treat moving existing data into a new top-level share as a separate migration with backup and rollback evidence.
- Do not claim that a Finder favorite, Synology Drive sync root, alias, or symbolic link is a Synology permission boundary.

## Use case scenarios

- [Persistent agent memory](use-cases/memory.md): read-only retrieval with durable changes delivered through Git.
- [Download destination](use-cases/downloads.md): direct writes to a separately bounded inbox without version control.
- [Named-share provisioning](use-cases/named-share-provisioning.md): create the share, identity, permissions, secret
  references, migration, and verification boundary.
