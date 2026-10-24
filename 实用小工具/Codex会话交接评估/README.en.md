# Codex session handoff assessment

[简体中文](README.md)

Save frequently used task IDs and query local Codex turns, file size, compaction and handoff guidance with one click. **Recommended download: Windows desk 0.2.0-dev.10.** No commands are required for everyday use. Source sessions are read-only; data is not uploaded.

The repository source includes score-bar recovery, history compatibility and Chinese text encoding fixes; the published dev.10 ZIP is unchanged. Reload the page for the renderer fix; restart only this tool to adopt backend/analyzer edits. Codex need not be restarted.

## Download and start

1. [Download the standalone Windows ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/windows-sessiondesk-v0.2.0-dev.10/Windows-SessionDesk-0.2.0-dev.10.zip), extract it completely, and double-click the root `Start-SessionDesk.cmd`. You do not need to clone the repository. Do not open the HTML by itself.
2. If you cloned the repository, double-click [Start-SessionDesk.cmd](Start-SessionDesk.cmd). Repository source may be newer than the download; use the version displayed at the top of the page.
3. Save a task ID. Query / Refresh updates that task, while Refresh all updates the complete list. The conversation name and local project are detected automatically. Basic and detailed reports have separate areas, with Simplified Chinese and English available.

Uses built-in Windows PowerShell 5.1 and a browser. Windows Edge is tested; macOS and other browsers are not. This remains a development preview, without a claim of comprehensive device or very-large-log compatibility.

`windows-local` contains the application, not temporary files. Use the launcher in this directory. Personal tasks and history stay in its `.local` folder and are excluded from distribution.

## Version status and download verification

`0.2.0-dev.10` is available from GitHub, but it is still marked as a development preview rather than a stable release. Repository source, the published ZIP, and a locally created package may come from different points in time; the same filename does not prove identical contents. When checking whether local and remote versions match, record the local runtime package version, the remote release tag, the downloaded ZIP SHA-256, and whether the release is a prerelease.

After downloading, run this PowerShell command against the actual file:

```powershell
Get-FileHash .\Windows-SessionDesk-0.2.0-dev.10.zip -Algorithm SHA256
```

Compare the result with the attached `SHA256SUMS.txt`. Different hashes mean the archives are not byte-for-byte identical; a matching version number alone is not synchronization evidence. A formal release or replacement of a remote asset requires fresh validation of the exact package and a separate confirmation for the remote action.

## Everyday use

- No fixed saved-task count limit; regression covers 20 tasks. Search, arrow ordering and Sort all are available, with order saved to disk. Refresh all runs at most two queries concurrently and restores the previous selection; an empty selection stays empty.
- The latest successful score uses orange at 3-7 and red at 8-10, with advice to review a safe breakpoint. This is a query snapshot, not live state; old scores are explicitly historical.
- Each task retains its latest successful basic output and detailed report per language. Reopening shows the original query time and a historical-snapshot notice; statistics update only on a new query.
- **Closing the page does not stop the background service.** Select Exit tool at the top of the page when finished to stop this tool and its unfinished queries, without stopping Codex conversations. Bilingual hover help explains the button. Close the page after the prominent exit confirmation and use the launcher to restore saved tasks and results.
- An interrupted or failed refresh does not turn old history into a new success. Previously saved history remains available after reopening. A visible result does not mean the AI is currently running.

## Score and slider

Current results use `handoff-score-v6-traditional`, restoring file-size plus compaction-count scoring. The 0-10 scale, recommendation at three (orange), required tier at eight (red), ten segments and three/eight markers remain. Unqueried or invalid scores show empty gray segments, not a fabricated zero.

| Component | 0 points | 1 point | 2 points | 3 points | 4 points | 5 points |
| --- | --- | --- | --- | --- | --- | --- |
| File size (MiB) | <30 | 30-<50 | 50-<100 | 100-<200 | 200-<400 | >=400 |
| Compaction count | <4 | 4-<7 | 7-<10 | 10-<15 | 15-<20 | >=20 |

Add the components: 46 MiB and ten compactions give 1+3=4; 200 MiB and fifteen compactions give 4+4=8. Size is the aggregate bytes of discovered session segments divided by 1,048,576; compactions are detected events. Reports show both observed values, their contributions, all bands and the total equation.

Current input, window utilization and observed growth do not affect scoring. The tool does not forecast future pressure or turns to an observation target. The 85%/95% capacity reminders are separate. Earlier dynamic scores remain explicitly historical until queried again; ratios without valid scores are not converted to points.

Traditional thresholds are heuristics, not calibrated against end-to-end cost or completion quality. File size is not current input tokens, and compaction count is not current load. Three points is not a proven token optimum; neither 100,000 nor 150,000 tokens is an established universal mandatory handoff threshold.

Cards show the latest logged request input directly below the score, without repeating the scoring method; the detailed report retains all scoring evidence. Restored, source-changed or failed-refresh results visibly say “Previous query input”; the tooltip preserves the original observation and query times.

Native per-request input is independent: a valid nonnegative safe integer (including zero) can be shown without a window or cumulative counter. It is not cumulative input or the length of a user message. Capacity, utilization and growth are validated separately. `input_tokens` already includes `cached_input_tokens`; do not add them again. Use `model_context_window` from the same event, not the largest routing-group window; missing cumulative `total_tokens` does not establish a continuous observation. Growth averages five intervals from final observations in six completed turns sharing the same session, model, declared provider, window and compaction segment. Missing/invalid usage remains unknown; valid zero remains zero. Compaction, identity/window changes, counter rollback or missing new usage resets the baseline; repeated snapshots add no samples. Negative growth is retained; insufficient samples leave growth unknown. There is no arbitrary observation target or forecast of turns to reach it. Declared provider does not prove the actual gateway upstream.

Handoff decisions need two further checks: whether the current work unit is complete, evidence is sufficient and recovery is possible; and whether future savings exceed preparation, rule reloads, cache rebuilding and expected rework. A terminal log turn cannot prove business completion. The tool cannot reliably infer these conditions and reports them as unknown. If capacity permits, complete the current unit and hand off at a safe breakpoint. Otherwise preserve evidence and a recoverable checkpoint first, without interrupting in-flight work or insisting on completing the entire task at any risk. A score of eight or more is a red traditional-heuristic signal, not an immediate window-switch command.

Simplified token break-even is `N × (C - R) > H`: C is old-window input per model request, R is reconstructed new-window input, H is handoff overhead, and N counts future model requests. This assumes comparable accounting and roughly stable future inputs; a user turn can include many model requests. Cache rates, input/output prices, long-context multipliers, time and quality risks can change the result, so token savings do not directly equal money saved. Missing inputs never justify precise benefit claims. No extra sampling is required from the operator and no handoff is executed automatically. Query timestamps identify snapshots, not proof that a task is running or complete.

See the [Windows desk guide](windows-local/README.en.md) for storage, invalidation rules and bilingual maintenance. [Real-world previews](../../SHOWCASE.md) collects redacted screenshots.

## Upgrading and older versions

Stop the old tool and back up its `windows-local/.local` directory before copying it to the corresponding location in the new folder. Do not overwrite another existing data set. It contains task lists, history and reports, so retain it before deleting a program folder. dev.5 and earlier cannot reconstruct basic output that was never saved; full history starts with successful dev.6 queries.

Old HTML prototypes and synthetic demos are retired from the current distribution. Their development stages remain in Git history. This page recommends the current Windows version only. The command-line analyzer remains available for scripting and independent checks; it is the same statistical implementation.

## Command line and validation

- The [command-line quick guide](查看当前任务本地对话文件大小.md) (Chinese) uses the same `check-codex-session.ps1`. Chinese is the default; add `-Language en-US` for English.
- `compatibility-fixtures.json` contains synthetic regression cases for the repository’s JSON field-order checks, not user data.
- Release preparation includes 47 automated simulation checks with isolated synthetic data, repository quality checks and ZIP verification. The operator reported successful dev.9 manual use. These 47 checks cover defined behavior and boundaries; they do not mean that every computer, system environment or real session has been tested, and they do not establish macOS or all-Windows-device support.

## Statistics and privacy

Results are engineering guidance, not official thresholds or live status. Segment baselines, truncated input, actively written logs and missing counts can affect completeness. A result is a reading snapshot, not an atomic live ledger. Names and projects depend on Codex local record formats and may require adaptation when those formats change.

Detailed reports and history can contain complete user input and local paths. They remain in `.local` and must not be published without review. ZIP files exclude private state. The service listens only on loopback and validates a random connection token. Exit does not stop other programs or Codex tasks. Preserve the analyzer’s integrity warnings; missing Token counts must not be treated as zero.

<!-- README-SOURCE-SHA256: 96ec6e12fde73376dcf84e7854a47956daa388799cccccc6194a4c40bae6c518 -->
