# SYS-TRB-008：Codex 官方账号容量与断流

| 字段 | 当前记录 |
| --- | --- |
| 故障编号 | `TRB-008` |
| 解决状态 | **未解决：官方初步回复，待补充环境信息** |
| 工具状态 | 只读诊断；已通过 Help Center 提交，等待支持跟进 |
| 最后核验 | 2026-09-17 |
| 证据边界 | Windows、Codex CLI 0.154.0、官方 ChatGPT 登录路径和受影响账号的本地复现；不证明 OpenAI 内部具体组件或其他账号、地区、版本的行为 |

> 安全第一步：保留原 `.codex`、历史对话和 CC Switch / 官方账号共用配置；临时使用已验证稳定的第三方 API。不要发送 API Key、access token、完整 `auth.json` 或其他认证秘密。

## 一句话现象

切换回官方 ChatGPT 账号后，Codex Desktop 与 CLI 出现 `Selected model is at capacity`、反复重连和流断开；在全新 `CODEX_HOME`、全新 device login、Codex CLI 0.154.0、`provider=openai`、全新 session 下仍可复现。

## 当前是否解决

当前没有已验证的解决方案。已有本地诊断和临时绕行，但账号级路由、模型准入、容量分配、限流状态或其他服务端原因仍待 OpenAI 官方确认。

## 适用环境与错误签名

- 操作系统：Windows
- 产品与版本：Codex Desktop（版本差异待官方环境核对）；Codex CLI 0.154.0
- 登录、网络或部署方式：ChatGPT device login；官方 `openai` provider
- 可检索的错误码或原样短语：`Selected model is at capacity`；stream disconnect；早期原环境曾间歇出现 `401 Unauthorized`
- 首次记录 / 最后复现：2026-09-17 / 2026-09-17

## 已确认事实、合理推断与待确认项

### 已确认事实

- 全新 `CODEX_HOME` 加全新 ChatGPT device login 后，CLI 显示 `provider: openai`。
- CLI 0.154.0 的全新 session 测试 GPT-5.6 Sol 仍返回 capacity。
- GPT-5.6 Luna、GPT-5.5 也出现 capacity；GPT-5.6 Terra 出现重连、WebSocket 回退 HTTPS 和流断开。
- `codex doctor --json` 的本地记录显示 ChatGPT 认证凭据可用、配置可加载、推理端点可达，WebSocket 握手曾成功返回 HTTP 101。
- 旧 CLI 0.147.0 与新版 models cache 的 schema 不兼容问题已通过升级到 0.154.0 修复，但 capacity 仍存在。
- 第三方 API 路径此前可用；这与官方 ChatGPT 路径异常不矛盾。

### 合理推断

现有证据强烈指向受影响账号进入官方 Codex 后端后的账号级路由、模型准入、容量分配、限流状态或其他服务端状态异常。该推断不能确定具体内部组件，也不能绝对排除间歇性网络或其他并行故障。

### 待确认项

- OpenAI 是否能在服务端按 request ID 定位账号路由、准入、容量和限流记录。
- 是否存在账号级 incident、feature flag、区域性容量问题或已知服务异常。
- 官方宣称处理完成后的 Desktop、CLI 和多模型回归结果。
- CLI `/status` 显示的工作区（个人或 Team）以及同账号 Codex Web 是否可用。

## 排查过程

1. 发现 Desktop 与 CLI 均有 capacity / stream disconnect；保留原现场。
2. 将 CLI 从 0.147.0 升级至 0.154.0，修复 models cache schema 兼容警告；capacity 仍在。
3. 使用多个模型和全新 session 复测，确认不是单一模型或旧对话现象。
4. 使用全新 `CODEX_HOME` 和全新 device login，以 `provider=openai` 复现 Sol capacity。
5. 使用 `codex doctor --json` 做本地认证、配置、端点和 WebSocket 可达性核对；不把 thread/rollout parity warning 当作本事件根因。

## 解决或规避步骤

当前只建议：

1. 保留原 `.codex`、历史对话及 CC Switch / 官方账号共用配置，不做清理。
2. 研发工作受影响时，临时使用已经验证稳定的第三方 API。
3. 使用受影响的官方 ChatGPT 账号登录 [OpenAI Help Center](https://help.openai.com/) 右下角支持聊天，提交私有草稿区中的英文反馈正文，并要求人工检查账号级 Codex routing、model admission、capacity allocation、rate-limit state 和 server-side 状态。

### 官方初步回复（2026-09-17）

支持助手未发现当前系统级事故；其观察是该账号 Codex usage/rate-limit 状态看起来可用（未完全阻断），现象更像工作区/模型访问上下文或 WebSocket/网络干扰。官方要求补充：CLI `/status`（脱敏）、当前工作区类型，以及同账号 Codex Web 是否可用。该回复未提供 case/ticket 编号，也未确认服务端根因；人工升级尚未确认。

## 验证与回滚

- 验证命令或操作：官方处理完成后，按外部反馈记录的标准验证 Desktop、CLI、GPT-5.6 Sol、GPT-5.6 Luna、GPT-5.6 Terra、GPT-5.5；每个模型连续 3 次成功。
- 通过标准：不再出现 capacity、异常 401 或频繁重连；Desktop 与 CLI 均可用；账号切换不破坏对话/认证状态。
- 未验证项：官方 case/ticket、官方服务端结论、处理完成后的回归测试。
- 回滚入口与适用条件：不涉及本地数据迁移或删除；在官方确认前保持现状并使用第三方 API 绕行。

## 证据登记

| 编号 | 来源类型 | 日期 | 支持的结论 | 公开状态 | 指针或脱敏哈希 |
| --- | --- | --- | --- | --- | --- |
| `E01` | 本地诊断摘要 | 2026-09-17 | clean environment + official provider 仍复现 capacity | 可公开 | 原文留存于本地私有草稿区 |
| `E02` | 用户提供的事件记录 | 2026-09-17 | 排查顺序、已排除方向和证据边界 | 本地私有 | `90-本地草稿/TRB-008-官方账号容量和断流/事件经过.md` |
| `E03` | 用户提供的外部反馈正文 | 2026-09-17 | 官方支持提交正文、敏感信息边界和回归标准 | 本地私有 | `90-本地草稿/TRB-008-官方账号容量和断流/发给官方的话.md` |
| `E04` | OpenAI Help Center 支持聊天回复 | 2026-09-17 | 未发现当前全局事故；要求补充工作区、`/status` 和 Codex Web 对照 | 本地私有 | 当前 Help Center 支持聊天；无 case/ticket |

## 配套工具

无。本记录不自动执行清理、重登录、账号切换或远端操作。

## 失效与重验条件

Codex、Desktop、认证方式、provider、模型目录、账号、网络路径或官方回复发生变化时，重新核验本记录。官方宣称修复后必须执行完整回归，不以单次成功消息替代验收。

## 修订记录

| 日期 | 变更 | 依据 |
| --- | --- | --- |
| 2026-09-17 | 首次建立脱敏公开记录；原始附件归档至本地私有草稿区 | 用户提供的两份附件 |
