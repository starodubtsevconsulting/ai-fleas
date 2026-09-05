# worklog.command

## Tags

#command #ai-command #worklog

Create backlog stories for future work sessions.

Use this when the user says: "backlog", "put it to the future", "save for later", or asks to track future work.
The command immediately creates a story file so it does not get lost.

Stories are stored in:

- `session-root/<work-profile>/backlog/<slug>-story.md`
- that backlog path is meant to be committed so stories can sync through git/GitHub while the rest of `<session-root>` stays local

## Usage

```bash
./commands/worklog/worklog.command.sh \
  --title "New SQS contract" \
  --role "dev" \
  --want "emit one event per locale" \
  --so-that "localization-service processes per-locale entries" \
  --project "libs/nest-shared"
```

Explicit profile override:

```bash
./commands/worklog/worklog.command.sh \
  --title "Refactor worklog" \
  --profile "sc"
```

## Inputs

- `--title` (required)
- `--role` (optional, default placeholder)
- `--want` (optional, default placeholder)
- `--so-that` (optional, default placeholder)
- `--project` (optional, project path/id stored in the story; defaults to `AI_FLOW_PROJECT_DIR` or `ai`)
- `--profile` (optional, defaults to `WORK_PROFILE_ID` or `work`)
- `--slug` (optional, overrides filename slug)

## Output

- `session-root/<work-profile>/backlog/<slug>-story.md`

## Story Template

```
# <Title>

- Status: todo
- Created: <UTC timestamp>
- Profile: <work-profile>
- Workflow: <workflow>
- Project: <project-path-or-id>
- Project Name: <folder-name-from-project>
- Source: worklog

## Story
As a <role> I want <goal> so that <benefit>.

## Plan
- [ ] #design
- [ ] #coding
- [ ] #test
- [ ] #docs

## Impl Details
-

## Notes
-

## Acceptance Criteria
-
```
