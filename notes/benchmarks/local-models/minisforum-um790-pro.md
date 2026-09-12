# MINISFORUM UM790 Pro — always-on lightweight worker

This benchmark covers the MINISFORUM Venus UM790 Pro as a compact, always-available tier in the local AI worker pool.

## Hardware

- **CPU:** AMD Ryzen 9 7940HS, up to 5.2 GHz
- **GPU:** AMD Radeon 780M integrated graphics
- **Memory:** 32 GB DDR5
- **Storage:** 1 TB SSD
- **Networking:** 2.5 GbE, Wi-Fi 6E
- **I/O:** 2× USB4, 4× USB 3.2, 2× HDMI 2.1, 2× PCIe 4.0

No controlled local-model benchmark has been recorded on this machine yet.

## Intended role

The UM790 Pro is interesting primarily as a **compact always-on small worker**, not as a heavyweight model host:

- background and scheduled agents
- small repetitive AI tasks
- lightweight commands and classification
- development/support services around the larger AI workers
- tasks that benefit from a permanently available machine without consuming GX10 capacity

Its practical advantages are its small physical footprint and ability to remain dedicated to server/worker duties. The benchmark should determine whether local inference on the Radeon 780M and/or CPU is fast enough to make AI inference one of those duties.

## TODO — benchmark from the top down

Start above the known-easy small-model range and step down until the best practical configuration is found:

1. **~14B Q5**
2. **~14B Q4**
3. **8B Q8**
4. **8B Q4**

A ~30B model is not the initial target. With only 32 GB shared system memory, fitting the weights is not enough: Linux, runtime, context/KV cache and other always-on services need useful headroom.

Acceptance goal: **the strongest model that remains responsive and leaves enough memory for the UM790 Pro to continue functioning as an always-on server/worker machine.**

Run the same practical benchmark methodology used for the other local machines and, where possible, the same Hermes tool-use task.

Record:

- exact OS/runtime configuration
- exact model and quantization
- inference backend and whether CPU, Radeon 780M or mixed execution is used
- model size
- configured and native context
- total and peak system-memory usage
- GPU/shared-memory usage where measurable
- prompt-processing speed
- generation speed
- TTFT
- direct request wall time
- Hermes compatibility and tool-use result where applicable
- Hermes task wall time
- CPU/GPU utilization
- power, temperature and noise if useful for 24/7 operation

The result should determine whether the UM790 Pro belongs in the AI inference pool directly or is better used only for orchestration and conventional always-on services.
