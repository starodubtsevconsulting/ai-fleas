# comment.command

## Roles

- `dev`

Use when you need a reusable "story" comment template for test scripts or notes.
This is a doc-adjacent command focused on in-code/script comments rather than new markdown docs.
For full documentation flow, see `commands/doc/doc.command.md`.

Additional guidance (from smoke-tests):

- Do not use deprecated project `smoke-tests/hurl-api-caller.sh` (in project's folder we run test againts). Use the
ai-config fallback instead:
  - `HURL_CALLER=<ai-config-root>/commands/smoke-tests/smoke-tests.command-hurl-api-caller.sh`
- When adding test scripts, include a short “story” header comment so anyone can understand intent quickly. Template:
  - `# Story: This script simulates <who/role> requesting <what>, overrides <which data>, and expects <result> across <entry points>.`
  - `# Example override: qaExpOverrides=expA=AA,expB=BB`
  - `# Expected shape (v1/v2): <compact JSON sketch or key fields>`
  - `# Data source: <S3 URL / fixture file / dataset reference>`
  - Story means: a sequential, plain-English narrative that explains why the test exists, what is being
changed/overridden, and what “success” looks like, without implementation details.

## Usage

- `./commands/comment/comment.command.sh`
- `./commands/comment/comment.command.sh --file <path>` (append template to a file)

## Notes

- The template is a short, sequential, plain-English narrative.
- Always include a data source reference when possible (S3 URL, fixture file, dataset).

## Inputs

- Optional `--file <path>` to append to.

## Output

- Prints the template to stdout, and appends to the file when requested.
