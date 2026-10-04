<!-- README-SOURCE-SHA256: dbb0ef132785c2ac447d13caa04787e8724a6601813378cdfb767591a7cb736d -->

# EXT-001: Agency Agents entry

[中文](README.md)

This is the only operator-facing entry for `EXT-001`. The parent directory keeps the identifier and status; AI reads the other files in this folder only when a concrete setup, activation, or maintenance step requires them.

## What it does

Agency Agents is a set of optional professional role prompts. An existing AI can use one role, such as Game Designer or Test Engineer, to review material and find missing choices, feedback, failure states, or verification evidence. It is not a new chat mode, and it does not install itself, edit code, playtest, or publish anything.

## When to use it

Use it when you want a specialist perspective on the current project. You do not need to know `EXT-001`, choose a role, or remember an install command. Say:

> I am working on [project or feature]. Please decide whether Agency Agents is suitable now, choose the best role, check whether it is installed, and tell me the next step if it is not. If suitable, bind it to this task for a read-only review and explain the result plainly. Do not edit code or perform remote actions.

For a fixed copyable template:

> I am working on [project or feature]. Please decide whether Agency Agents is suitable now, choose the best role, check whether it is installed, and tell me the next step if it is not. If suitable, bind it to this task for a read-only review and explain the result plainly. Do not edit code or perform remote actions.

You do not need to append other prompts from the operator manual. AI combines workflow rules, project boundaries, role responsibilities, and the current goal internally.

You do not need to fill in installation commands, version fields, or an activation card. If the status is `DOCUMENTED_ONLY / NOT_INSTALLED`, the commander may judge suitability but must not claim that the role is available.

## Small example

For the first level of a game, say:

> Use a Game Designer perspective to review the player's choices, action feedback, and failure feedback.

Start with one role and a read-only review based on a saved baseline. Without real playtesting, the result cannot claim that player experience improved.

## Current status

- Agency Agents is not automatically installed in this repository and no role is silently loaded.
- The central commander maintains source, version, installation, and updates; the project commander decides whether to use a role.
- AI reads the internal guides only when setup, activation, cross-project routing, personalization, or maintenance is actually needed.
