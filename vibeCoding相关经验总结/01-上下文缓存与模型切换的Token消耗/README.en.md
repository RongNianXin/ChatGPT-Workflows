# Context caching, model switching and token cost

[简体中文](README.md)

## Current conclusion

A stable request prefix may reuse a server-side cache. Appending messages, switching models or opening another chat does not guarantee a hit. Cache scope, retention, usage fields and prices depend on the provider, model, endpoint and configuration; different services must not be treated as identical.

This project has no direct-model comparison using the same input, task and acceptance criteria. Script runtime, cache-hit ratio and model price alone cannot establish that the whole workflow is faster, uses fewer tokens or costs less.

## Local files and request prefixes

Editing a local file does not itself change the request sent to a model. Its contents must actually be read and included in an input before they can affect that request's prefix.

- Appended content may preserve a longer common prefix; actual usage still determines whether it hit.
- Editing an earlier message may change the common prefix, without proving that every request is billed entirely as uncached input.
- Do not assume caches are shared between models or providers, or that switching necessarily bills the whole input as uncached.
- A new chat also incurs summarization, handoff and necessary rereading costs.

## Measuring total cost

1. Hold the task, input, completion criteria and resource limits constant when comparing direct execution with script assistance.
2. Include the main agent, subagents, rework, tool output, rereading, communication and human transfer.
3. Verify the service's usage definitions before adding input, output, cache and reasoning fields; some fields may overlap.
4. Compare tokens, money, time and quality separately. Subscription quota and per-request charges use different measures.
5. Check actual usage and billing for failed or retried requests; a `402` status alone does not prove another charge.
6. Missing fields, denominators, billing or controls remain unknown; do not invent a saving percentage.

## Historical samples and limits

An earlier draft reported model switching in 8 of 21 chats, higher reasoning settings in about 84% of requests and an input cache-hit ratio of about 95%. This review did not reread the raw logs or obtain complete denominators, missing-day data and per-request bills. These figures are leads for verification, not current cost attribution.

The draft's prices, peak-time multipliers, model comparisons, full-history forwarding claims and default reasoning/subagent settings were not verified here. They are no longer current recommendations. The original is preserved in the project's local audit record, rather than presented as a current price table or product specification.

## Practical trade-offs

Reuse existing deterministic evidence where a parser or script can establish a fact. Models still assess requirements, authority, safety and trade-offs. Cache optimization must not remove necessary acceptance checks.

Choose model consistency, separate chats and subagents based on task difficulty, independent-review needs and measured total cost. No arrangement is assumed cheaper before a comparable trial.

Stop repeated requests when credit is insufficient and check actual usage and billing. Paid probes, configuration changes and fallback providers require their own scoped authorization.

## Verification entry points

These are official entry points for checking mechanisms and current prices. They were not reread in this review, so links do not count as verified claims:

- DeepSeek caching: <https://api-docs.deepseek.com/zh-cn/guides/kv_cache/>
- DeepSeek pricing: <https://api-docs.deepseek.com/zh-cn/quick_start/pricing/>
- OpenAI caching: <https://platform.openai.com/docs/guides/prompt-caching>

Still missing: a matched task comparison, complete usage definitions, actual bills and evidence for current-version behavior. No new billable requests or background sampling were run.

<!-- README-SOURCE-SHA256: a44c377d1a8c086f4bfa8b2fe84c8fe25c592b99236619767845fa62346baa9d -->
