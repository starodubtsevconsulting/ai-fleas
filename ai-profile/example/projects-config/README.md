# Example project inventory

The example contains placeholder projects only. Replace or remove every TODO
item when copying this profile:

- Replace repository and storage paths.
- Replace expected remotes.
- Keep only projects explicitly authorized for the selected workflow.
- Keep supplemental knowledge secret-free and subordinate to repository-local
  instructions.
- For the writing workflow, make the first project the control repository and
  replace `example-articles` with the exact existing article folder. The
  local folder is the source of truth whether or not external software syncs it.
  On another device, map the same logical article store to that device's own
  verified local path; do not copy a desktop path into mobile configuration.
  Set `article_store.project_ref`, the Obsidian editor's `vault_project_ref`,
  and each destination's `archive_project_ref` to that same registered project.
  Verify the Obsidian vault name opens that exact path; its label is not the path.
- Keep the example Medium destination in `draft-only` mode unless the human
  explicitly chooses a different destination policy. Replace the placeholder
  `account_profile_url` with the verified signed-in Medium account profile.
