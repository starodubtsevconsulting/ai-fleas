Thanks for asking me to register new projects. Tell me:

1. The work profile(s) that should be allowed to use the project.
2. The local project path (absolute or relative to the repository root).
3. Optional repo URL, documentation path, and any project-specific notes/rules.

I’ll create or update a committed `rules/commands/projects/registry/<project>/project.yml` metadata file, keep any
colocated runner scripts in that same project folder, and then wire the relevant work-profile `projects:` refs to it.
