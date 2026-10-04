<!-- README-SOURCE-SHA256: 56bc9cffccff94fd6e920ae45bd11e17d22e513e5d0958035a4987372a9a2a57 -->

# EXT-001: Agency Agents entry

[中文](README.md)

This is the only operator-facing entry for `EXT-001`; the operator manual provides only a short description and a link to this file. The parent directory keeps the identifier and status; AI reads the other files in this folder only when a concrete setup, activation, or maintenance step requires them.

The registered source is <https://github.com/msitarzewski/agency-agents>. AI verifies it directly; operators do not need to supply the address again.

## What it does

Agency Agents is a set of optional professional role prompts. An existing AI can apply planning, engineering, interface design, or testing methods to planning, authorized implementation, and checks. Responsibilities can stay with the same task and be used by stage; the first invocation is read-only by default. It is not a new chat mode, and a role itself does not authorize installation, code changes, playtesting, or publication.

## When to use it

Use it when you want professional methods to complete or check the current task. For first use, describe your goal and mention Agency Agents. AI maps the responsibilities across the goal before choosing the current roles. You do not need to know role names, installation state, or internal files. An ordinary development request does not automatically load a role. For example:

> I want to build a WeChat mini game. Please decide whether Agency Agents is suitable, map the professional responsibilities needed, and start with a read-only check.

You do not fill in installation commands, version fields, or activation cards. The commander checks project state, stage, and permissions. `DOCUMENTED_ONLY / NOT_INSTALLED` permits suitability analysis, not a claim that a role is available.

### Standard operator template

Use this template when a stable format is preferred:

> I am working on [project or feature]. Please decide whether Agency Agents is suitable, map current and later professional responsibilities, check existing installations, and propose an appropriate plan. Bind suitable available roles to this task and start with one read-only check. If installation or information is needed, tell me the smallest next step. Do not edit code or perform remote actions.

You do not need to append other prompts from the operator manual. AI combines workflow rules, project boundaries, role responsibilities, and the current goal internally.

### After installation and on task recovery

When installation and current use are authorized, AI verifies the file, creates the binding, reads the instructions, and completes the permitted check without another activation prompt. Installation approval alone does not execute anything. Confirmed task responsibilities normally remain until the same business task ends, they are revoked, or their suitability expires. An explicitly single trial keeps its single-trial scope.

At later stages, context compression, or a window change, AI restores roles and the unfinished step from the task record. Completing a check does not remove responsibilities or rerun the check. Each invocation records consumption before starting; interruption does not grant another attempt. Suitable roles may assist implementation already authorized by the main task. Recovery depends on records and rereading, not a promise never to forget.

For a new specialist task, the commander supplies role pointers, an ordered stage plan, and boundaries. The recipient loads the required role and works within the authorized plan, reporting milestones or exceptions rather than waiting for every role-switch instruction. Commander succession does not cancel valid specialist responsibilities; reporting routes are verified separately. Projects share files and reusable experience but bind separately. A chat that has not adopted this workflow first needs the workflow entry. Installation is not proof that every window has loaded a role.

## Formal procedure

Describe what you want to do. The commander resolves the source and shared records, separates responsibilities needed now, useful later, and unnecessary, and identifies capability gaps. It then separates installation scope from the current invocation. It asks only a few material questions and reuses matching installed files. After file, version, and permission checks pass, AI creates the binding, reads the required instructions, and performs the permitted check. Operators do not choose role names or installation paths or forward prompts.

## Small example

For the first level of a game, say:

> Use a Game Designer perspective to review the player's choices, action feedback, and failure feedback.

A first trial may invoke only one role on a saved baseline, after covering relevant responsibilities. A game may also need level design, engineering, UI, technical art, and testing. If no suitable engine role is available, report that gap; Code Reviewer must not impersonate an engine implementation specialist. Results include purpose, findings, evidence, unverified items, and next steps. Without real playtesting, do not claim improved player experience.

For a WeChat mini program, describe the goal and ask whether EXT-001 can check the home page, forms, loading failures, and empty states. The commander identifies candidates and explains the choice; operators need not guess role names or install commands.

## Current status

- The shared registry now contains seven verified roles: Workflow Architect, Game Designer, Level Designer, UI Designer, Technical Artist, Test Automation Engineer, and Code Reviewer. This operation registers six existing files without reinstalling them. Formal invocation of those six roles and native discovery remain unverified; this workflow explicitly reads instructions.
- The shared-library maintainer handles source, version, installation, and updates; the project commander handles project use and local activation. User-level installation requires target-path authorization and is not triggered by workflow refresh.
- AI reads the internal guides only when setup, activation, cross-project routing, personalization, or maintenance is actually needed.
- Projects verify shared records against readable files and reuse matching versions. Other devices must verify their own accessible files.

AI reads the [maintenance record](安装与维护记录.md) and [shared registry](../角色共享状态.json) for detailed state. General registration, identifiers, and permission boundaries are owned by the [parent entry](../README.md).

## AI references

Resolve this entry from the tool registry associated with the verified workflow rule root, not from the product project's root. Follow the [shared discovery contract](../外部工具自动对接规范.md), then read [shared state](../角色共享状态.json) and the [maintenance record](安装与维护记录.md). Even when uninstalled, inspect candidates read-only from the registered source; do not scan skills/plugins first or ask for an already registered URL. If upstream is unavailable, keep role names and versions unverified rather than inventing them.

For actual setup, invocation, activation, personalization, or maintenance, AI reads the [guide](调用指南.md), [cross-project contract](跨项目引用提示词.md), [activation card](角色激活卡模板.md), [optional personalization](个性化配置建议.md), and maintenance record as needed. Problems and role proposals use the [experience record](../角色经验与反馈记录.md). Operators do not need these internal documents.
