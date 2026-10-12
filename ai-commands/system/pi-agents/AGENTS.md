# Pi Agents Knowledge

## Provider context and standalone scenarios

* **What happened:** A fresh local inference request was rejected after the endpoint had switched to a general-purpose model with an 8192-token active context, while the configured coding route still named the previous model and a 131072-token context. The generic "session too long" response did not indicate stale conversation history.
* **Root cause:** The configured provider alias and context described an earlier runtime. A model's training context does not establish the context currently exposed by the serving endpoint.
* **How we fixed it:** The Pi scenario binding now uses the provider model and active context reported by the endpoint. Standalone scenarios omit role instructions and run Pi with `--no-context-files`, `--no-skills`, `--no-prompt-templates`, and `--no-approve`, plus an explicit instruction to perform only the supplied scenario.
* **How to avoid:** Before inference, compare the provider's `/v1/models` model identifier and runtime context with the configured alias and token limits. Treat generic length errors from a fresh request as possible runtime-configuration mismatches before investigating session history.
* **Verification:** Run `node --test ai-commands/system/pi-agents/scenario-launch.test.mjs`, then perform a Pi connectivity smoke check against the selected binding. The smoke check verifies connectivity and isolation only; it does not establish that a financial task succeeded.

## Pi output budget and large tool results

* **What happened:** A standalone scenario exited successfully with no report, one output token and a `length` stop. After reducing the initial prompt, discovery ran, but a 13917-character tool result caused the next response to stop at one token before document processing.
* **Root cause:** The inspected Pi version subtracts a fixed 4096-token safety reserve from the configured context and estimated transcript before choosing the output limit. With an actual 8192-token context, system instructions, tool schemas, scenario text and accumulated tool results can leave only the minimum one output token despite a configured 2048-token maximum.
* **How we fixed it:** A concise scenario-only system prompt, the `read,bash` tool allowlist and shorter scenario text restored the initial request's 2048-token output allowance. This fixes initial prompt saturation only; the subsequent discovery-output saturation remains a blocker.
* **How to avoid:** Budget the complete transcript, including tool schemas and results, against the serving endpoint's actual context. Keep discovery results bounded and process small batches rather than returning large inventories. Do not inflate configured context to bypass Pi's reserve. Exit status zero and tool execution alone do not establish scenario completion.
* **Verification:** Inspect the installed Pi estimator and clamp implementation, then calculate the full initial input and output allowance without inference. The corrected initial request estimated 1932 input tokens and retained 2048 output tokens within an 8192-token context. Separately inspect each subsequent request and require the scenario's actual report and evidence; the observed retry remained blocked after discovery and did not pass the document benchmark.
