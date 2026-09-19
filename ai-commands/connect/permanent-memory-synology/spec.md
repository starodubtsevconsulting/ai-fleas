# permanent-memory-synology command specification

## Purpose

Integrate a profile's permanent human-readable memory with a Synology-hosted filesystem, typically an Obsidian vault, without exposing Obsidian itself as a server.

The command is an infrastructure/provider adapter. Higher-level consumers should reason in provider-neutral memory terms rather than depending directly on Synology, SSH, SFTP, Tailscale, or Obsidian.

## Transport

V1 supports a local Synology Drive filesystem projection and SSH/SFTP-compatible access to a Synology host. The local projection is preferred for desktop agents because Synology Drive owns authentication and synchronization while the command remains bounded to one configured root.

The command must not require the NAS to be publicly exposed.

## Configuration

Profile-owned configuration supplies connection and vault details. Secrets must not be committed to the public repository.

Required logical values:

- host
- user
- permanent-memory root/vault path

Optional values:

- port (default 22)
- SSH identity file
- transport/network hint
- access mode (`read-only` or `read-write`)
- semantic directory mapping

## Operations

### `init`

Create the configured semantic directories inside an existing writable local filesystem projection. Preserve existing directories and content, and fail when a configured area conflicts with an existing non-directory object. Share and account provisioning remain the responsibility of `connect/synology`.

### `check`

Validate configuration, network/SSH reachability, authentication, root path, and effective read/write permissions without modifying permanent knowledge.

### `info`

Return provider-neutral information useful to an AI: configured memory root, access mode, semantic areas, transport status, and capability summary. Never print private keys or secret material.

### `list [relative-path]`

List memory objects/directories beneath the configured root. Reject traversal outside the root.

### `read <relative-path>`

Read one text/Markdown memory object beneath the configured root.

### `recent [days]`

Return recently modified permanent-memory objects, defaulting to 7 days, for consumer review and activity inspection.

### `inbox`

List the configured fleeting/inbox area for memory-review procedures.

### `write <relative-path>`

Write/update text only when configured `read-write`. Input content is read from stdin. V1 must not silently overwrite an existing file unless `--force` is supplied.

### `delete <relative-path>`

Delete only when configured `read-write` and explicit `--confirm` is supplied. Reject directory-wide recursive deletion in v1.

## Permanent-memory semantics

The adapter supports the common Zettelkasten-inspired semantics introduced under `_common/memory/methods/zettelkasten/v1.md`:

- Inbox / fleeting capture
- References
- Concepts / permanent notes
- Outputs

Physical directory names are configurable because an existing Obsidian vault may use different names.

## AI behavior

Output should be concise, deterministic, and machine-readable enough for an AI agent to use from a terminal. `info` and `check` should emit `key=value` records. Listing/recent operations should emit one relative path per line.

The command supports higher-level review procedures, but it does not contain consumer-specific strategy.

## Security

- never commit credentials or private keys;
- prefer a dedicated Synology account scoped to the permanent-memory share/root;
- support read-only mode;
- canonicalize paths and reject root escape/traversal;
- do not expose the whole NAS merely because the configured account can access it;
- do not print secret environment/config values;
- writes/deletes are blocked unless explicitly configured;
- delete requires per-action confirmation.

## Non-goals

V1 does not implement a semantic/vector index, Mem0, Obsidian plugin/server, public HTTP service, Synology administration, automatic Tailscale installation, or automatic conversion of fleeting notes into permanent knowledge.
