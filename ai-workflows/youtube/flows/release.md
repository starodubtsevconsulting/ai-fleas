# Release flow

Executed by `@release-worker`.

## Purpose

Prepare the approved scene as a complete YouTube release package and release it only when the human explicitly
authorizes that exact action.

## Flow

1. Read the approved text, audio, scene package, and channel-specific profile guidance.
2. Prepare the title, description, thumbnail or cover, and other required metadata.
3. Validate that the package is complete and uses only approved upstream artifacts.
4. Present the package to the human for release authorization.
5. Stop at a ready-to-release package when authorization is absent or the release Command is unavailable.
6. When explicitly authorized, invoke the registered release Command and record the resulting YouTube reference.

## Commands

- `youtube-release` (planned)

## Output

A ready-to-release package or, after explicit authorization and successful publication, its YouTube reference.
