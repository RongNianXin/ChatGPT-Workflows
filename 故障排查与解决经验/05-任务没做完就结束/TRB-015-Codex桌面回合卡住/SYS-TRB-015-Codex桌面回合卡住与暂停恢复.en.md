# Codex Desktop turn stalls and pause/resume recovery

| Field | Current record |
| --- | --- |
| Record | `TRB-015` |
| Status | Partially resolved: symptoms resemble reported host/runtime stalls; the exact cause and a general fix for the installed version remain unconfirmed |
| Last checked | 2026-11-01 |
| Evidence boundary | Local turn records, tool exit states and operator screenshots were checked. Official documentation and public Issues were read. No host configuration was changed, and one pause/resume recovery is not treated as a root-cause fix. |

## Symptom

After a tool or test command completes, a long Codex turn can stop producing progress for a long time. Pausing and resuming sometimes lets it continue. A normal web page still loading does not rule out a stuck Codex turn, app-server stream, or renderer state.

## Findings

- This is not proven to be a local network outage.
- The historical troubleshooting notes recommend checking approvals, running a basic terminal command such as `git status`, waiting for other active tasks to finish, and only then considering an app restart if the stuck state persists.
- Public Issues describe closely related states: reasoning continuing after a tool completes, stale Windows `Thinking` state, app-server sessions that stop progressing, and `thread/resume` hanging when a thread is active without a running turn.
- The local workspace was not shown to be damaged by pause/resume.
- The exact local cause remains unknown: renderer state, app-server, model generation, route/provider behavior and a single tool process are separate hypotheses.

## Safe recovery

1. Check the last tool exit code, result file and process state before repeating a command.
2. First confirm that no non-repeatable deletion, remote write or deployment is running or has an unknown result, and that no approval or human acceptance check is pending. Wait for a bounded interval, then let the operator try one pause/resume cycle. If this cannot be confirmed, preserve evidence and do not resend commands.
3. If there is still no new tool, result or explicit blocker, preserve the workspace and turn evidence. Do not repeatedly send `write_stdin` or continue prompts.
4. Resume from a saved checkpoint in a new turn only after checking actual side effects.
5. If several tasks stop at once, inspect the local app-server/host state; if one task is affected, inspect that task's tool and session record first.

## Official follow-up

A follow-up can be prepared. The symptoms resemble reported host/runtime stalls, but the exact cause and a general fix for the installed version remain unconfirmed. Local connections, intermediaries and tool processes have not been ruled out. Use an existing Issue where possible and provide only sanitized timestamps, Windows/Codex versions, the last successful tool, pause/resume behavior and a minimal log excerpt. Do not upload project files, full transcripts, credentials or absolute local paths.

Historical references, not rechecked online in this pass:

- [Codex troubleshooting](https://learn.chatgpt.com/docs/reference/troubleshooting)
- [Issue #52529: reasoning-only stream after tool completion](https://github.com/openai/codex/issues/52529)
- [Issue #56998: Codex server stops progressing](https://github.com/openai/codex/issues/56998)
- [Issue #34026: Windows Thinking state desynchronization](https://github.com/openai/codex/issues/34026)
- [Issue #37047: resume hangs with no running turn](https://github.com/openai/codex/issues/37047)

This record does not authorize a public post.
