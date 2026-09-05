# Hermes

## Tags

#command #ai-command #hermes #local-ai #profile-management

Control the local Hermes installation and the repository-scoped SX-10 coding bot.

## Actions

```bash
ai-commands/hermes/hermes.command.sh setup --work-profile sc
ai-commands/hermes/hermes.command.sh list
ai-commands/hermes/hermes.command.sh show sx10-coder
ai-commands/hermes/hermes.command.sh status sx10-coder
ai-commands/hermes/hermes.command.sh delete PROFILE --confirm-delete
```

`setup` resolves the selected work profile's default workflow and sole project. It also accepts the options documented by
[`setup-sx10-coder.sh`](../../ai-launcher/scripts/hermes/setup-sx10-coder.sh), including `--profile`, `--workspace`,
`--endpoint`, and `--model`; those explicit options override resolved values. `WORK_PROFILE_ID` can supply the work-profile
ID when the command runs inside an initialized launcher session.

AI instructions are resolved independently from the project through the work profile's `agent_instructions_path`.
`--agent-instructions /absolute/file` is an explicit one-run override; the command never assumes that every project has
its own `AGENTS.md`.

By default, the Hermes profile name is `<work-profile>-<workflow>-<project>`. Use `--instance SLUG` to create multiple
bots for the same scope, or `--profile NAME` only when an intentional custom name is necessary.

Deletion is intentionally single-profile and destructive. It requires the literal `--confirm-delete` flag, rejects the
Hermes `default` profile, and verifies that the selected profile disappeared. Use `list` immediately before deletion when
the exact profile ID is uncertain.

## Defaults

- Hermes profile name: `<work-profile>-<workflow>-<project>`
- Work profile: selected with `--work-profile` or `WORK_PROFILE_ID`
- Workflow: the work profile's `default_workflow`, unless `--workflow` selects another
- Project: the workflow's sole project, unless `--project` selects one
- Provider, endpoint, model, and workspace: resolved from the workflow's `local_ai` and project references
- AI instructions: resolved separately from the work profile's `agent_instructions_path`

The setup script supports environment overrides; inspect its help before changing these defaults.

## Use cases

### Create bots for two workflows in the same work profile

Use this when Hermes is installed and two workflow/project scopes from one work profile need separate bots.

1. Inspect the existing profiles so the new profile ID does not collide:

   ```bash
   ai-commands/hermes/hermes.command.sh list
   ```

2. Create the Dev bot. The work profile supplies its default workflow, sole project, provider, endpoint, and model:

   ```bash
   ai-commands/hermes/hermes.command.sh setup \
     --work-profile sc
   ```

   This creates `sc-dev-sc-services`. The fully explicit equivalent is useful in automation or when a profile exposes
   multiple choices:

   ```bash
   ai-commands/hermes/hermes.command.sh setup \
     --work-profile sc \
     --workflow dev \
     --project sc-services
   ```

   The command resolves the workspace, endpoint, and provider model from `ai-profile/sc`, validates `/models` before
   mutation, creates `~/.hermes/profiles/sc-dev-sc-services`, creates the
   `~/.local/bin/sc-dev-sc-services` alias, configures the provider and local terminal, and writes the scoped SOUL file.

3. Create the Accounting bot from the same `sc` profile but a different workflow/project scope:

   ```bash
   ai-commands/hermes/hermes.command.sh setup \
     --work-profile sc \
     --workflow accounting \
     --project incorparated
   ```

   This creates `sc-accounting-incorparated` with its terminal rooted at the Accounting project's configured
   `repo_path`.

4. Verify both profiles and their live model routes:

   ```bash
   ai-commands/hermes/hermes.command.sh show sc-dev-sc-services
   ai-commands/hermes/hermes.command.sh status sc-dev-sc-services
   ai-commands/hermes/hermes.command.sh show sc-accounting-incorparated
   ai-commands/hermes/hermes.command.sh status sc-accounting-incorparated
   ```

   Success requires `status` to report `HERMES_READY` with the expected provider, model, endpoint, and workspace.

5. Open Hermes Desktop. Each bot is visibly named for its profile, workflow, and project scope. Both bots receive the
   profile-level AI instructions path independently of their different project folders.

The `setup` action is safe to rerun for the same profile: it reconciles configuration while preserving existing profile
conversations and memory. To remove the additional bot later, first inspect its exact ID and then run:

```bash
ai-commands/hermes/hermes.command.sh delete sc-dev-sc-services --confirm-delete
```

Before deleting a bot that is active in Hermes Desktop, close Hermes Desktop or switch away from that bot. Desktop may
otherwise restart its backend and recreate the profile directory while deletion is being verified. A clean replacement
sequence is: close Desktop, delete each exact profile, verify with `list`, run the profile-aware `setup` commands again,
verify each with `status`, and reopen Desktop.

## Contract

The normative behavior, failure states, and safety boundaries are defined in [spec.md](spec.md).
