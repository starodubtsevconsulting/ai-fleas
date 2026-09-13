# permanent-memory-synology

Provider adapter for accessing permanent human-readable memory stored on a Synology filesystem, commonly an Obsidian vault.

## Usage

```bash
permanent-memory-synology.command.sh check
permanent-memory-synology.command.sh info
permanent-memory-synology.command.sh list [relative-path]
permanent-memory-synology.command.sh read <relative-path>
permanent-memory-synology.command.sh recent [days]
permanent-memory-synology.command.sh inbox
printf '%s' 'note content' | permanent-memory-synology.command.sh write Concepts/example.md
permanent-memory-synology.command.sh delete Concepts/example.md --confirm
```

Configuration follows the normal AI Fleas command-config resolution. See `permanent-memory-synology.command.example.config`.

## Intended AI use

An AI can use `check`/`info` to understand the configured memory capability, `recent` for activity review, `inbox` for fleeting-note review, and `read` for canonical permanent context. Writes require explicit profile configuration; deletion additionally requires explicit action confirmation.

The Personal Governor should normally consume permanent memory through a provider-neutral memory layer. This command is the Synology transport/provider implementation beneath that layer.
