# SYS-TRB-009: Project Configuration References a Missing Model Provider

| Field | Record |
| --- | --- |
| Case ID | `TRB-009` |
| Resolution | **Resolved: alias repair verified for this case** |
| Companion tool | None; diagnosis and minimal repair were completed through manual checks |
| Handling status | Minimal configuration repair and one reopen verification completed |
| Last verified | `2026-09-19` |
| Evidence boundary | Windows Codex desktop, the task shown in the screenshot, and same-machine configuration samples; backup, minimal repair, and one reopen verification completed. |

> Safe first action: stop repeated clicks, message sends, and retries. Preserve the configuration and screenshot so the apparent retry loop does not overwrite the evidence.

## Symptom in one sentence

Opening the task shows a rapidly flashing error: `ChatGPT cannot load config.toml ... Model provider 'OpenAI' not found.`

## Current resolution status

The case is resolved within the verified scope. The task saved provider ID `OpenAI`, while the user configuration only registered key `custom`. Adding a matching `[model_providers.OpenAI]` alias while preserving `custom` changed the task from `notLoaded` to `idle`.

## Confirmed facts, inference, and open questions

The screenshot names `config.toml` and the missing provider `OpenAI`. The project-level configuration did not declare a provider. The task metadata used ID `OpenAI`, while the user configuration used key `custom` with display name `OpenAI`. A project-level model-only override failed; a matching user-level `OpenAI` alias restored loading. The flashing behavior is consistent with a desktop load/fail/retry loop, but no request log proves rapid remote requests.

Open questions are the exact configuration precedence, desktop version, parser logs, and whether the same repair applies to other tasks. This task's saved provider field and recovery after registering the matching provider were verified.

## Investigation and safe path

The screenshot, task metadata, and project/user configurations were checked. A project-level model-only test failed and was reverted. After a backup, a matching user-level `[model_providers.OpenAI]` alias was added while retaining `custom`; reopening once changed the task from `notLoaded` to `idle`.

Do not replace the task reference with `custom` when its saved ID is `OpenAI`. Do not delete `.codex`, conversation history, or authentication files. A fresh-message business regression and desktop version check remain pending.

## Validation, rollback, and evidence

Success requires stable task loading, no flashing error, and one minimal message without the same configuration failure. Roll back by restoring the pre-change configuration backups. Evidence `E01` is the local screenshot; `E02` is the local read-only configuration check. Original files and screenshots remain private.

## Revalidation conditions

Recheck after any Codex configuration-format, provider-registration, project-config, or task-storage change. New error codes, request IDs, or logs require reclassification rather than automatic reuse of this record.

## Revision history

| Date | Change | Basis |
| --- | --- | --- |
| 2026-09-19 | Initial record; screenshot and configuration read-only checks completed | `E01`, `E02` |
