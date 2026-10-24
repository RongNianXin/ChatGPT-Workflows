<!-- README-SOURCE-SHA256: aa6ca1a1e0b99c61ca1fcead3341423791cb10a59179893c686e8f639a1e8e2a -->

# Codex task continuation guard

[简体中文](README.md)

Add independent acceptance checks to a newly launched CLI task. When the task tries to stop, a reviewed checker inspects the actual result. An actionable failure can continue the same turn while the original budget remains valid. An AI completion claim or a zero CLI exit code alone does not establish completion.

This is a per-task local launcher. It does not install hooks into existing desktop conversations, resume old tasks, send cross-chat messages, change global settings, or exit or restart Codex. The session handoff assessment tool remains separate. No resident service or scheduled automation is created.

## Use

The AI responsible for the authorized task prepares its contract, original prompt and read-only checker, including paths, fingerprints and acceptance criteria. The operator does not need to provide test samples or write scripts. Starting the guard grants no additional business, resource or remote permissions.

Run from an existing PowerShell session in this tool directory:

```powershell
& './Start-GuardedTask.ps1' -Contract '<TASK_CONTRACT.json>' -Prompt '<TASK_PROMPT.txt>'
```

This starts only that new CLI task. Success ends with `verified: true` and a local run directory; other outcomes remain unverified. On failure, preserve `state.json`, `cli.jsonl` and `cli.stderr.log` from that directory for diagnosis. Do not retry the business operation blindly. The launcher uses an existing npm CLI installation and authentication without login, logout or restart commands. Use `-CodexJs` for another existing installation entry; nothing is installed automatically.

```powershell
node './guard.mjs' status '<RUN_DIRECTORY>'
node './guard.mjs' stop '<RUN_DIRECTORY>'
```

`status` is read-only. Only `finalized: true` together with `verified: true` proves final reconciliation passed. A check that passed during execution cannot certify later changes. `stop` requests cancellation only for the CLI and child processes owned by this launcher, leaving other Codex processes alone. Completed business side effects cannot be undone. After cancellation, deadline or interruption, inspect artifacts and pending effects before any replay.

## Contract and checker

The version-1 JSON contract defines a stable `workItem`, a `cwd` relative to the contract, a cumulative `maxMinutes` including waits and checks, `maxContinuations`, and `maxNoProgress` for unchanged artifacts or failures. These are ceilings, not targets, and do not replace the original high-resource test budget.

`checker` pins `executable`, `entry`, string-array `args`, `timeoutSeconds` (1–30 seconds), and SHA-256 fingerprints of the executable and dependencies. With an interpreter, the first argument must be the check script entry. Both executable and entry must appear in `pins`. The reviewed checker declares `readOnly: true`, `network: "none"`, `idempotent: true`, and `spawnsChildren: false`. These declarations are not OS isolation. Fingerprints prevent accidental acceptance changes, not malicious changes by the same account. Pin every dependency that affects acceptance; do not hide business execution, networking, service startup or expensive tests in the checker.

Guard source, run directories, the unique registry, checker and pinned dependencies must be outside the guarded `cwd`. The guard inside this repository cannot directly guard this entire repository root. Other projects require their own execution authorization. Repository tests use isolated subdirectories. Guarding the whole repository requires an explicitly authorized external control location; this launcher does not automatically copy or modify files outside the repository.

Contract example; the AI must replace placeholders before use:

```json
{
  "version": 1,
  "workItem": "authorized-work-batch-1",
  "cwd": "<AUTHORIZED_TASK_WORKTREE>",
  "maxMinutes": 60,
  "maxContinuations": 3,
  "maxNoProgress": 2,
  "checker": {
    "executable": "<EXISTING_NODE_EXECUTABLE>",
    "entry": "<REVIEWED_CHECK_SCRIPT>",
    "args": ["<REVIEWED_CHECK_SCRIPT>"],
    "timeoutSeconds": 10,
    "readOnly": true,
    "network": "none",
    "idempotent": true,
    "spawnsChildren": false,
    "pins": [
      { "path": "<EXISTING_NODE_EXECUTABLE>", "sha256": "<ACTUAL_SHA256>" },
      { "path": "<REVIEWED_CHECK_SCRIPT>", "sha256": "<ACTUAL_SHA256>" }
    ]
  }
}
```

The checker prints exactly one JSON object:

| Field | Requirement |
| --- | --- |
| `status` | `PASS`, `ACTIONABLE_FAIL`, `WAIT`, or `BLOCKED` |
| `reason` | Short explanation without credentials |
| `progressKey` | Stable artifact fingerprint or failure set, never timestamps or model wording |
| `pendingOperations` | Original operation identifiers still awaiting final results, or `[]` |

The corresponding exit codes are `0`, `10`, `20`, and `21`. Both status and exit code must match. Empty or invalid output, crashes, timeouts, changed pins, and a `PASS` containing pending operations fail acceptance. Subjective professional quality or operator satisfaction should return `WAIT`, rather than treating file existence as acceptance. Scope or authorization changes require stopping the old guard and updating the contract and existing responsibility record.

## Continuation and stopping

Only this CLI invocation receives `Stop`, tool lifecycle and interruption hooks. User or project `hooks.json/config.toml` is not modified. After reviewing the fixed hooks, the launcher uses the official one-time hook trust option for this invocation. It does not bypass business approval or sandbox controls. The CLI uses `workspace-write` and noninteractive approval settings; insufficient permissions leave the task incomplete.

- A passing `Stop` records `VERIFIED`; an actionable failure returns the official `decision: block` response so the host continues the same turn with the reason.
- Pending tools defer acceptance until their original results arrive. Background session identifiers and unknown results remain pending; explicit permission denial stops continuation. The guard never replays business commands. Tools outside the lifecycle hooks still depend on checker `pendingOperations`; complete background coverage is not guaranteed. Textual terminal-state detection is not OS process proof.
- Human input, blockers, cancellation, deadline, continuation limit or no progress stops automatic work without claiming acceptance. Indistinguishable duplicate stop events are handled conservatively and may require early human review.
- A canonical working directory and stable work item share one registry. Changing the run directory cannot reset budgets. Duplicate launches do not start business execution. Finalized or uncertain state is not automatically reset and an old CLI is not taken over; a genuinely new authorized round requires checking prior side effects and budget first.
- Final exit reconciliation requires a valid `Stop`, verified state and clean termination. Later cancellation, hook errors, tool activity or newer stop events invalidate earlier success. Crashes and network failures do not trigger automatic replay.

Hooks are not a completion judge and do not guarantee final text has not yet appeared. Evidence covers the tested CLI path; existing desktop conversations are not integrated. See official [Hooks](https://developers.openai.com/codex/hooks) and [noninteractive mode](https://developers.openai.com/codex/noninteractive).

## Automated verification

```powershell
& './Start-GuardedTask.ps1' -SelfTest
```

The self-test generates its own inputs, uses isolated `CODEX_HOME` and a local mock model endpoint, and reads no current credentials or real model channel. It reproduces a wrong answer with a zero CLI exit code, then shows same-turn continuation and independent arithmetic acceptance with zero business command executions. Other fixtures cover background and unknown results, denials, duplicate launches, changed checkers, no progress, cancellation, abnormal exit and existing hook compatibility. Mock tests do not prove real-model task quality, business algorithms, performance gains or all tool chains.

A separate business-tool execution attempt was denied by local policy without permission relaxation; actual business-write end-to-end behavior remains unverified. Isolated events exercise lifecycle, pending and no-replay logic. Private evidence stays under ignored `.planning/continuation-guard-tests/`; run state and the unique registry stay under `.codex-manual-cache/task-continuation-guard/`. Do not distribute those private records.
