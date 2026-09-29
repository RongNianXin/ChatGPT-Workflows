# 调度重建说明模板

模板版本：2026-09-30.1

用途：当交接快照中的自动化任务已经不存在、无法访问或无法证明与当前配置一致时，提供一份重建输入清单。交接快照可以附带完整的非秘密提示词和配置条件；本说明不是任务创建指令，也不是授权卡。

## 使用边界

- 任务仍存在且可读时，只按 `04-状态、目标变更与交接规范.md` 的“现有任务核验”执行；不使用本说明修改任务。
- 只有通过只读查询确认任务缺失、没有重复任务且当前操作者另行明确授权创建/恢复时，才可把本说明作为重建候选输入。
- 任务存在但配置指纹不一致、绑定关系含糊、目标无法抽象描述或查询结果不完整时，状态为 `BLOCKED`，不得自动创建或修改。
- 本模板和交接快照不保存任务 ID、凭据、Cookie、API Key 或其他秘密值。完整的非秘密提示词、调度条件和绑定约束可以写入交接快照；涉及秘密或无法安全转移的值，必须标记为重新提供。

## 重建说明

```text
guide_id: <AI 自动生成的逻辑说明 ID>
guide_version: <模板版本>
guide_status: TEMPLATE / READY_FOR_AUTHORIZATION / BLOCKED / EXPIRED
automation_kind: <Heartbeat / Cron / 其他平台类型>
automation_name: <任务名称；不得填写平台任务 ID>
original_prompt_non_secret: <完整原始提示词；删除或替换秘密值后保留原文>
model: <实际模型或 UNKNOWN>
reasoning_effort: <实际推理设置或 UNKNOWN>
destination_binding: <旧任务 / 新任务 / 当前项目 / 其他非敏感绑定>
source_prompt_entry: <规则目录内的相对提示词入口；只填路径，不复制正文>
prompt_source_fingerprint: <入口文件版本或 SHA-256；不可得则写 UNKNOWN>
schedule_cadence: <例如每周一次；不得填写平台任务 ID>
timezone: <IANA 时区，例如 Asia/Shanghai>
target_binding_abstract: <目标的非敏感抽象关系，例如“当前项目的周更检查”>
binding_constraints: <必须保持的范围、分支、环境或受众约束；不得写秘密或完整私有目标>
notification_policy: <通知设置或 UNKNOWN>
status_at_cutoff: <运行中 / 已暂停 / 不可访问 / 已删除 / 待确认>
last_reliable_run: <最后可靠运行时间、结果和证据指针>
goal_or_task_binding: <关联 Goal 或逻辑任务；不得填写平台任务 ID>
authorization_scope: <重建后允许的动作范围；旧授权不自动继承>
preflight_read_only_checks:
  - <确认当前规则根目录、版本和适用章节>
  - <只读查询目标任务是否存在、是否重复、是否可访问>
  - <读取任务状态、周期、时区、绑定摘要和配置指纹>
  - <核对当前项目/仓库基线与运行前置条件>
state_decision:
  existing_and_match: VERIFY_ONLY
  existing_but_drifted: STOP_AND_REVIEW
  missing_and_unambiguous: REBUILD_CANDIDATE_ONLY
  missing_but_ambiguous: BLOCKED
creation_or_recovery_authorization: <必须由操作者针对本次对象、动作和有效期另行明确授权>
pause_conditions:
  - <出现重复任务、指纹漂移、目标含糊、权限不足或前置检查失败>
  - <任何凭据、远端目标或平台写入范围无法确认>
verification_commands:
  - <只读命令或平台检查命令；不得把执行成功写成已验证>
  - <创建/恢复后重新读取任务状态、周期、时区、绑定摘要和指纹>
failure_recovery: <失败后保持暂停，记录缺口、影响范围和最小人工补救>
expiry_conditions: <规则/入口/周期/时区/绑定/指纹/授权任一变化即失效>
post_creation_verification: <创建后回读名称、类型、提示词、模型、推理、周期、时区、绑定、通知和状态；回读失败写 UNKNOWN>
```

## 交接引用规则

交接快照应直接保存本次重建所需的完整非秘密条件；`AI状态索引.md` 只记录本说明的相对路径、版本、SHA-256、适用范围和状态指针，不重复保存完整配置。继任者先核对说明存在、引用路径可解析和条件是否完整，再按 `state_decision` 选择“核验现有任务”或“形成待授权重建候选”。指纹一致只证明说明内容未漂移，不证明任务存在、任务已经运行成功或重建已经完成。

## 禁止推断

- 不能由说明存在推断平台任务存在。
- 不能由配置指纹一致推断任务内容执行成功。
- 不能由历史授权推断新任务创建或修改已获授权。
- 不能由重建候选推断任务已创建、已绑定或已开始运行。
- 不能由交接快照中的完整提示词推断秘密值、旧授权或新任务已经获准创建。
