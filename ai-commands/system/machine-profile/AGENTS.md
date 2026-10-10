# Machine Profile Command Learnings

## Installer path for `--box`

- **What happened:** `machine-profile.command.sh --box` invoked the provider installer through `$commands_root/install/...`, but that path did not reach the installer.
- **Root cause:** `commands_root` resolves to `ai-commands/system`, while the installer is located relative to this command's directory under `ai-commands/install`.
- **How we fixed it:** Resolve the installer from `command_dir` with `../../install/ai-local-provider/install-ai-local-provider.sh`.
- **How to avoid:** For paths to sibling command trees, calculate from `command_dir` rather than assuming `commands_root` is the repository's `ai-commands` root.
- **Verification:** Run `machine-profile.command.sh --box <logical-machine-id>` with a configured box and confirm the inspect invocation reaches the provider installer.
