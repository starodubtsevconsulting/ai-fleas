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
| Create a named, least-privilege agent share | [`synology.scenario.md`](synology.scenario.md) |

The named-share scenario is currently an operator procedure. It does not automate DSM administration or accept a
password on a command line.

## Safety

- Never place a DSM, SMB, or share password in Git, command arguments, terminal history, documentation, or agent text.
- Use a dedicated non-admin Synology identity for each independently revocable share or trust boundary.
- Grant only the selected shared folder and required protocol. Prefer read-only access unless the workflow must write.
- Treat moving existing data into a new top-level share as a separate migration with backup and rollback evidence.
- Do not claim that a Finder favorite, Synology Drive sync root, alias, or symbolic link is a Synology permission boundary.

## Related scenario

See [Create a named agent share](synology.scenario.md#create-a-named-agent-share).

