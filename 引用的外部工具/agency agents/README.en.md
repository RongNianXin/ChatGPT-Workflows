# EXT-001: Agency Agents Entry

[简体中文](README.md)

Agency Agents is a collection of professional role prompts. It helps your current AI apply planning, engineering, design, or testing methods to a task. This is the tool's only operator entry; the AI reads internal procedures as needed. Official open-source source: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents).

## When to use it

Once this workflow is enabled and its current rules have actually been loaded, describe your task normally. The AI checks role fit at each new substantive task. Complex, professional, or cross-responsibility work uses suitable roles once formal-use conditions are met; simple questions, confirmations, and formatting may skip them. Valid choices are reused within a stage, reassessed when responsibilities change, and recovered from records after compaction or handoff. You need not remind it every time, and roles are not downloaded for every message.

You can still emphasize or request roles explicitly, for example:

> Assign yourself a suitable Agency role for this documentation review.

The AI matches the complete upstream role catalog before checking shared installations. It reuses valid files and obtains missing roles only at an actually authorized location, then verifies them. Candidates are not limited to downloaded roles. You do not need to guess names or installation commands. Missing catalog, source, files, or write permission affects only the relevant step.

Ambiguous words such as agents or roleplay are not invocation or persistent-use authorization; default adaptation follows the actual task. An explicit task opt-out, pause, disable decision, or stricter project restriction takes precedence. Roles provide methods, not additional permissions to change products, play-test, communicate, install, publish, or dispatch. First use is read-only by default; later implementation follows the main task's valid authorization.

### Regular-use template

An adequate natural-language request needs no additional template. For a fixed format, copy:

```text
I want to do [task goal]. Use Agency Agents to match the minimum suitable role or roles from the complete upstream catalog, not just downloaded roles. Verify existing files; obtain and read missing roles only at an actually authorized installation location, and explain any specific permission gap. Bind suitable responsibilities to this task and start with a read-only check. Do not modify products or perform remote writes.
```

This binding lasts until the business task ends, you revoke it, or it no longer fits. An explicit one-use request remains limited to that use. It does not rewrite a project-specific persistent agreement. The public default applies independently under the current rules; no additional scenario or full role prompt is required.

### Persistent use in ordinary conversations

The public default already covers later suitable tasks; a persistent-use template is not a prerequisite. Use the following configuration template when you want a custom project scope, allowed responsibilities, or recovery agreement. Configuration-only work starts neither business execution nor formal role calls:

```text
Enable persistent Agency Agents adaptation for this project, including ordinary conversations without Goal mode. Select the fewest necessary roles from the complete upstream catalog. Reuse valid installed roles, obtain and verify missing roles at an actually authorized location, and explain only new permission gaps.
Lightly reassess at substantive work-stage or responsibility changes. Reuse a suitable selection; switch or supplement only when needed. Do not require a reminder every turn or repeat full matching and downloading for every message.
Save scope, switching conditions, and recovery pointers in an existing authorized project record, reread it, and verify that startup and handoff entries can reach it. Configure only now; do not execute business work, create a Goal, change global configuration, or write remotely. Report what was saved, whether the entry is connected, and actual gaps.
```

Configuration is ready only when the agreement has been saved and reread, and the project startup or handoff entry can locate it. A chat promise or an unreachable record is insufficient. Missing write permission or scope requires a concrete proposal, not a completion claim.

Afterward, describe tasks normally. The AI reassesses goals, acceptance, and stages rather than switching mechanically on keywords. Ordinary feedback within the same stage reuses valid choices. Switching neither reruns completed work nor resets budgets or grants installation/business permission. Project restrictions such as “no automatic installation” remain in force.

The project agreement lasts until the project ends, you disable it, or its scope becomes invalid. A completed business task closes its binding while retaining the project agreement. New projects do not inherit it automatically. After context compression or handoff, the receiving instance recovers records and the original breakpoint, independently verifies and rereads required roles. An unconnected new chat is not guaranteed to discover it.

### Multiple roles in one AI

A task may combine a few complementary roles, such as defect testing, gameplay, and UI observation. Report evidence separately for applicable dimensions; more titles do not guarantee better quality. If the native role parameter accepts only one value, explain the actual combination of read responsibilities rather than claiming multiple native registrations.

Changing review roles in one AI remains self-review, not review by a different instance. Without actual observations, do not claim play-testing. Engineering checks do not substitute for human, device, or professional acceptance; aesthetic advice does not substitute for your approval.

### Pause, stop, and resume

Say “pause the current role,” “disable automatic role adaptation for this project,” or “do not use Agency Agents for this task.” The AI identifies the scope, stops affected calls at a safe breakpoint, and preserves results and consumed budget. Unrelated main work does not automatically pause. Explicit resumption is required after a pause; old records cannot re-enable a disabled policy. A task-specific opt-out applies only to its stated scope.

Goal and roles are managed separately. Role output does not prove a Goal resumed or completed. Keep the original business goal, quota, and stop conditions; preparation does not create or resume a Goal. When installation and current use are both explicitly requested and authorized, continue verification, reading, and the permitted check without requiring another activation prompt. Installation alone does not authorize execution.

Formal calls stay within the original bounded plan, recording consumption before starting. An interrupted call continues as the same call; a completed call waits without rerunning on handoff. Special tasks load their own authorized responsibilities, with the commander handling closeout. Shared role files contain no other project's business bindings.

## What you should see

At first actual use, a substantive responsibility change, or a gap, briefly report responsibilities and fit, actual reading, and result evidence. Ordinary same-stage feedback need not repeat identities. Role names do not prove use; configuration does not prove improved quality, and gains require comparable evidence.

Without a reliable consumption record or applicable budget conditions, retain a role proposal and explain recovery conditions. Continue independent authorized main-task work without claiming formal role use or reliable handoff. Explicit first-principles or review reminders merge with the current-stage check rather than adding another round.

If selection fails or handoff does not restore adaptation, explain the goal or point out the existing project agreement. The AI checks formal entries and records. File mismatch, network failure, and installation permission gaps are handled separately, without requiring repeated full prompts or blocking all work.

## Current state and installation boundaries

The shared registry currently contains seven roles. It is an installation inventory, not the full candidate catalog. The AI checks sources, versions, and actual files through the [shared state](../角色共享状态.json) and [installation record](安装与维护记录.md). Other devices use their own accessible evidence. Native registration, real handoff recovery, and quality gains require separate verification; static document checks do not prove them.

User-level shared installation and project-local temporary reference copies are recorded separately. Location and actions must be authorized; a temporary copy does not mean global installation. External roles do not override system, workflow, project, or privacy rules, install unrelated dependencies, or overwrite existing roles.

## Internal references for AI

Default triggering, skipping, stopping, and recovery follow [shared contract section 2.3](../外部工具自动对接规范.md#agency-default-adaptation). Intent, complete-catalog matching, caching, acquisition, stage reassessment, and multiple responsibilities follow [shared contract section 2.2](../外部工具自动对接规范.md#22-agency-agents自然语言选角完整目录与多职责). Cross-project discovery starts at the [registered catalog](../外部工具目录.md) located from the verified workflow root, not a guessed product folder.

Read the [invocation guide](调用指南.md), [cross-project reference](跨项目引用提示词.md), [activation card](角色激活卡模板.md), [personalization advice](个性化配置建议.md), and [feedback record](../角色经验与反馈记录.md) as needed. Trial baselines, preparation, and consumption still follow shared section 5, without a separate operator preparation template.

<!-- README-SOURCE-SHA256: 594a7159123ecbb6bb8ff1867a6846c9fd5da405dbe134bdd6f8962060a1db51 -->
