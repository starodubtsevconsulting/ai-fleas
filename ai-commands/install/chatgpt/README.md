# ChatGPT installation command

Canonical command ID: `chatgpt`. Human aliases include `GPT`, `GPT App`, `Codex App`, and `ChatGPT App`.

This target manages the physical desktop application, not Codex tasks or the separately installable Codex CLI. Its shell
adapter can inspect a local macOS installation. Installation, update, upgrade, and uninstall fail closed until the host
exposes a reviewed trusted operation; first-time installation points to the official ChatGPT download page.

Local support is `Darwin/arm64` only. The smoke test validates the application bundle, executable, and code signature
without launching a user session.
