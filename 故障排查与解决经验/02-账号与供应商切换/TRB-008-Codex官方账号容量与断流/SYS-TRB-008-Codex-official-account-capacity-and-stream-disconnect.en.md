# SYS-TRB-008: Codex official-account capacity and stream disconnect

| Field | Current record |
| --- | --- |
| Case ID | `TRB-008` |
| Resolution status | **Unresolved: initial support reply received; environment details pending** |
| Tool status | Read-only diagnosis; submitted through Help Center and awaiting support follow-up |
| Last verified | 2026-09-17 |
| Evidence boundary | Windows, Codex CLI 0.154.0, official ChatGPT sign-in path, and local reproduction for the affected account; this does not prove a specific OpenAI internal component or behavior for other accounts, regions, or versions |

> Safety first: preserve the original `.codex`, conversation history, and shared CC Switch / official-account configuration. Use the already-verified stable third-party API as a temporary workaround. Do not send API keys, access tokens, complete `auth.json`, or other authentication secrets.

## One-sentence symptom

After switching back to the official ChatGPT account, Codex Desktop and CLI show `Selected model is at capacity`, repeated reconnects, and stream disconnects. The issue remains reproducible with a fresh `CODEX_HOME`, fresh device login, Codex CLI 0.154.0, `provider=openai`, and a fresh session.

## Current resolution

There is currently no verified solution. Local diagnosis and a temporary workaround exist, but account-level routing, model admission, capacity allocation, rate-limit state, or another server-side cause remains to be confirmed by OpenAI Support.

## Environment and error signatures

- OS: Windows
- Product and version: Codex Desktop (exact version pending official verification); Codex CLI 0.154.0
- Sign-in/network path: ChatGPT device login; official `openai` provider
- Searchable phrases: `Selected model is at capacity`; stream disconnect; an intermittent `401 Unauthorized` occurred earlier in the original environment
- First recorded / last reproduced: 2026-09-17 / 2026-09-17

## Confirmed facts, inference, and open questions

### Confirmed facts

- A fresh `CODEX_HOME` and fresh ChatGPT device login showed `provider: openai` in the CLI.
- A fresh CLI 0.154.0 session returned capacity for GPT-5.6 Sol.
- GPT-5.6 Luna and GPT-5.5 also returned capacity; GPT-5.6 Terra reconnected, fell back from WebSocket to HTTPS, and then disconnected.
- The local `codex doctor --json` record showed usable ChatGPT credentials, loadable configuration, reachable inference endpoint, and a WebSocket handshake that returned HTTP 101.
- The old CLI 0.147.0 / newer models-cache schema mismatch was fixed by upgrading to 0.154.0, but capacity remained.
- The third-party API path had been stable; that does not contradict a failure on the official ChatGPT path.

### Reasonable inference

The evidence strongly points to an account-level routing, model-admission, capacity-allocation, rate-limit, or other server-side state problem after this account enters the official Codex backend. The specific internal component is unknown, and intermittent network or parallel failures cannot be ruled out absolutely.

### Open questions

- Whether OpenAI can locate account routing, admission, capacity, and rate-limit records by request ID.
- Whether an account-level incident, feature flag, regional capacity issue, or known service problem exists.
- Regression results for Desktop, CLI, and multiple models after OpenAI says the issue is resolved.
- The workspace shown by CLI `/status` (personal or Team) and whether Codex Web works for the same account.

## Investigation

1. Desktop and CLI both showed capacity / stream disconnects; the original scene was preserved.
2. Upgrading CLI 0.147.0 to 0.154.0 fixed the models-cache schema warning; capacity remained.
3. Multiple models and fresh sessions were tested, so the symptom is not limited to one model or an old conversation.
4. A fresh `CODEX_HOME` and fresh device login reproduced Sol capacity with `provider=openai`.
5. `codex doctor --json` checked local authentication, configuration, reachability, and WebSocket handshake; thread/rollout parity warnings were not treated as the root cause of this case.

## Workaround

1. Preserve the original `.codex`, conversation history, and shared CC Switch / official-account configuration.
2. Use the already-verified stable third-party API temporarily if development is blocked.
3. From the affected official ChatGPT account, open the support chat at the lower-right corner of the [OpenAI Help Center](https://help.openai.com/), submit the English feedback in the private draft area, and request human review of account-level Codex routing, model admission, capacity allocation, rate-limit state, and server-side status.

### Initial support reply (2026-09-17)

The support assistant did not see a current system-wide incident. It reported that the account's Codex usage/rate-limit state looked available (not fully blocked), and considered workspace/model-access context or WebSocket/network interference more likely. It requested a redacted CLI `/status`, the workspace type, and whether Codex Web works for the same account. No case/ticket number or server-side root-cause confirmation was provided; human escalation is not confirmed.

## Verification and rollback

- Verification: after official handling, test Desktop, CLI, GPT-5.6 Sol, GPT-5.6 Luna, GPT-5.6 Terra, and GPT-5.5 as specified in the external-feedback record; each model must succeed three consecutive times.
- Pass criteria: no capacity, abnormal 401, or frequent reconnects; Desktop and CLI both work; switching accounts does not corrupt conversation or authentication state.
- Not verified: official case/ticket, official server-side conclusion, and post-resolution regression.
- Rollback: no local data migration or deletion is involved; keep the current state and use the third-party workaround until official confirmation.

## Evidence register

| ID | Source | Date | Supported conclusion | Visibility | Pointer |
| --- | --- | --- | --- | --- | --- |
| `E01` | Local diagnostic summary | 2026-09-17 | Clean environment + official provider still reproduces capacity | Public summary | Original retained in private draft area |
| `E02` | User-provided incident record | 2026-09-17 | Investigation sequence, excluded directions, and evidence boundary | Private | `90-本地草稿/TRB-008-Codex官方账号容量与断流/事件经过.md` |
| `E03` | User-provided external-feedback text | 2026-09-17 | Support-submission text, secret boundary, and regression criteria | Private | `90-本地草稿/TRB-008-Codex官方账号容量与断流/发给官方的话.md` |
| `E04` | OpenAI Help Center support-chat reply | 2026-09-17 | No current system-wide incident seen; requested workspace, `/status`, and Codex Web comparison | Private | Current Help Center support chat; no case/ticket |

## Companion tools

None. This record does not perform cleanup, re-login, account switching, or remote operations.

## Revalidation conditions

Recheck after changes to Codex, Desktop, sign-in method, provider, model catalog, account, network path, or official support response. After an official resolution claim, run the complete regression; one successful message is insufficient.

## Revision history

| Date | Change | Basis |
| --- | --- | --- |
| 2026-09-17 | Created sanitized public record; archived original attachments in the private draft area | User-provided attachments |
