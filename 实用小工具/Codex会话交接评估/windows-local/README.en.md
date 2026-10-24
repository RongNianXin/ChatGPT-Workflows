# Windows session query desk

[简体中文](README.md)

<!-- README-SOURCE-SHA256: dfdddc3877243dbc0c68a6f317a4ebebc62a68235a2da5b8e7bfc6ea46070635 -->

Version: `0.2.0-dev.10`. **Real local session queries are enabled.** Enter a task ID, save it, and query to view the original analyzer's statistics and report. Source sessions are read-only. No data is uploaded and no dependencies are installed.

Local source includes missing-result rendering and Chinese text encoding fixes; the published ZIP is unchanged. Reload the page for the renderer fix; restart only this tool to adopt backend/analyzer edits. No Codex logout or restart is needed.

## Usage

1. Extract the complete package to a short path and double-click the root `Start-SessionDesk.cmd`; in a checkout, use the launcher in this directory. Do not open HTML directly. Windows PowerShell 5.1 starts the background service and opens the default browser; Windows Edge was tested.
2. Enter the required task ID and save. Names and projects are no longer entered manually. There is no fixed task-count limit; regression covers 20 tasks, not very large lists. Duplicate IDs are rejected without replacing saved records.
3. Click Query / Refresh, then read the output or View detailed report. Only local log files matching that ID and passing session-identity checks are analyzed, across active and archived directories. Cloud tasks are not queried; missing local logs produce an explicit failure.
4. Search by project, name or ID, view existing results, or remove list entries. Each row displays project on the left, name on the right and ID below. Sort by project changes only the complete-list order; Refresh all updates every saved task in the current language.
5. Choose Simplified Chinese or English at the top. Prompts, statistics and reports switch together; names, projects, paths and log content are not translated. Switching is unavailable during a running query. Each task retains per-language results and reports in this page. Returning to an available language restores its original snapshot; a missing language queries only the selected task. Other tasks retain their results. Viewing a result in the other language shows a notice. Manual Query / Refresh clears both old language variants for that task, and a failure does not restore old success. Successful output and detailed reports are saved as local per-task, per-language snapshots and restored after page reload or service restart, with the original query time and a non-live notice.
6. Click Exit tool at the top when finished. A persistent reminder to its left reads “Closing this page leaves the service running. Click Exit tool to stop it.” Close the page after the prominent “You can now close this page” message appears. Closing the page alone does not stop the service; exiting does not delete saved tasks or results.

If you closed the page without exiting, double-click `Start-SessionDesk.cmd` in the same directory to reopen the existing service page, then click Exit tool. A file lock allows only one service per data directory. A repeated launch briefly creates a launcher process, opens the existing service page, and exits without leaving a second service running. Separate extracted copies or explicit `-Instance` values run independently and must be stopped separately. An idle service still uses memory and periodically checks query status; CPU use depends on actual work, so a running process does not necessarily mean sustained high CPU use. If reopening fails, provide the launcher directory and error message. Do not terminate PowerShell processes indiscriminately.

Share startup error text, not real logs. Do not change global execution policy or elevate privileges. Deep paths may cause file-not-found errors in legacy PowerShell; extract to a shorter path.

View result is enabled only for a successful cached result with output. It is disabled when no result is available, a query is running, or a failed query has no usable cache.

## List ordering

Sort by project retains the former Group by project algorithm. Projects stay in first-appearance order. Within each project, commanders come first, ordinary tasks retain their order, and paired specialist tasks follow. A title containing 总指挥 or the word Commander receives display priority only; this grants no authority. Pairs require matching topics and numbers, exactly one `【topic】专项审查者1号` and one `【topic】专项执行者1号`; square brackets are also accepted. Pairs follow first-appearance order and retain their internal order. Missing, duplicate or unrecognized roles remain ordinary tasks. Unresolved projects are not combined across tasks. Sorting applies to the complete list and starts no query.

Sort by handoff urgency uses existing valid scores: tasks scoring 3 or above come first in descending score order. Ties and all other tasks retain their relative order. Unknown, old-rule and changed-source results receive no priority. Both buttons apply to the full list and save its order without querying or performing a handoff; choose either as needed.

Refresh all queries the complete list with at most two tasks running concurrently. One failure does not stop the remaining tasks or overwrite that task's previous successful snapshot. The task selected before refresh remains selected afterward; an empty selection stays empty. Operations that could change list or query context are disabled during refresh.

Source results use `handoff-score-v6-traditional`, restoring file-size plus compaction-count scoring with the 0-10 scale, orange recommendation at three, red required tier at eight and ten fixed segments. Cards show the latest request input tokens; historical or failed-refresh results are labeled previous query input. Input, utilization and observed growth do not affect scoring, and future pressure is not forecast. Dynamic results remain historical until queried again. Traditional bands are not calibrated against handoff cost; three is not a proven token optimum, and 100,000/150,000 tokens is not a universal hard limit. See [Scoring and slider](../README.en.md#score-and-slider) for all bands, examples and source accounting.

Arrow moves retain selection and bring the moved task into view, without automatically regrouping. Desktop columns align at the bottom; narrow screens retain a vertical layout.

## Name and project synchronization

Conversation names come from the last valid matching entry in the local `session_index.jsonl`. Projects come from explicit task-to-local-project assignments and project names in `.codex-global-state.json`. The default source is `.codex` in the user profile; a configured `CODEX_HOME` takes precedence. Project names are never guessed from folders, log content or manual labels.

While visible, the page checks metadata—descriptive information such as names and projects—about every three seconds. Renaming does not rerun log analysis. After Codex saves a rename to disk, the list, result heading, output name field and open report's name field update together. Project-name case changes also update. Old names inside historical log content remain historical text; there is no global replacement. The original report on disk remains the query-time snapshot; page name/project fields use the latest available metadata, while statistics retain their original query time.

These are locally observed desktop formats, not a guaranteed stable public interface. Remote projects, unassigned tasks, missing files, corrupt or truncated records, and renames not yet saved by Codex may prevent fresh metadata. Existing labels are retained with an explicit unavailable/stale-information notice; new tasks show unavailable values. A last-known label is not confirmed current membership. The desk never writes back to Codex metadata files.

## Data and compatibility

Instance data lives in this directory's `.local/`, with `main` as the default instance:

- `main/tasks.json` stores IDs, last-known names/projects and language. Writes use atomic replacement; corrupt files are not cleared. New snapshots store the scoring version, level, 0-10 score, and independent input/window estimates and trend. Earlier versions are not reinterpreted. Only integer scores from zero through ten are accepted; levels are derived at three/eight, while invalid or missing scores remain unknown.
- Schema 1 and 2 lists are accepted. Schema 1 is copied exactly to `tasks.schema1.<random-id>.bak` before migration. Old manual labels are historical values until replaced by detected metadata. Manual metadata editing is removed.
- Before upgrading, stop the old service and copy its `.local` to the new package's `windows-local/.local`. Do not overwrite an existing new list. Independently retained backups may also be restored. To roll back, stop the service and restore the pre-migration backup; later additions are not automatically merged into that backup.
- `main/reports/` contains original analyzer reports and metadata. Reports may include complete user inputs from high-usage turns and local paths. They stay local; removing a task entry does not remove its reports.
- `main/runtime/` holds an analyzer runtime copy. Original source and algorithms are unchanged. `main/connection.json` holds the current service token and is removed on exit.

`.local` is private and must not be distributed in ZIPs, committed or published. Persistence uses disk, not browser storage. Service restart was tested, not operating-system reboot. Deleting the program directory also deletes its data; back up first.

## Execution boundaries

- Listens only on `127.0.0.1`, validating Host, Origin and a random token. Clients cannot supply scripts, commands or file paths.
- Only saved, well-formed IDs can be queried. Logs are filtered by ID and their session identity is checked. Codex logs and metadata remain read-only.
- One writer per data directory; at most two simultaneous queries, independent of list capacity. Repeated requests for a running task in the same language reuse its job. A 120-second timeout or service shutdown terminates only analyzer children started by this service.
- Queries clear old displays and bind results to a task and run identifier. Failed queries cannot open old reports. Metadata updates and statistical updates are separate; this is not a live AI execution monitor.
- Statistical policy is unchanged. The original script's integrity notices and known limits still apply. An active session can change while being read; output is a reading snapshot, not an atomically frozen live ledger.

## Maintenance, packaging and verification

UI text is centralized in `desk.html` under `messages`, with paired Chinese and English values. Chinese edits require English review and an updated `I18N-SOURCE-SHA256`. Service errors and documentation also require paired updates. The fingerprint detects Chinese changes but cannot replace semantic review.

With existing Node, Playwright and Edge:

```sh
node .github/scripts/Test-WindowsSessionDesk.cjs
```

Regression always uses isolated synthetic data. It covers ID-only entry, 20 saved tasks, duplicate rejection, migration backups, name/project changes, updates to an already-open report, unchanged statistics, bilingual behavior, stale-output clearing, truncated metadata, access restrictions, narrow screens and shutdown. The real-mode branch is tested with an explicitly synthetic `CODEX_HOME`, never the developer's real sessions.

Package with:

```powershell
pwsh -File .github/scripts/Build-WindowsSessionDesk.ps1
```

Before packaging, the script verifies entry paths, PIDs and connection tokens for old desk services under this checkout's tool and release directories, then requests graceful shutdown. If safe shutdown fails, packaging stops with instructions to click Exit tool in the old page. It never kills PowerShell processes indiscriminately. Exactly ten program/documentation files are packaged, excluding `.local`; existing packages are not overwritten. Old copies outside the checkout must be stopped manually in their own pages.

Automated regression uses isolated synthetic data. The operator reported successful manual use of dev.6; this does not establish independent statistical verification for all real logs. Users can query their own IDs and compare output with the original script. Share error text or redacted summaries, not raw reports. macOS, cloud/remote tasks, very large logs or lists, operating-system reboot and device-policy differences remain unverified.

## List order

Each task’s ↑ / ↓ moves it one position in the full list and saves the order to disk. “Move to top” moves a task to the first position in the full list and saves the order; it is disabled for the first item. The first item cannot move up, and the last cannot move down. The selected task has a pale blue background and border without shifting its content.

Project grouping, commander/specialist ordering and batch-refresh rules are defined under “List ordering” above. Manual moves do not automatically regroup the list.

See the context-observation and compatibility rules above.

This release adds synthetic regression for multi-task results and reports across language round trips, aligned name values, selection without shifting, arrow ordering across restart, stable and repeated grouping, invalid sort requests, and bilingual hover help.

## Report presentation

The add-task form contains only the task ID and Save task; the redundant reset button is removed. Basic and detailed reports have separate text areas and a divider. View detailed report changes to Close detailed report when expanded; click again to collapse it. Selecting a task, changing language, or starting a query collapses details to avoid showing a previous item. Collapsing does not delete page-cached results. Buttons and region headings follow the selected language.

## Query history and exit

Each task retains only its latest successful basic output and detailed report per language, in `.local/main/snapshots/`; this is not a multi-version archive. Manual Query / Refresh clears the current display; only a successful save replaces that language’s history. Failure or exit during a query preserves the previous successful history. Relaunch shows its original time and a history notice, never presenting it as a successful fresh query. Other language snapshots retain their own timestamps. Deleting a task clears its restorable snapshots; report files and atomic-replacement backups are not automatically deleted.

History remains strictly bound to the data directory and mode. A change to either, or a corrupt snapshot, makes only the affected history unavailable. An analyzer fingerprint change alone retains valid history with an explicit historical label and query time, without presenting it as a new-algorithm result. Each task snapshot is limited to 16 MiB. Oversized data or write failure displays a saving warning; that result may not survive relaunch. History may contain conversation text; it stays local and is excluded from ZIP packages.

Upgrading from dev.5 preserves saved tasks but cannot reconstruct basic output that the old version never saved. History starts with successful dev.6 queries. Preserve the entire `.local` directory during future upgrades. Exit/relaunch was verified with synthetic data; operating-system reboot and real-session analysis were not tested.

The Exit tool button has bilingual hover/focus help. The page explicitly states that closing a browser tab does not stop the background service. Exit stops only this tool and its unfinished queries, not Codex conversations; saved tasks and history are retained. The page remains as an exit notice and can be closed manually.
