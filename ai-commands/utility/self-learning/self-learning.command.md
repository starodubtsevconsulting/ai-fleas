# self-learning.command

## Purpose

Use `self-learning` to extract session struggles, learnings, and "aha moments" into machine-readable knowledge MD files across the repository.

## Inputs

| Input | Required | Source | Description |
|---|---|---|---|
| Active AI Profile and workflow | Yes | Host activation | Authorizes execution and resolves profile-owned configuration. |
| Learning scope | Yes | User request or command runner | The specific knowledge domain to update (e.g., "financial-insights workflow", "Hermes profile initialization", "config file locations"). |

## Outputs

| Output | Destination | Description |
|---|---|---|
| Updated knowledge MD files | Repository paths | New or updated AGENTS.md, SKILL.md, or knowledge files with session learnings. |
| Knowledge artifact path | Caller | The exact path(s) of files updated. |
| Summary of extracted learnings | Caller | List of key struggles and their resolutions documented. |

## Entry Point

| Entry point | Type | Profile-aware invocation |
|---|---|---|
| `self-learning/self-learning.command.md` | AI-readable contract | The initialized workflow role loads this contract after the host activates the selected profile and workflow. |

Every invocation is profile-aware: the host must verify that the active workflow allows this command, resolve `AI_COMMANDS_ROOT`, and provide any profile-owned configuration before this entry point is used.

## Instructions for Agents

### When a Session Starts

**The FIRST thing to do when starting any new task is:**

1. **Scan the AGENTS.md files in relevant directories** before reading any other files
2. Look for patterns like:
   - "When X fails, try Y"
   - "Always update A, B, and C together"
   - "The HERMES_HOME env var must NOT be set"
   - "Only bookkeeper agent exists - remove others from 5 locations"
   - File paths and their relationships
3. These files contain "aha moments" from previous sessions - use them to avoid repeating struggles

**Do NOT scan the entire repository first** - this wastes tokens and context. Instead:
1. Check `AGENTS.md` in the working directory and parent directories
2. Check `SKILL.md` if in a skill-specific folder
3. Only then proceed to read the specific files needed

### When Learning During a Session

As you work and encounter struggles or novel solutions:

1. **Extract the learning** into a concise, referenceable format
2. **Update the nearest AGENTS.md or create SKILL.md** with:
   - What the struggle/issue was
   - What caused it
   - How it was resolved
   - How to avoid it in the future
3. **Make it skimmable** - use bullet points, code blocks, and clear headers
4. **Keep it factual** - no opinions, only what was learned

### Format Guidelines

**For AGENTS.md in workflow directories:**
```markdown
## [Problem Area]

* When doing X, always update Y, Z, and W together
* HERMES_HOME must NOT be set when running hermes-agents commands
* Config file at `path/to/config.yml` is Git-ignored
* To verify: run `command` and check `file` contains `value`
```

**For SKILL.md in skill folders:**
```markdown
# [Skill Name] Knowledge

## When to use this skill

Trigger: [specific scenario]

## Common pitfalls

* [issue] -> [solution]
* [issue] -> [solution]

## Quick reference

[command or pattern]
```

### What to Extract

Extract learnings about:
1. **Configuration mismatches** - when multiple files must be in sync
2. **Environment variables** - which ones must/cannot be set
3. **File relationships** - which files must be updated together
4. **Debugging patterns** - how to verify configuration is correct
5. **Common failure modes** - what breaks and how to fix it

### What NOT to Extract

Don't extract:
1. Step-by-step task instructions (use workflow docs instead)
2. Personal opinions or preferences (state facts only)
3. Session logs or conversation history
4. Credentials or sensitive data

## Command Runner

Use `self-learning self-learning.command.sh run <scope> -- <extracted-knowledge>` to execute the command. The command runner extracts knowledge from the session and updates the appropriate MD files.

## Subcommands

| Subcommand | Purpose |
|---|---|
| `extract <scope>` | Scan current session for learnings and suggest updates |
| `update <scope> --file <path>` | Manually specify which file to update |
| `scan <directory>` | Scan a directory for existing knowledge and suggest additions |
| `review <path>` | Review a specific MD file for completeness |

## Linked Commands

| Command | Relationship | Use when |
|---|---|---|
| `doc` | Complementary | Update human documentation after self-learning extracts the key points |
| `new-feature-doc` | Complementary | Create docs for new features using extracted patterns |
| `spec` | Reference | Review specifications before updating knowledge files |

## Tags

#command #ai-command #self-learning #knowledge-extraction #agent-education

Define the portable contract for agents to learn from sessions and share knowledge across the repository.
