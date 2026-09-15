<div align="center">

# ChatGPT Workflows

**Usage tips, workflows, troubleshooting notes, and local tools for ChatGPT on the web and Codex work in the ChatGPT desktop app.**

Connect natural-language goals, execution evidence, and resumable checkpoints, alongside ChatGPT web enhancements and local tools.

[简体中文](README.md) | **English**

[![Repository quality](https://github.com/RongNianXin/ChatGPT-Workflows/actions/workflows/repository-quality.yml/badge.svg)](https://github.com/RongNianXin/ChatGPT-Workflows/actions/workflows/repository-quality.yml)
[![Last commit](https://img.shields.io/github/last-commit/RongNianXin/ChatGPT-Workflows?label=last%20commit)](https://github.com/RongNianXin/ChatGPT-Workflows/commits/main)
![License: MIT](https://img.shields.io/badge/license-MIT-2F855A.svg)
![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D4.svg?logo=windows11&logoColor=white)

<br />

<img src="assets/repository-cover.png" alt="ChatGPT Workflows repository cover" width="100%" />

</div>

<p align="center">
  <strong><a href="SHOWCASE.md">View real-world previews / 查看真实运行效果</a></strong>
</p>

> [!NOTE]
> This is an independent community experiment. It is not affiliated with or endorsed by OpenAI.

> [!TIP]
> **Maintenance status: active.** New workflows, troubleshooting notes, and local tools are added after verification. See the [changelog](CHANGELOG.md) and commit history for the actual record.

## Why this repository exists

The public content currently falls into five groups: ChatGPT web enhancements, the Codex commander workflow, reusable prompts, troubleshooting and recovery notes, and local helper tools. It brings practical material that would otherwise be scattered across conversations into files that can be downloaded, inspected, tested, and reused.

Most of the repository is Markdown and PowerShell rather than a hosted service or opaque automation layer. Public files are designed not to contain local identities, real task IDs, credentials, or private prompts.

## What's new: evolving assessment, interface, and recovery capabilities

- **The session handoff evaluator keeps growing:** what began as task lookup and saving now includes a Windows desk, historical results and reports, handoff scoring, tiered reminders, and legacy-data compatibility. Its algorithm and visual style have both been revised.
- **More recovery and troubleshooting capability:** an archive-path repair tool was added, while cross-window handoff, automation-result association, long sessions, and client failures were organized into searchable troubleshooting material.
- **A more complete delivery surface:** offline Markdown reading, redacted real-run previews, a Chinese source of truth, and an English entry now let rules, tools, and showcase material evolve separately.
- **Tighter evidence boundaries:** handoff checks separate the Git baseline, uncommitted changes, dependencies and builds, runtime identity, and input acceptance; the rules also distinguish research notes from verified results.

This is a concise synthesis of the visible history and current files. See the [changelog](CHANGELOG.md) for exact status, unverified limits, and candidate roadmap items.

## Earlier improvements: evidence-backed simplification and reproducible delivery

Establish the current baseline before deciding what to simplify, how to verify it, and how to hand it over. This update strengthens four capabilities:

| Improvement | What it means for users |
| --- | --- |
| [Code simplification: scenario 2B (legacy 2G)](总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md#场景-2b保持功能不变精简现有代码) | Establish that code can safely be removed or consolidated, then demonstrate a practical benefit while meeting non-regression requirements. Fewer lines are not enough; a higher aggregate score cannot hide worse results on critical cases. Leaving code unchanged is valid when the benefit is insufficient. |
| [PR descriptions and delivery](总指挥工作流/第二代总指挥的工作模式/docs/PR_SUBMISSION_AND_REVIEW_STANDARD.md) | Explain why the change is needed, what changed, and which inputs, steps, and expected results verify it. Standard test commands remain useful but do not replace evidence specific to the change. |
| [Cross-machine reproduction and performance diagnosis](总指挥工作流/第二代总指挥的工作模式/docs/PIPELINE_DIAGNOSIS_AND_ALGORITHM_TUNING_STANDARD.md#跨机器效果与速度差异对照) | Check the actual code, configuration, models, inputs, and access to required resources. Separate output differences from timing differences, and verify the actual delivered result after merging rather than relying on “it works on my machine.” |
| [Natural-language entry](总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md#统一入口描述目标由-ai-核对场景) | Once the rule directory is registered, describe your goal without memorizing scenario numbers or fixed phrases. The AI selects the workflow using the goal, current state, and permissions. Publishing requests load delivery checks without forcing a PR when none is needed. |

Scene 2 is the ordinary target entry; 2B covers behavior-preserving code simplification, and Scene 5 covers execution with independent review. Legacy numbering remains only as compatibility aliases and grants no new authorization. These rules do not guarantee equal speed on arbitrary machines or correct execution by every AI; actual outcomes require verification, and team rules and authorization boundaries still take precedence. See the [change log (Chinese)](CHANGELOG.md). The linked detailed guides are currently in Chinese.

## What the commander workflow provides

Collaboration follows a clear path: state a goal, implement and verify, save a checkpoint, then resume delivery. You provide the goal and necessary decisions; the AI retrieves facts, prepares parameters, and checks results. Short instructions still lead to explicit validation requirements.

| Capability you can use | How the workflow supports it |
| --- | --- |
| Less repetitive work | A [single operator entry](总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md), with parameters retrieved or prefilled by the AI and necessary manual steps paired with expected results and failure feedback. |
| Results you can understand and inspect | [Diagnosis along the actual execution path](SHOWCASE.md), separating observations, inferences, and unverified claims. Generated output, automated tests, and professional acceptance are reported separately. |
| A clear place to resume after changing tasks | A [standard four-part handoff report](总指挥工作流/第二代总指挥的工作模式/总指挥轻量交接启动配置.md#7-统一接管汇报模板): identity, handoff result, checkpoint, and next steps with permissions. Switching requires a verified single writer. |
| Rules that can be updated and simplified | [On-demand review and retirement](总指挥工作流/第二代总指挥的工作模式/06-复盘与优化规则.md#按需时效核验与退役), triggered by use, upgrade signals, or relevant maintenance. Updates and retirement require evidence; no recurring scanner is created. |

Specific model names, prices, and reasoning levels are not permanent prerequisites. The [model policy](总指挥工作流/第二代总指挥的工作模式/05-模型选择与资源策略.md) keeps the user's selected configuration when it remains suitable and considers changes only when there is a practical benefit. These are reviewable workflow rules, not guarantees of outcomes or consistent compliance across models. Instructions that have not been used or triggered for review may still become outdated.

## Start here

| If you want to... | Open... |
| --- | --- |
| Improve the ChatGPT web experience | [ChatGPT-Web](ChatGPT-Web/README.en.md) |
| Use the commander workflow | [Operator manual (Chinese)](总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md) |
| Understand the rule architecture | [Workflow overview (Chinese)](总指挥工作流/第二代总指挥的工作模式/00-第二代工作流总览.md) |
| Troubleshoot Codex or CC Switch | [Troubleshooting notes](故障排查与解决经验/) |
| Reuse a focused prompt | [Prompt collection](其他%20Codex%20技巧性提示词/) |
| Try a local helper | [Local utilities](实用小工具/) |
| Save tasks and query Codex session snapshots (Windows dev.9) | [Session handoff assessment](实用小工具/Codex会话交接评估/README.en.md) |
| See real-world results | [Showcase](SHOWCASE.md) |

The detailed manuals are currently written in Chinese. This page is an evaluation and navigation guide for English-speaking visitors.

## Quick start

### Use the ChatGPT web userscripts

1. Open [ChatGPT-Web](ChatGPT-Web/README.en.md) and follow its instructions to install Tampermonkey.
2. Enable the browser permission that allows userscripts to run.
3. Install the script you need, refresh ChatGPT on the web, and verify the result.

### Use the Codex commander workflow

1. Download or clone this repository.
2. Open the [operator manual](总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md). The bundled Markdown reader exposes a left sidebar tree; expand Scene 1–6 and click a child scene to jump directly to its prompt.
3. In the project you actually want Codex to work on, start a new Codex task and adapt this instruction:

   ```text
   Use <SECOND_GENERATION_COMMANDER_RULES_DIRECTORY> as this project's commander workflow rules. Read 01-操作者操作手册.md first, then load the other rules required for my goal and begin.
   ```

Use the target project's workspace, not this repository's workspace, unless you are maintaining the workflow itself.

### A lightweight English entry

The detailed rules remain canonical in Chinese. Use the [English entry](总指挥工作流/第二代总指挥的工作模式/docs/ENGLISH_ENTRY.md) for stable orientation, terminology, and the minimum route into the workflow. It is intentionally not a full parallel translation; when a rule matters, re-check the current Chinese source.

## What is included

- [ChatGPT-Web](ChatGPT-Web/README.en.md): reviewable userscripts, installation steps, and browser-permission notes for ChatGPT on the web.
- [Second-generation commander workflow](总指挥工作流/第二代总指挥的工作模式/): task intake, authorization, delegation, validation, state recovery, and handoff for Codex work.
- [Prompt collection](其他%20Codex%20技巧性提示词/): reusable prompts for first-principles reviews, complex tasks, image work, automated testing, and text flowcharts.
- [Troubleshooting and recovery](故障排查与解决经验/): sanitized records and recovery tools for reproduced Codex Desktop and CC Switch issues.
- [Local utilities](实用小工具/): read-only or reversible helpers, including the Codex session handoff assessment.
- [Showcase](SHOWCASE.md): privacy-reviewed screenshots of real runs so visitors can see what the workflows and tools produce.

## ChatGPT and Codex naming boundary

The repository uses **ChatGPT Workflows** as its public umbrella title so visitors can enter through familiar ChatGPT use cases. **Codex** remains the accurate name for coding and local-project work, the CLI, session formats, and modules that only apply to Codex.

For that reason, product-specific directory names, script names, commands, and technical documentation are not renamed merely for branding consistency. The ChatGPT title also does not imply that every module runs in an ordinary web chat; each module README defines its audience, prerequisites, and limitations.

## Bilingual README contract

Every public directory that contains a tracked `README.md` also contains a `README.en.md`, with language links in both files. The Chinese page is the content source. The English page records a SHA-256 marker for the Chinese source, and the repository check scans every directory for missing pairs, broken language links, or an English page that has not been reviewed after its Chinese source changed.

This gate detects missing or stale pages; it cannot prove that a translation is semantically correct. Before committing, the maintainer must still compare the purpose, prerequisites, steps, commands, permissions, security boundaries, and limitations. Ambiguous product terms or behavior remain explicitly unverified.

## Optional local operator collaboration profile

The profile helps Codex remember verified technical preferences, current familiarity, effective collaboration patterns, and recurring operational mistakes. Its purpose is to reduce repeated explanations and add timely safeguards—not to build an identity file or infer permissions.

It is off by default. When a commander is first established for a project, Codex introduces it once after answering the main request. Only an explicit opt-in enables it; declining or ignoring the question keeps it off and suppresses repeated prompts in that project. When enabled, it performs a local review only at a stable major milestone, before a commander handoff, when the same collaboration issue recurs, or on request. It creates no scheduled job or background monitor.

Natural-language controls:

- Enable: `开启本地操作者协作画像`
- Pause or resume: `暂停本地操作者协作画像` / `继续本地操作者协作画像`
- Disable: `关闭本地操作者协作画像`
- Disable and delete local data: `关闭并删除本地操作者协作画像`
- Check safety status only: `查看本地操作者协作画像状态`

The privacy claims are auditable: the real profile stays in an exact `.gitignore`-excluded local path and must also be verified as untracked; it excludes identity, contact details, real projects, local paths, chat transcripts, sensitive attributes, and personality judgements; handoffs carry only state and a generic pointer, never the profile body or content hash; the active set is capped at 20 entries with expiry and supersession rules. Any derived public copy requires Codex to show the final sanitized payload first, followed by a second precise approval in a separate user message. `.gitignore` is not encryption or operating-system access control, so highly sensitive material still does not belong in the profile. See the [operator profile specification (Chinese)](总指挥工作流/第二代总指挥的工作模式/11-操作者协作画像规范.md). Deleting that public specification is not an off switch and does not delete local data.

## Current scope and limitations

- Userscripts and usage notes for ChatGPT on the web are included.
- Codex coverage includes desktop and local-project workflows, handoffs, validation, troubleshooting, and recovery.
- Tools and reproduced tests are currently Windows-first, and the detailed rule manuals are primarily in Chinese.
- It is a personal project, not an official standard or a guarantee of professional, legal, security, or business acceptance.
- Product behavior and third-party tooling can change; re-check time-sensitive instructions before relying on them.

## License

Released under the [MIT License](LICENSE).

## Community

This project acknowledges the [LINUX DO](https://linux.do/) community and supports sincere, friendly knowledge sharing and exchange.

<!-- README-SOURCE-SHA256: 7c4186b4a0f5064e9d260abc2734eaed431e052b3c707ae705b2013614ad02a1 -->
