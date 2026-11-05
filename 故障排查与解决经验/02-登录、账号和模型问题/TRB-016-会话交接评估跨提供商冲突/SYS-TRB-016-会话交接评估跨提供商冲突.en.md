# Cross-provider segment conflict in session handoff assessment

| Field | Current record |
| --- | --- |
| Record | `TRB-016` |
| Status | **Resolved: the local tool was verified; conflicting task identity, source or project binding still blocks safely** |
| Last checked | 2026-11-01 |
| Evidence boundary | One read-only before/after comparison used local session records. No session content was uploaded and no Codex source session file was edited. |

## Symptom

The session handoff assessment failed when a long-running task contained different `model_provider` values in its segments. The history did span providers or routes. This does not by itself prove damaged session files or a network outage.

## Cause and fix

The old logic treated a provider change as a fatal metadata conflict. That avoided mixing token trends across providers, but also rejected one task whose route had changed over time.

The tool now separates the cases:

1. Conflicting task identity, source or project binding still blocks, so unrelated records are never joined silently.
2. A provider-only change continues segment-by-segment reading and starts a new token-trend baseline at the boundary.
3. The report warns about the provider change. A declared provider does not prove the actual upstream gateway.

The same query failed before the change and exited with code 0 afterwards, producing a report with segments, compaction count, capacity observation and the provider warning. Trends are not continued across providers, so no continuous gain is fabricated.

## Safe use

- Confirm the task ID from the current local task index; do not infer it from a title or similar name.
- Read a provider-change warning as a segmentation boundary, not as a continuous same-model trend.
- If identity, source or project binding conflicts instead, stop aggregation and preserve the evidence. Do not edit JSONL or a database to bypass the check.
- The tool remains a Windows development preview; other systems and very large logs need separate validation.

## Related entry points

- [Session handoff assessment guide](../../../实用小工具/Codex会话交接评估/README.en.md)
- [Codex troubleshooting](https://learn.chatgpt.com/docs/reference/troubleshooting)

This record covers a local read-only tool fix. It is not a claim that Codex Desktop or provider switching has been fixed upstream.
