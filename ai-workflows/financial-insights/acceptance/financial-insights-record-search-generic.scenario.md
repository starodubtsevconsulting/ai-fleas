# Parameterized private record-search scenario

This scenario makes the Financial Insights read-only record lookup reusable
without placing a real reports root, source document, organization, or answer
key in the public repository. Its model input is
[financial-insights-record-search-generic.prompt.md](financial-insights-record-search-generic.prompt.md).

A private run profile must conform to
[financial-insights-record-search-generic.run-profile.schema.json](financial-insights-record-search-generic.run-profile.schema.json).
It declares the authorized reports root, selected period and business folders,
the requested question, a private evidence destination, and one or more
execution profiles. An execution profile selects an adapter, provider, model,
and context setting; therefore this document never depends on a particular
harness name.

For a comparison, every selected execution profile must carry the same
`comparison_model_fingerprint`. Timing starts at prompt dispatch and stops at
the final response. The evaluator is run-specific and private: it compares
responses with independently inspected source facts, records citations and
decisions, and never becomes model input.

The scenario remains read-only. It may search and inspect documents under its
authorized root, but may not alter financial records or publish source-derived
information. The runner stores raw prompts, responses, parsed evaluation, and
timing only in the private evidence destination from the run profile.
