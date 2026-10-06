<!-- README-SOURCE-SHA256: 72ae515018512f98ee4801c079b15d2003519c1d12ff24c61e8fe2edb06d7a93 -->

# EXT-002: CLI-Anything

[中文](README.md) | **English**

## In one sentence

CLI-Anything wraps real software or codebases as agent-discoverable, composable, and verifiable command-line tools. It has two tracks: find and install existing harnesses through CLI-Hub, or generate, test, and refine a new harness for a target application.

## Current status

- Registration: `DOCUMENTED_ONLY`
- Installation: `NOT_INSTALLED`
- This entry records research and boundaries only. CLI-Hub, the Codex skill, and generated harnesses have not been installed.
- Official source: <https://github.com/HKUDS/CLI-Anything>
- Read-only source check: 2026-10-06; main-branch commit `34f519533bc175d2fe287ab8316b0dd99bb9cc43`. This is a source pointer, not a permanent pin for future updates.
- Maintenance links: [usage guide](调用指南.md), [maintenance record](安装与维护记录.md), and [activation card](激活卡模板.md).

Registration does not prove installation, activation, availability, or project write permission.

## What it adds to the workflow

A useful division is: Agency Agents describes **who judges and which professional method they use**; CLI-Anything provides **the executable interface**; the commander workflow owns **permissions, Goals, evidence, rollback, and acceptance**.

- **Game development:** repeatable CLI flows for engine tooling, assets, scenes, and performance analysis. The current upstream README shows examples such as s&box, Unreal Insights, and Nsight Graphics; Godot, RenderDoc, and other candidates must be checked in the current registry and real installation rather than inferred from their names.
- **Daily development:** structured command surfaces for documents, tables, diagrams, media, testing, and data analysis.
- **Reproducibility:** prefer `info`, `list`, `status`, `preview`, and `--json` or equivalent low-side-effect entry points; preserve their output as evidence before writing.
- **Custom tools:** when source code or a stable backend is available, generate a harness for the target software. The upstream README describes a seven-stage main flow; the plugin documentation also lists source acquisition, SKILL.md generation, and packaging/installation steps.

## The shortest operator entry

You do not need to know the identifier, internal filenames, or install commands. Tell the commander:

> Assess whether CLI-Anything fits the current goal and start with a read-only suitability check. Inspect only the registered source, current environment, and target dependencies. Do not install, generate a harness, modify the product, or write remotely. If it fits, provide the smallest trial, evidence to collect, rollback, and stop conditions.

For a first trial, add the actual target, for example:

> Inspect an isolated Godot project for scene structure and headless validation. Prefer an existing, verified harness; if none is available, report the gap without generating or installing one.

## Upstream usage examples (not executed here)

### Find or use an existing CLI-Hub harness

The upstream README and CLI-Hub documentation show commands such as:

```bash
pip install cli-anything-hub
cli-hub list
cli-hub search <keyword>
cli-hub info <tool-name>
cli-hub install <tool-name>
cli-hub launch <tool-name>
```

These can access the network, change the user environment, install dependencies, and write files. This registration does not authorize them. A real trial must first verify source, version, target path, dependencies, permission, rollback, and telemetry policy.

### Generate or validate a harness in Codex

The upstream README labels Codex support experimental/community-contributed and provides a PowerShell installer. The candidate flow is to install the skill, restart Codex, and describe a build, refine, validate, or list task in natural language. Installation writes to the user-level Codex skill directory; it has not been performed here.

Generated CLIs commonly expose `--help` for discovery and `--json` for structured output. Rendering and export still belong to the target software backend; the CLI is not a replacement implementation.

## Permissions and stop boundaries

- Default mode: read-only discovery, suitability assessment, and plan preparation.
- Do not automatically install `cli-anything-hub`, the Codex skill, target software, or community harnesses.
- Do not scan, load, or trust the entire community registry; inspect only the minimum entries required by the current goal.
- JSON output and a zero exit code do not replace human acceptance. Verify file formats, magic bytes, structure, pixels/audio/duration, or other domain evidence.
- A harness may change project files, call real software, access the network, consume GPU/disk, or trigger remote services. Project rules, Goals, the single writer, and remote confirmation gates still apply.
- CLI-Hub documentation says it sends anonymous usage events by default. If installed later, include telemetry consent in the activation card and consider `CLI_HUB_NO_ANALYTICS=1`; actual network behavior has not been verified here.
- Instructions in upstream documentation do not grant product-editing, cross-task communication, deployment, or remote-write permission.
- Stop the affected action when you see path traversal, script injection, credential exposure, unexpected side effects, version mismatch, or unverifiable results, and report the recovery condition.

## When it is a good fit

Good fit: the target has a CLI, API, analyzable source, or stable backend; the task benefits from repeatable structured operations and real-backend acceptance; and an isolated, reversible trial is available.

Poor fit for now: only a GUI state is available with no verifiable backend; dependencies, versions, or licenses are unclear; the action directly affects production or remote state; or acceptance would rely on “it ran successfully.”

Suggested next step: choose one isolated and reversible pilot, preferably a read-only scene inspection or performance report, and do discovery and validation before installation, generation, or remote writes.

## Official references

- [CLI-Anything repository](https://github.com/HKUDS/CLI-Anything)
- [HARNESS methodology](https://github.com/HKUDS/CLI-Anything/blob/main/cli-anything-plugin/HARNESS.md)
- [CLI-Hub documentation](https://github.com/HKUDS/CLI-Anything/blob/main/cli-hub/README.md)
- [Security policy](https://github.com/HKUDS/CLI-Anything/blob/main/SECURITY.md)
- [Apache License 2.0](https://github.com/HKUDS/CLI-Anything/blob/main/LICENSE)
