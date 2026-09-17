# Codex session handoff assessment

[简体中文](README.md)

Save frequently used task IDs and query local Codex turns, file size, compaction and handoff guidance with one click. **Recommended download: Windows desk 0.2.0-dev.9; the repository contains the unreleased 0.2.0-dev.10 source candidate.** No commands are required for everyday use. Source sessions are read-only; data is not uploaded.

## Download and start

1. [Download the standalone Windows ZIP](https://github.com/RongNianXin/ChatGPT-Workflows/releases/download/windows-sessiondesk-v0.2.0-dev.9/Windows-SessionDesk-0.2.0-dev.9.zip), extract it completely, and double-click the root `Start-SessionDesk.cmd`. You do not need to clone the repository. Do not open the HTML by itself.
2. If you cloned the repository, double-click [Start-SessionDesk.cmd](Start-SessionDesk.cmd). Repository source may be newer than the download; use the version displayed at the top of the page.
3. Save a task ID. Query / Refresh updates that task, while Refresh all updates the complete list. The conversation name and local project are detected automatically. Basic and detailed reports have separate areas, with Simplified Chinese and English available.

Uses built-in Windows PowerShell 5.1 and a browser. Windows Edge is tested; macOS and other browsers are not. This remains a development preview, without a claim of comprehensive device or very-large-log compatibility.

`windows-local` contains the application, not temporary files. Use the launcher in this directory. Personal tasks and history stay in its `.local` folder and are excluded from distribution.

## Everyday use

- No fixed saved-task count limit; regression covers 20 tasks. Search, arrow ordering and Sort all are available, with order saved to disk. Refresh all runs at most two queries concurrently and restores the previous selection; an empty selection stays empty.
- A task whose latest successful result reaches the analyzer's handoff threshold has a pale-yellow row, orange edge and text label. This is a query snapshot, not live state. Legacy snapshots without the recommendation field keep the ordinary style.
- Each task retains its latest successful basic output and detailed report per language. Reopening shows the original query time and a historical-snapshot notice; statistics update only on a new query.
- **Closing the page does not stop the background service.** Select Exit tool at the top of the page when finished to stop this tool and its unfinished queries, without stopping Codex conversations. Bilingual hover help explains the button. Close the page after the prominent exit confirmation and use the launcher to restore saved tasks and results.
- An interrupted or failed refresh does not turn old history into a new success. Previously saved history remains available after reopening. A visible result does not mean the AI is currently running.

## Score and slider

Each task card has a 0–10 handoff reference score: file size contributes 0–5 points at 30, 50, 100, 200 and 400 MiB; automatic compaction contributes 0–5 points at 4, 7, 10, 15 and 20 events. Scores 0–2 mean continue for now, 3–7 show **Handoff recommended**, and 8–10 (including 8) show **Handoff required**. These are local heuristics, not official OpenAI limits.

Scored task cards show a static 10-segment slider with subtle ticks at 3 and 8. Hovering or keyboard-focusing it shows the current score and level. Recent context-window usage is not included in the total and does not create a handoff reminder on task cards; the terminal and report retain the metric for diagnosis. Legacy snapshots without score fields show **No score data**, never a false zero.

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

<!-- README-SOURCE-SHA256: a4caa8c6315cc467e21a96fe33d7eaa58589dcb1c1795ea0006bc4287b0aaf24 -->
