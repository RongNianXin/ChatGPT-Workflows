# SYS-TRB-014: Handoff Candidate Source Drift

## Symptom

After a commander creates and reads a handoff candidate, the outgoing window changes a control-plane file or another protected source. The receiving window then finds that the candidate digest no longer matches the live source and cannot take over directly. A source can also change after takeover, making the live source check fail.

## Confirmed cause

- `MATERIAL_PREPARED` proves only the source checkpoint used during generation.
- A source change after sealing, without a new same-generation proof, makes the old candidate stale; blocking takeover is correct.
- `TAKEOVER_COMPLETED` records a completed control transfer. A later source change is post-takeover drift; it must not revoke the completed event or revive the old commander.
- Cooperative locks, prompts, and rules cannot stop direct edits that bypass the formal entry point. They can only expose the change during digest, CAS, journal, or readback checks.

## Handling

1. After material preparation and readback, the outgoing commander enters `CLOSEOUT_ONLY` and only finishes already-started atomic steps that can be safely closed.
2. If a protected source must change, mark the old candidate stale under the existing invalidation semantics. Update and reconcile the source first, then append a same-generation `CURRENT_ATTESTATION` or build a new candidate.
3. If `latest_source_status=FAIL` after takeover, retain the completed event and new commander identity. Do not restore the old commander; pause only high-impact actions that depend on the current source.
4. Low-risk, source-independent read-only checks and records may continue. Before the next candidate freeze or high-impact proof, the current commander rechecks the live source.

## First takeover after migration

A settled `CURRENT_MIGRATION` is not a new receiver observation. The public path previously required hand-built observations, retained stale required-file hashes, and rejected an old completed journal merely because its completion belonged to the preserved legacy chain. Do not bypass digest checks to work around these gaps.

- Use `Rebase-Handoff-Draft.mjs` to create a fresh v4 `MATERIAL_PREPARED` receiver observation and pass it directly to `Recover-CommanderAuthority.mjs inspect`. Do not first use formal Prepare, ordinary Candidate Verify, or append on behalf of the stopped writer.
- Keep sealed source paths, owners, and digests unchanged. Reobserve current bytes only for non-source required files within the original path set, alongside current rules, remote, and strict workspace facts. External control roots remain separate and file-level drift diagnostics identify the affected path.
- Both migration entries retain the unverified historical-preservation restriction and reset business acceptance to `NOT_RUN`. Verified current facts do not certify past preservation.
- A prior completed journal can cross the migration boundary only after its original intent/completion verifies and the first new seal binds its exact digest, generation, and writer. Unrelated, tampered, or cross-identity journals remain rejected.
- Candidate CLI success requires an empty error list, even when the API status is restricted-ready. Never edit old seals or delete uncommitted work to bypass checks.

## Validation boundary

Handoff seal, transaction recovery, and workflow-contract regressions cover stale-candidate rejection and preservation of the completed event without reviving the old writer. They prove that formal entries expose drift; they do not prove host-level interception of every direct edit or universal compliance by every AI instance.

## Related entries

- `总指挥工作流/第二代总指挥的工作模式/04-状态、目标变更与交接规范.md`
- `总指挥工作流/第二代总指挥的工作模式/交接阶段矩阵.md`
- `.github/scripts/Test-Takeover-Handoff.mjs`
