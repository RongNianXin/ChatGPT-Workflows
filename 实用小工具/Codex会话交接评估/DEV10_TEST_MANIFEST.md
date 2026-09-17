# dev.10 测试清单 / dev.10 test manifest

本文件定义 Windows SessionDesk `0.2.0-dev.10` 发布候选的唯一自动化模拟测试口径。总数是 **47 项命名检查**，不是“41 项交互检查加 10 组排序检查”的相加结果；排序、刷新和任务角色分组属于以下 47 项中的覆盖内容，不另行计数。

This file defines the single automated-simulation test count for the Windows SessionDesk `0.2.0-dev.10` release candidate. The total is **47 named checks**. Sorting, refresh, and task-role grouping are already covered below and are not counted again.

## 证据边界 / Evidence boundary

- 候选证据基线：`a99a6c8`；产品文件锁修复位于其父提交 `172dc4c`。
- 候选 ZIP SHA-256：`8C4D2E1C68A68C7B37A0F3977431704D99BA86A7A65AF5A018117D8EFC8BE0CC`，归档内有 10 个发布文件。
- 执行脚本：`.github/scripts/Test-WindowsSessionDesk.cjs`。脚本使用隔离虚构数据、无头 Edge 和 PowerShell 5.1；不读取真实会话，不安装产品依赖。
- 本轮结果：47/47 通过，`errors=[]`、`external=0`。另以非合成模式启动 ZIP，API 返回版本 `0.2.0-dev.10`、模式 `local-readonly`，并完成受控退出。
- 这些检查不代表所有电脑、系统环境、同步软件或真实会话均已测试。

The test harness uses isolated synthetic data, headless Edge, and PowerShell 5.1. It does not read real sessions or install product dependencies. The result above does not establish coverage for every machine, system environment, sync client, or real session.

## 47 项命名检查 / 47 named checks

| # | 检查项 / Check |
| --- | --- |
| 1 | PowerShell 5.1 startup and schema migration |
| 2 | exact pre-migration backup retained |
| 3 | token and origin restrictions |
| 4 | single writer; repeated launch keeps existing service identity |
| 5 | ID-only input without redundant reset button |
| 6 | 20 saved tasks; duplicates and manual metadata editing rejected |
| 7 | side-by-side sort and refresh; empty selection preserved; refresh concurrency capped at two with context-changing controls disabled |
| 8 | name and explicit project assignment auto-resolved |
| 9 | search detected metadata |
| 10 | running query deduplication and language guard |
| 11 | rename during query reflected in list and output |
| 12 | live title and project refresh updates open report without reanalysis |
| 13 | metadata overlay leaves statistics unchanged |
| 14 | task result association and visible handoff recommendation derived from analyzer score |
| 15 | English report toggle, preserved text, divider and accessible state |
| 16 | Chinese close and reopen detailed report |
| 17 | language round-trip retains both tasks, cached report, and aligned selection |
| 18 | refresh preserves selected task and successful caches while isolating failed tasks |
| 19 | raw English result equals direct analyzer |
| 20 | missing logs clear old result and report |
| 21 | view result disabled for missing cache, running and failed queries |
| 22 | persistent arrow order, stable full-list grouping, idempotence and invalid action protection |
| 23 | Chinese and English sort and refresh help |
| 24 | corrupt desktop metadata marks last-known project unavailable |
| 25 | truncated matching index record does not claim fresh name |
| 26 | synthetic isolation and path injection restrictions |
| 27 | page reload restores both language snapshots without requery |
| 28 | second warning line: 8/10 renders required tier, slider and ticks with an unobscured tooltip and no context prompt |
| 29 | bilingual top exit tooltip without redundant notice |
| 30 | bilingual source fingerprint |
| 31 | service restart restores state; legacy snapshots without recommendation remain compatible and unmarked |
| 32 | failed manual refresh retains latest successful handoff marker; newer continue result clears it |
| 33 | missing analyzer metadata persists an unknown recommendation that remains readable and unmarked after restart |
| 34 | corrupt snapshot isolation and history path restriction |
| 35 | changed source mode rejects old history |
| 36 | real-mode branch honors explicit synthetic `CODEX_HOME` |
| 37 | desktop columns align with details closed and open |
| 38 | moved task stays selected across repeated moves and metadata polling |
| 39 | narrow viewport without horizontal overflow |
| 40 | original unchanged, zero page errors, zero external requests |
| 41 | UI shutdown stops service and prominently permits closing page |
| 42 | UI exit then relaunch restores last successful result |
| 43 | snapshot write failure is visible and does not claim durable success |
| 44 | exit during slow synthetic query stops only owned query children |
| 45 | interrupted refresh preserves previous successful history across exit |
| 46 | project commander and specialist pairing through API persist across service restart |
| 47 | scoring bands 0-2 continue, 3-7 recommended, 8-10 required through the analyzer source |

## 复跑要求 / Rerun requirements

发布前必须对这个精确 SHA-256 的 ZIP 做全新短路径、非同步目录解压；测试脚本必须与候选基线一致。结果文件中的数量必须为 47，且 `errors` 为空、`external` 为 0。任何 ZIP、脚本、运行时或存储位置变化都会使本轮结果失效，需重新运行。

Before release, extract this exact ZIP into a fresh short non-synced directory and use a test script matching the candidate baseline. The result must contain count 47, empty `errors`, and `external` 0. A change to the ZIP, script, runtime, or storage location invalidates this result and requires a rerun.
