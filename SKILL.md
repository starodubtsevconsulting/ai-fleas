# Repository-Wide Naming Refactor

Use when you need to rename identifiers (command IDs, platform names, directory names, config keys) across an entire repository while preserving semantic accuracy.

A naming refactor must preserve the *intended meaning* of each identifier. Different contexts may require different naming rules:

- **Physical application identifiers** (install commands, CLI tools): Keep original naming that reflects the actual software being installed (e.g., `chatgpt`, `hermes`, `codex`)
- **Logical platform/agent identifiers**: Use descriptive names that reflect the purpose (e.g., `gpt-agents`, `hermes-agents`)

## Workflow

1. **Inventory phase**: Identify all occurrences of the old name across the codebase
   - Search in `.md`, `.yml`, `.yaml`, `.sh`, `.tsv`, `.json` files
   - Distinguish between literal string occurrences and naming conventions
   - Identify which contexts require renaming vs which should preserve the original

2. **Classify contexts**: Determine whether each occurrence should:
   - Be renamed to the new identifier
   - Remain unchanged (physical install commands)
   - Be mapped via aliases (e.g., `gpt-app` → `chatgpt` routing)

3. **Systematic renaming**:
   - Rename directories and spec files first
   - Update all command ID references in platform contracts
   - Update workflow profiles and execution routes
   - Update example configs and READMEs
   - Preserve legacy aliases only in routing logic (e.g., install command patterns)

4. **Verification**: Run final grep search to confirm no unintended references remain

## Pitfalls

- **Don't rename install command names**: The physical application installation (e.g., `chatgpt install`) should keep its semantic name. Only rename logical platform identifiers.
- **Don't break legacy aliases**: Install scripts may need to accept both old and new names as routing aliases (e.g., `gpt`, `gpt-app`, `chatgpt` all route to `chatgpt`)
- **Directory names may not match command names**: Verify directory naming conventions (e.g., `/platforms/hermes/` exists without `-app` suffix)
- **Example configs added in recent commits**: Check for newly added files that may not be in git history yet

## Template

Before renaming, establish:
- Old identifier: `gpt-app` / `hermes-app`
- New identifier: `gpt-agents` / `hermes-agents`
- Physical install commands to keep unchanged: `chatgpt`, `hermes`
- Routing logic to preserve: `gpt|gpt-app|chatgpt` → `chatgpt`

This skill is for systematic, comprehensive refactors—not one-off renames. For single-file updates, use targeted patch operations instead.
