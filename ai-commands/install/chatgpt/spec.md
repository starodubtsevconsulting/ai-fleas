# chatgpt Spec

- Manage only the physical GPT/ChatGPT desktop application.
- Require `Darwin/arm64` for every local lifecycle action.
- `status`, `smoke-test`, `check-update`, and `update` are read-only.
- `install`, `upgrade`, and `uninstall` require explicit authorization and a reviewed host operation.
- Successful install or upgrade requires exact version evidence and a passing smoke test.
- Never substitute the Codex CLI installer or mutate agent/task/project/group state.
