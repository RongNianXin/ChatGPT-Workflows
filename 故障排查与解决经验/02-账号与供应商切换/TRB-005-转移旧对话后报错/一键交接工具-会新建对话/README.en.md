# Codex Cross-Account Encrypted-Content Handoff

[中文](README.md)

## What this is

`codex-encrypted-cross-account-handoff` handles cases where an old Codex task cannot continue after switching accounts or providers.

Typical errors look like:

```text
The encrypted content for item rs_... could not be verified.
Reason: Encrypted content could not be decrypted or parsed.
```

The `rs_...` value is a changing encrypted-item identifier, not a fixed task ID. The skill recognizes `invalid_encrypted_content` and several related messages, including `Encrypted function output content could not be decrypted or decoded`; it does not hard-code one `rs_...` value.

The skill does not decrypt ciphertext from the old account. It exports the visible content that remains readable, makes the current blank task the `original-task-name-handoff-conversation`, and continues in that current window. It does not create a third task.

## Difference from ordinary handoff

Ordinary handoff is for an old task that can still respond normally. This skill is only for an old task that cannot continue because of an `encrypted_content` error.

## What it does

1. Scans tasks and confirms that the specified task has a qualifying encrypted-content failure.
2. Exports visible user and assistant messages, file changes, tool results, and recovery material.
3. Verifies that the current blank task remains in the original project.
4. Renames the current task to `original-task-name-handoff-conversation`.
5. Reports the current task ID, handoff quality, all unfinished items, and the first action for the operator.

## What it does not do

- It does not decrypt ciphertext from the old account.
- It does not modify, overwrite, or delete the original task.
- It does not create a third task, fork a task, or send the handoff prompt to another window.
- It does not recover hidden reasoning, old-account ciphertext, or unsaved editor content.
- It does not inherit remote publishing, deletion, billing, production, or irreversible authorization from the old task.

When the user specifies a task name or ID, the skill checks all readable turns instead of only the last error. A branch task may qualify if its history contains a real encrypted-content error; a history containing only 502, connection, or capacity errors is rejected.

## Skill storage location

```text
<CODEX_HOME>\skills\codex-encrypted-cross-account-handoff
```

Main files:

```text
SKILL.md
README.md
scripts\handoff.mjs
```

The skill must remain under `.codex\skills` for automatic discovery. This documentation directory stores notes and research only; it is not the runtime directory.

This documentation directory:

```text
<PROJECT_ROOT>\故障排查与解决经验\02-账号与供应商切换\TRB-005-转移旧对话后报错\一键交接工具-会新建对话
```

Visible-history exports are normally stored in:

```text
<CODEX_HANDOFFS_ROOT>
```

## The only beginner invocation

Create a blank task in the same project as the old task, then paste the following prompt and replace only `task name or task ID`:

```text
$codex-encrypted-cross-account-handoff
Please hand off “task name or task ID” in the current window. Handle only a confirmed encrypted_content failure: read the visible history, preserve the original project, rename the current window to “original task name-handoff conversation”, and continue the old task. Do not create, fork, or call another handoff task.
```

For one old task, use one blank task. Handle multiple tasks by creating separate blank tasks and repeating the same prompt.

## Path-name note

The Windows directory name is `A_Rong`. If chat or Markdown shows `A\_Rong`, the backslash normally escapes the underscore; it is not another directory name. Do not create or rename a directory to `A\_Rong`.

## Open-source note

Before publishing, remove local usernames, real task IDs, real handoff material, and personal directories, and add compatibility notes for different Codex versions. Public documentation must state that this is a visible-history handoff tool, not an official client patch or a ciphertext decrypter.

<!-- README-SOURCE-SHA256: d4a5cfd6855cc2d650689c7f90979ccdcf4c54556a8d6cedfb65997ca9d6fab9 -->
