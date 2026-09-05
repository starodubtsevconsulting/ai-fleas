# kdenlive Command Spec

## Purpose

Own reusable Kdenlive project scaffolding and validation independently of any particular multimedia workflow.

## Rules

- Keep Kdenlive template and MLT/XML details inside this command.
- Create only relative media references so the completed video folder remains portable.
- Add imported scaffold assets as `main_bin` entries; do not add unreferenced producers that trigger Kdenlive's Clip Problems dialog.
- Validate actual referenced media files before reporting the project ready.
- Workflows call this command and translate its result into their own UI; they do not duplicate Kdenlive parsing rules.

## Command Files

- `kdenlive.command.md`
- `kdenlive.command.sh`
- `kdenlive.command.mjs`
