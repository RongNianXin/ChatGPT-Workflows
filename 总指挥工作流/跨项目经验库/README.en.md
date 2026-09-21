# Cross-Project Experience Library

[简体中文](README.md) | **English**

This library stores sanitized and reviewed commander-workflow lessons that are reusable across projects. Project-specific lessons stay in the project's own local knowledge store and must not be copied here directly.

## Rules

1. Read the [experience index](经验索引.md) first and load only entries relevant to the current task; an index hit does not grant read or execution authorization.
2. New lessons start in `候选/` and must not edit the public index directly. A candidate must state scope, prerequisites, counterexamples, evidence type, sanitization status, and invalidation conditions.
3. The currently registered sole maintainer updates the public index using version checks and atomic writes. On conflicts, expired leases, or unknown sources, stop public-index writes and retain the candidate for review.
4. Local commits, public-index approval, and remote Push/PR are separate actions. A local experience change does not automatically block other projects or grant remote publication authority.

## Contents

- [Experience index](经验索引.md): a short, on-demand index and status definitions.
- [Candidate template](经验候选模板.md): for commanders preparing sanitized candidates.
- `候选/`: independent candidates awaiting review; never place raw project material here.

<!-- README-SOURCE-SHA256: 4c9e6f88af22a4562d653cc5ad198dba34b75b4d7620187f40d84f45d398b95a -->
