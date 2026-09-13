# cloudflare-connector.command

## Purpose

Install or verify the `cloudflared` connector binary used by Cloudflare Tunnel commands. This command owns only the
physical package lifecycle; tunnel, DNS, Access, connector-token, and service configuration remain owned by the
`connect/cloudflare` command.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes installation on the selected machine. |
| Operation | Yes | Caller | `status` or `install --apply`. |

## Entry point

`install/cloudflare/cloudflare-connector.command.sh`

## Behavior

- `status` reports whether `cloudflared` is on `PATH` and prints its version without changing the host.
- `install --apply` is idempotent and requires the explicit mutation flag.
- Homebrew is supported on macOS and other hosts where it is already available.
- If no supported package manager is detected, the command stops with official-package guidance instead of executing an
  unverified download script.
- Installation does not start a connector or operating-system service and never reads a tunnel token.

## Relationship to connect/cloudflare

`connect/cloudflare` delegates `install-connector --apply` to this command. After successful installation, the caller
must configure Cloudflare Access before running the tunnel. Connector service installation remains a separate explicit
action because it consumes a tunnel credential and changes host startup behavior.
