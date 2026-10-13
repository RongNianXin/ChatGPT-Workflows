<!-- README-SOURCE-SHA256: 08d00ee98e9ce261e92be876cc993fdecca8484093b92bb529becae24625528d -->

# EXT-004: REA

[中文](README.md)

## Purpose

REA (Reverse Engineer Anything) exposes software-artifact inspection, focused implementation tracing and analysis evidence through a CLI and MCP. Deep native analysis additionally uses a compatible Ghidra, Hopper or IDA installation. It does not automatically recover an original development project or clone a product.

## Current State

- Registration: `DOCUMENTED_ONLY`.
- Installation: `NOT_INSTALLED`. This registration did not install REA, register MCP, install its Skill or execute analysis; it does not establish readiness on other machines.
- Official source: <https://github.com/morluto/rea>; package: `rea-agents`.
- Source review: 2026-10-13; release tag `rea-agents-6.4.0` and the research-time main branch were checked. Main and a released package can differ despite an identical version string.
- AI-facing procedure: [调用指南.md](调用指南.md); evidence and maintenance: [安装与维护记录.md](安装与维护记录.md).

AI instances that have loaded the updated registry and common selection contract can discover and assess REA from the current goal. Registration is not installation, execution or proof that existing windows adopted it. No broadcast or remote publication was performed.

## Natural-Language Entry

Describe the goal rather than choosing technical parameters:

> I want to make a tower-defense game but do not know how to design it. Study relevant public material and what I provide, then help me create an original game design document. Decide whether REA is needed, select the methods and fill reliable parameters. Ask only about material gaps and explain operations outside current permissions first.

Game-design research normally starts with observable play, levels, feedback, economy and player decisions, not binary inspection. Consider REA when a specific implementation question needs an authorized, analyzable artifact. Missing REA does not block independent design research. If actual REA analysis is an explicit acceptance requirement, another method must not be reported as REA use.

Results should separate observed facts, inference, unknowns and proposed original design. They are not the target developer's internal design document. AI must retain actual invocation/result evidence for any claim of use and supply the minimum preparation scope when a dependency is missing.

## Selection and Boundaries

- Focused algorithms, file formats and client-module relationships can justify artifact inspection; general gameplay research often does not.
- JavaScript/Electron and managed metadata/CIL have static routes that do not always need a native engine. Managed inspection does not decode IL2CPP metadata; do not promise all Unity games or Unreal project recovery.
- The Windows native Ghidra route is experimental P0 with host, filesystem, format and dependency limits; see the [release documentation](https://github.com/morluto/rea/blob/rea-agents-6.4.0/docs/windows-ghidra-p0.md).
- Installation, static inspection, target execution, process attachment, traffic capture, device operations and disclosure of raw results require their respective permissions. Tool availability is not authority.
- Local analysis does not guarantee local-only data: an agent may send results to a cloud model. Review data scope and recipients first.
- Pseudocode and successful tool exits do not establish correct runtime behavior. Compiled artifacts can lose original names and structure; client files do not imply server-source access.
- MIT for REA grants no rights to target software/assets or commercial analyzers. Possession is not blanket authorization. Do not use it to bypass DRM, licensing, anti-cheat or unauthorized access controls.

Start with a controlled, authorized sample whose source can be used as a reference. CLI suits a bounded check; project-scoped MCP can support repeated investigation. A separate installation directory is not a security sandbox. Review isolation before executing an untrusted target.

## Sources

- [Official repository](https://github.com/morluto/rea)
- [Release CLI guide](https://github.com/morluto/rea/blob/rea-agents-6.4.0/docs/cli.md)
- [Installation and release boundaries](https://github.com/morluto/rea/blob/main/docs/installation.md)
- [Managed-code scope](https://github.com/morluto/rea/blob/main/docs/managed-code-analysis.md)
- [Responsible-use boundaries](https://github.com/morluto/rea/blob/main/DISCLAIMER.md)
