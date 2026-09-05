# Local AI Worker Is Alive

**August 26, 2026**

Today I finished setting up and testing a local AI worker on an ASUS Ascent GX10.

Part of the motivation is simple economics. I am already spending around **$200/month** on Codex, and with the amount I use it, that workload feels like it could easily cost closer to **$1,000/month** under a different pricing model. For now Codex is kind enough to make my usage fit into that $200 budget — but we all know how quickly the economics of AI can change.

So I figured that having a **local minion box sitting on the shelf** would be a useful addition to my agent companion team. It does not need to replace the strong hosted models. The idea is to keep a strong reasoning model at the top and let it delegate suitable work to local agents when it makes sense — especially repetitive, long-running, or token-hungry work.

I tested two Qwen models through Hermes, measured speed, memory, and agent/tool performance, and picked **Qwen3-Coder-Next** as the current everyday local worker. It is fast enough to be practical while still giving me a fairly large model that can take work away from the expensive hosted models.

[See the GX10 benchmark](../benchmarks/local-models/README.md)

---

*Upon the shelf a quiet servant wakes,*
*While distant minds attend the harder call;*
*It spends no coin for every task it takes,*
*And leaves the greater thought to govern all.*

**P.S. — Stoic quote of the day**

> “Waste no more time arguing what a good man should be. Be one.”
>
> — Marcus Aurelius, *Meditations*
