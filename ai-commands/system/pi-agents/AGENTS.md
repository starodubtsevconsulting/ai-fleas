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

## PDF runtime capability preflight

* **What happened:** PDF extraction discovery found no `pdftotext` on the launched process's `PATH`, although a bundled runtime provided the executable. Earlier scenario execution also exited zero with a one-token `length` stop and no report.
* **Root cause:** Provider connectivity and command preparation do not verify the launched process's extraction tools or complete transcript budget. Installed Pi `read` attaches supported image files but does not render PDFs; a bash stdout result is not an image attachment.
* **How we fixed it:** Resolve and verify the concrete extractor path before inference and supply it privately in launch context. Select fresh stdout/in-memory extraction when a scenario prohibits files and no compatible in-memory visual attachment adapter exists. This records a capability gap; it does not establish a quarterly vision pass.
* **How to avoid:** Preflight executable availability and exact PDF/image tool behavior outside the model conversation. Inspect one PDF/page at a time with bounded outputs; keep machine-specific paths and runtime evidence private. Authorized launcher configuration/evidence writes do not relax read-only source or no-derived-file constraints.
* **Verification:** Check the exact executable in the launch environment, inspect the installed Pi tool implementation, and require a cited report with reproducible arithmetic and explicit coverage. Inspect output-token usage and stop reasons; exit zero, a tool call, or a previous single-page vision pass does not prove quarter completion.

## Pi thinking request versus server control

* **What happened:** Inspection of the installed Pi runtime reporting version 1.1.0 found that a custom model definition without `reasoning` defaults to false, but `--thinking off` does not emit `chat_template_kwargs`.
* **Root cause:** Pi's requested thinking level and an OpenAI-compatible server's chat-template control are separate bindings. The CLI option alone does not prove that the server received `enable_thinking: false`.
* **How we fixed it:** Identified the supported opt-in `before_provider_request` extension hook for adding that field to each request payload. The subsequent bounded-text runs verified outbound `enable_thinking: false` and produced final reports with normal stops. Financial acceptance still failed; this does not prove the server's internal thinking setting.
* **How to avoid:** Report requested Pi thinking level, observed outbound payload and observed server behavior separately. Use an explicitly selected, verified per-run extension when needed; do not invent permanent configuration or server flags. Obtain the actual runtime version from Pi, not the installation directory name.
* **Verification:** Inspect the emitted request for `chat_template_kwargs.enable_thinking: false`, then inspect the resulting response and measured token usage. Preserve isolation controls and record unknown observations as unknown until the run completes.
