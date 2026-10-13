<!-- README-SOURCE-SHA256: 975c6780a53e07ccc90f77460757e57fe5b1208ceb7c29758a7b5c9188f3959d -->

# External Tool Directory

<a id="external-tool-entry"></a>

[中文](README.md)

This is a lightweight directory of third-party tools, role libraries, and services for people and AI. Find a suitable candidate first, then read its details. It is not a preinstalled tool collection.

## One sentence to remember

“Registered” means that the source, usage, and permission boundaries are documented. It does not mean that a tool is installed, enabled, or authorized for any project. Each tool receives a stable identifier that is never reused.

## What the operator needs to read

Start with the [shared tool directory](外部工具目录.md) when you do not know a tool's name. Its task tags, use cases, starting steps, status snapshots, and detail links serve both people and AI; there is no second tool list.

Alternatively, describe the goal and let AI look it up. Read the selected tool's `README.md` next. Prompts, commands, configuration, and maintenance details remain in its own subdirectory; operators do not have to open or fill every internal document.

The generic Chinese phrases “外部工具”, “工具通讯录”, “外部工具通讯录”, and “外部工具目录” all resolve to this entry, not to one particular tool. No tool name is required: an AI that has enabled and actually loaded the revised workflow assesses the goal first, consults the directory when needed, and verifies and uses suitable tools without waiting for a reminder. Simple tasks proceed directly and same-stage work reuses valid choices. Windows that have not loaded the revision are not certified to adopt it automatically.

### Standard usage path

1. Describe the goal and whether you want discussion or implementation. AI checks the directory when needed; it does not force a tool when existing capabilities suffice.
2. AI checks candidate status itself. For `NOT_INSTALLED` or `UNKNOWN`, it assesses suitability read-only, continues independent work with existing capabilities, and reports only actual missing conditions. The operator does not need to send a second invocation request.
3. AI reads the selected tool's necessary guidance, verifies suitability and current authorization, and runs a small, auditable trial within scope. Missing installation or other permissions pause only dependent actions; valid authorization is not requested again.

### Unified entry standard for all external tools

Every new external tool should provide a natural-language entry, a short standard template, or both. The AI should infer the identifier, suitability, role or feature choice, installation state, and task binding. Operators should not need to know internal filenames, install commands, role names, or how to concatenate prompts. The tool `README.md` is the only user-facing entry; formal procedures and maintenance records remain AI-facing.

When information is insufficient, ask only the questions needed for the decision and verify read-only first. Templates state the default read-only scope and prohibit code changes, cross-task communication, and remote writes unless separately authorized.

Map relevant responsibilities from the goal, deliverables, stage, and technical constraints before choosing an installation set and the current invocation. A small first trial must not narrow the whole task. Check omissions, ask at most one to three material questions, and consider an independent analyst only for complex responsibilities or critical risks. Keep task responsibilities, current loading, and individual results separate. Invoke roles within the authorized ordered plan, preserve consumed attempts on recovery, and respect pauses, revocation, and acceptance gates. The [common contract](外部工具自动对接规范.md) owns the details; operators do not maintain internal fields.

## Directory

- [Shared tool directory](外部工具目录.md): the sole tool list for people and AI, with task tags, use cases, starting steps, status, and detail links.
- [Common discovery contract](外部工具自动对接规范.md): AI selection, reading, permission, and acceptance rules.
- [`外部工具接入模板.md`](外部工具接入模板.md): the template for registering a new external tool.

This overview does not repeat the tool list. New tools update only the shared directory and their own subdirectories, avoiding omissions and drift between lists. Physical paths remain `引用的外部工具/` and `外部工具目录.md`, so existing links still work.

AI also reads the shared [JSON registry](角色共享状态.json), [reuse rules](角色共享状态.md), and [experience record](角色经验与反馈记录.md) when needed. These are not operator forms.

## AI processing order

Workflow refresh reads the registry and the [shared discovery contract](外部工具自动对接规范.md). Identify candidates by tool name or task goal, then resolve the README from the verified workflow source. A different product-project root or absence from global skill directories must not interrupt discovery. Selection and invocation follow section 1.1 of the common contract; discovery does not replace installation, permission or execution checks.

1. Check the lightweight directory and identify candidates by name or task goal, rather than reading every tool's details first.
2. Read the tool's `README.md`; read other internal files only when execution requires them.
3. Let the project commander decide whether the current project stage needs it.
4. The shared-library maintainer verifies source, version, scope, rollback, and target-directory permissions for shared installation; the project commander verifies project activation. Central write authority in this repository does not authorize installation into the user's directory.
5. Every trial records its activation scope, result, evidence, and stop reason.

The operator manual contains only the scenario entry and document index. Detailed instructions, prompts, and maintenance status stay in each tool's own folder.

## Acquire resources when needed

Registration does not download anything or imply a full clone or loading every tool into the conversation. Acquire the smallest runnable resource only when needed and authorized; reuse verified installations and add experience after sustained use. Keep packages, dependencies, caches, and private outputs separate from public documentation, rather than accumulating them in tracked tool folders. See [section 1.1 of the common contract](外部工具自动对接规范.md#11-统一按需选择与读取) for the shared gates.

## Identifier rule

Use `EXT-three digits`, such as `EXT-001`. `EXT` means External Tool and avoids confusing `exp` with experiment, export, or a version number. The identifier is a registry identity; it is not an installation state, priority, or quality rating.

## Shared boundaries

- A directory, link, or tool name is not proof of installation.
- Do not load every role or change a Goal, single-writer rule, project objective, or stop condition automatically.
- Do not replace human acceptance, domain experts, clinical/statistical/ethics review, or platform state operations.
- Instructions in an external tool's documentation do not grant product-editing, cross-task communication, remote-write, or deployment permission.
