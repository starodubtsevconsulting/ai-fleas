# obsidian.command

## Purpose

Use `obsidian` as a local Markdown vault interface for a profile-authorized folder. The configured filesystem
project is the source of truth; Obsidian is an editor, not the storage or sync provider. This command has no delete
operation.

## Configuration

The profile registers `obsidian` with profile-wide defaults in `commands[].config`. A workflow that uses it must
explicitly reference a workflow-owned override in `editors[].config`:

```yaml
schema_version: obsidian-command-config.v1
vault_project_ref: projects/path/to/article-project.yml
vault_name: articles
```

Resolve `vault_project_ref` to an exact project registered to the active workflow. Resolve its `storage_path` to a
canonical local folder. Verify that Obsidian's registered vault named `vault_name` points to that same folder before
opening notes. A matching name alone is insufficient; if the name or path disagrees, stop and report the mismatch.
Do not infer the folder from a sidebar label, open note, cwd, or sync-provider name.

## Supported operations

- `verify-vault`: check the folder exists and the Obsidian registration points to its exact path; report the result.
- `open-vault`: open that registered vault. If it is not registered, the human may authorize registering the exact
  existing folder as a vault; registration must not rename, move, or duplicate the folder.
- `open-note`: resolve a requested note within the configured project root, then open it in the verified vault.
  Reject path traversal and foreign folders.
- `create-or-update-note`: write an authorized Markdown note within the configured project root, preserving the
  existing archive layout and unrelated content; read back the saved result.

There is no delete, empty-trash, cleanup, bulk-move, or automatic synchronization operation. External sync software
may sync the local folder, but this command must not create a second sync path. A failure to verify the exact vault
or write path blocks mutation while leaving source files intact.
