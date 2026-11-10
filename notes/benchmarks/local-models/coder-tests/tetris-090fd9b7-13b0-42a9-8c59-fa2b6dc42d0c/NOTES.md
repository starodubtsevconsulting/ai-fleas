# Experiment notes

- Task: create a single-file browser Tetris game.
- Settings: 32,768 context tokens, 8,192 maximum output tokens, thinking off.
- Pi execution limit: 180 seconds.
- Outcome: the run timed out while streaming its first tool call. No Tetris index.html was produced.
- Diagnostic artifacts were published successfully; this is not a coding pass.
- Follow-up: repeat with the server deadline raised to 600 seconds.
