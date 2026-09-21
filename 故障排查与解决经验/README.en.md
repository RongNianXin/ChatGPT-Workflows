# Troubleshooting knowledge base

[简体中文](README.md) | **English**

<!-- README-SOURCE-SHA256: 7a523558fbea9f368e7e3f7ba0a9ab9e601362259c7628115a516850fa96fb23 -->
This directory contains sanitized Codex and companion-tool incident records with explicit evidence boundaries. Start with the symptom table. You do not need to understand the directory layout or read every investigation.

## Find a case by symptom

| ID | Symptom | Current status | Entry |
| --- | --- | --- | --- |
| `TRB-001` | Archiving on Windows reports `thread-store` / `os error 2`, although the session file exists | **Resolved: local repair verified** | [Archive-path failure](<01-对话与归档/TRB-001-归档时提示路径不存在/TRB-001-归档时提示路径不存在.md>) |
| `TRB-002` | The original task shows `thread not found`, while its record may still exist | **Partially resolved: one recovery case verified** | [`thread not found` recovery](<01-对话与归档/TRB-002-对话提示找不到/TRB-002-对话提示找不到-恢复方法.md>) |
| `TRB-003` | Tasks disappear from the list after an account or route switch, although files remain | **Partially resolved: historical workaround verified** | [Split history lists](<02-账号、登录与模型配置/TRB-003-换账号后看不到原对话/TRB-003-换账号后看不到原对话-历史列表分裂.md>) |
| `TRB-004` | A task remains visible but cannot continue after an account or provider switch and reports ciphertext validation errors | **Partially resolved: no general fix** | [Old task cannot continue](<02-账号、登录与模型配置/TRB-004-换账号后旧对话无法继续/TRB-004-换账号后旧对话无法继续-恢复方法.md>) |
| `TRB-005` | Migration is followed by `invalid paginated history lineage` or an out-of-range cutoff | **Unresolved: real operations suspended** | [Paginated-lineage damage](<02-账号、登录与模型配置/TRB-005-迁移后历史记录损坏/TRB-005-迁移后历史记录损坏-处理暂停.md>) |
| `TRB-006` | Messages between AI tasks receive no reply, repeat an old answer, end in an empty turn, or receive no acknowledgment | **Unresolved: log-based diagnosis and prevention procedures available; automatic interception not implemented** | [AI task messages receive no reply: diagnosis and prevention](<03-AI任务之间通信/TRB-006-任务间消息没有回复-排查与预防.md>) |
| `TRB-007` | A long task reports an explicit conversation-too-long 400, 401, unsupported-model 404, 429, either of two 502 signatures, 503, 504, or a dropped stream | **Partially resolved: triage and recovery available; failures still observed after the reported fix** | [Long tasks and HTTP errors index](<04-网络与服务错误/TRB-007-长任务断流和网络错误/TRB-007-长任务和网络错误-总说明.md>) |
| `TRB-008` | The official ChatGPT account still shows Codex capacity, reconnects, and stream disconnects in a clean environment | **Unresolved: initial support reply; workspace and `/status` details pending** | [Official-account capacity and stream disconnect](<02-账号、登录与模型配置/TRB-008-官方账号容量和断流/SYS-TRB-008-官方账号容量和断流.en.md>) |
| `TRB-009` | A task flashes `Model provider 'OpenAI' not found` and cannot load `config.toml` | **Resolved: provider alias added and loading verified for this case** | [Missing model provider in project configuration](<02-账号、登录与模型配置/TRB-009-项目配置找不到模型提供商/SYS-TRB-009-项目配置找不到模型提供商.en.md>) |
| `TRB-010` | A multi-part request receives only a kickoff note or promised next action, then ends with a non-empty answer before the task is complete | **Unresolved: behavioral guard added; live regression and host-level interception are unavailable** | [Task ended before closure](<05-任务执行与结果交付/TRB-010-任务没完成就提前结束/SYS-TRB-010-任务没完成就提前结束.md>) |

“Resolved” applies only to the platform, version, and evidence scope stated in the case. “Partially resolved” means that a verified recovery or workaround exists while the root cause, durable fix, or other environments remain open. “Unresolved” means that no verified solution is currently available; the record provides investigation progress, evidence, and stop conditions.

## Do these three things first

1. Preserve the complete error text, occurrence time, product version, and failure stage. Sanitize before sharing.
2. Separate visibility, continuation, request, and local-data failures. Do not apply a fix based only on a similar-looking symptom.
3. Before changing sessions, databases, accounts, remote state, or resending actions, preserve the evidence and check for existing side effects.

## Direct links by HTTP code

| Code | Dedicated handling note |
| --- | --- |
| `400` conversation too long | [HTTP-400-TRB-007-conversation-too-long](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-400-TRB-007-对话过长.md>) |
| `400` tool-call pairing | [HTTP-400-TRB-007-tool-call-pairing](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-400-TRB-007-工具调用前后不匹配.md>) |
| `401` | [HTTP-401-TRB-007-credentials-or-authorization](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-401-TRB-007-登录或授权被拒绝.md>) |
| `404` | [HTTP-404-TRB-007-model-not-supported](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-404-TRB-007-模型不支持.md>) |
| `429` | [HTTP-429-TRB-007-model-route-rate-limit](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-429-TRB-007-模型请求被限流.md>) |
| `502` | [HTTP-502-TRB-007-upstream-gateway](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-502-TRB-007-上游网关错误.md>) |
| `503` | [HTTP-503-TRB-007-service-unavailable](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-503-TRB-007-服务暂不可用.md>) |
| `504` | [HTTP-504-TRB-007-gateway-timeout](<04-网络与服务错误/TRB-007-长任务断流和网络错误/HTTP-504-TRB-007-网关超时与断流.md>) |

## Directory rules

- Top-level directories classify the failure layer. Every public case has a stable `TRB-xxx` ID and its own folder. `TRB` means Troubleshooting Record; it is only a unique index and does not indicate severity.
- Main record files use a type-first prefix: HTTP cases use `HTTP-<three-digit status>-TRB-<three-digit case ID>-topic.md`; other system/protocol signatures use `ERR-...` or `SYS-...`. Sort multiple codes numerically and omit unconfirmed codes.
- Keep the main record, investigation, evidence register, and companion tool with the case. Resolution status and tool status are independent.
- Keep license and implementation-difference notes beside the relevant tool.
- Evidence-free material stays in the Git-ignored `90-本地草稿/` area until it meets the record template's minimum evidence requirements.
- Paths may change, but case IDs are never reused. When cases merge, preserve old-ID mappings and migration notes.

This directory was first reorganized under these rules on 2026-09-08. Paths based on temporary problem names are no longer entry points. Their earlier contents remain traceable through Git history; public references should use the stable `TRB-xxx` IDs.

Use the [Chinese record template](故障记录模板.md) or the [English template](TROUBLESHOOTING_RECORD_TEMPLATE.md) for new cases.

## Maintenance lifecycle

1. **Capture:** record a one-sentence symptom, error signature, version, time, and minimum sanitized evidence.
2. **Classify:** create or reuse a case ID and separate confirmed facts, reasonable inference, and open questions.
3. **Validate:** reproduce with copies, synthetic data, or read-only checks first; preserve failed attempts and stop conditions.
4. **Publish:** show resolution status, tool state, last-verified date, and evidence boundary at the top.
5. **Maintain:** revalidate after product, data-format, configuration, or evidence changes. Mark obsolete cases as retired while preserving useful history.

## Tool status

- [`TRB-001` archive repair tool](<01-对话与归档/TRB-001-归档时提示路径不存在/TRB-001-归档时提示路径不存在.md#四最简单的使用方式双击-exe>): a Windows local tool that repairs one path field and does not archive tasks. The checked-in executable is unsigned; read its boundary before use.
- [`TRB-005` migration research material](<02-账号、登录与模型配置/TRB-005-迁移后历史记录损坏/旧版迁移工具研究-真实数据操作已暂停/README.en.md>): installation and rollback against real data are suspended. Only synthetic tests and source review are allowed.

## Publication and safety boundaries

- These records are not official fixes from OpenAI or third-party projects. Revalidate when versions, private data structures, or provider behavior change.
- Do not publish raw JSONL, databases, full prompts, real task IDs, accounts, credentials, internal route names, absolute paths, or generated scan reports.
- Public error samples use `<PROVIDER_NAME>`, `<MODEL_NAME>`, `<THREAD_ID>`, `<PORT>`, and `<USER_HOME>`.
- When citing third-party projects, state the source, license, implementation differences, and last-verified date. Do not imply an official partnership.

## Public references

- [CC Switch: Unified Codex session history](https://github.com/farion1231/cc-switch/blob/main/docs/guides/codex-unified-session-history-guide-en.md)
- [CC Switch releases](https://github.com/farion1231/cc-switch/releases)
- [OpenAI Codex documentation](https://developers.openai.com/codex)

Dates and versions in historical cases describe the environment at that time. Use the status and “last verified” fields at the top of each case to judge applicability.
