# Self-Learning Command Specification

## Overview

The `self-learning` command provides a framework for agents to extract session learnings and "aha moments" into machine-readable knowledge files.

## Learning Sources

Knowledge can be extracted from:
1. Session struggles (errors, confusion, unexpected behavior)
2. Novel solutions (new patterns, techniques)
3. Configuration insights (how files relate, what must be in sync)
4. Debugging patterns (how to verify, what to check first)

## Knowledge File Locations

| Scope | Knowledge File | Purpose |
|---|---|---|
| Root | `AGENTS.md` | Repository-wide rules and patterns |
| Command | `<command>/AGENTS.md` | Command-specific learnings |
| Workflow | `<workflow>/AGENTS.md` | Workflow-specific patterns |
| Profile | `ai-profile/<profile>/AGENTS.md` | Profile-specific config patterns |
| Skill | `SKILL.md` | Skill-specific patterns |

## Extraction Format

Each learning should follow this structure:

```markdown
## [Problem Area]

* **What happened**: Brief description of the struggle or issue
* **Root cause**: What caused it (config mismatch, env var, file sync issue)
* **How we fixed it**: The solution or workaround
* **How to avoid**: Prevention tips for future sessions
* **Verification**: How to check the fix worked
```

Example from this session:

```markdown
## Financial Insights Workflow Setup

* **What happened**: User had 3 agents (financial-analyst, bookkeeper, financial-reviewer) but only wanted bookkeeper
* **Root cause**: Agent declarations were in 5 separate locations:
  1. `ai-workflows/financial-insights/agents.yml` (roster)
  2. `ai-workflows/financial-insights/agents/roles/` (role files)
  3. `ai-profile/sc/commands-config/hermes-agents/config.yml` (runtime config)
  4. `platforms/gpt-agents/agents/financial-insights-roster.test.mjs` (test)
  5. `platforms/hermes/workflows/financial-insights/acceptance.md` (docs)
* **How we fixed it**: Updated all 5 locations together, deleted unused role files, ran reconcile
* **How to avoid**: When simplifying agents, always update ALL 5 locations
* **Verification**: Run `node resolve-workflow-scope.mjs` - should output only declared agents
```

## Learning Categories

### Configuration Learning
When multiple config files must be kept in sync:

```markdown
## [Configuration Area]

* **Config files that must be in sync**:
  - `file1.yml` (what it controls)
  - `file2.yml` (what it controls)
* **What happens if out of sync**: [consequence]
* **How to verify sync**: [command or check]
```

### Environment Variable Learning
When env vars must/cannot be set:

```markdown
## [Env Var Name]

* **Must be set**: When/where it's required
* **Must NOT be set**: When it causes issues
* **Correct value**: Example or how to determine
* **Verification**: How to check if set correctly
```

### File Relationship Learning
When files must be updated together:

```markdown
## [Change Type]

* **Files to update together**:
  1. `file1` - what to change
  2. `file2` - what to change
  3. `file3` - what to change
* **How to verify**: [command or check]
* **Common mistake**: [what people forget]
```

## Quality Standards

Learnings should be:
1. **Concise** - bullet points, not paragraphs
2. **Actionable** - clear guidance for future agents
3. **Testable** - include verification steps
4. **Referenceable** - use code blocks for commands
5. **Categorical** - organize by problem area

## Validation

Run `self-learning review <path>` to verify knowledge file quality:

- [ ] No duplicate entries
- [ ] Each entry has all 5 required fields
- [ ] Commands are executable and tested
- [ ] Paths are relative and correct
- [ ] No credentials or sensitive data

## Integration with Workflow Agents

Every workflow agent should:

1. **On session start**: Scan `AGENTS.md` in working directory first
2. **During session**: Extract learnings as they occur
3. **On session end**: Run `self-learning extract` to document key struggles

## Command Runner

The command runner uses `self-learning.command.sh` to execute extractions. The command should:
1. Parse session transcripts
2. Identify learning opportunities
3. Suggest updates to MD files
4. Apply updates when approved

## Example Extraction

```
$ self-learning extract financial-insights
Found 3 learnings:

1. Financial Insights Workflow Setup
   File: ../../ai-workflows/financial-insights/AGENTS.md
   Status: Suggested update

2. Config File Locations
   File: ../../ai-profile/sc/AGENTS.md
   Status: Suggested update

3. HERMES_HOME Environment Variable
   File: ../../ai-commands/system/hermes-agents/AGENTS.md
   Status: Suggested update

Run 'self-learning update' to apply these suggestions.
```
