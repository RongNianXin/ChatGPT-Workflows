import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transformFile } from "./codex_session_sanitizer.mjs";
import { validateExplicitSessionLineage } from "./session_lineage_validator.mjs";

const root = await mkdtemp(join(tmpdir(), "codex-lineage-fixtures-"));
const ids = {
  parent: "00000000-0000-0000-0000-000000000001",
  childA: "00000000-0000-0000-0000-000000000002",
  childB: "00000000-0000-0000-0000-000000000003",
  grandchild: "00000000-0000-0000-0000-000000000004",
  archived: "00000000-0000-0000-0000-000000000005",
};

function meta(id, historyBase) {
  const payload = { id };
  if (historyBase) payload.history_base = historyBase;
  return { type: "session_meta", payload };
}

async function fixture(name, id, historyBase = null, extra = []) {
  const path = join(root, `${name}.jsonl`);
  const records = [meta(id, historyBase), ...extra];
  await writeFile(path, `${records.map(JSON.stringify).join("\n")}\n`, "utf8");
  return path;
}

try {
  const parent = await fixture("parent", ids.parent, null, [
    { type: "event_msg", payload: "base" },
  ]);
  const parentSize = Buffer.byteLength(await readFile(parent, "utf8"));
  const childA = await fixture("child-a", ids.childA, {
    thread_id: ids.parent,
    end_byte_offset: parentSize,
  });
  const childB = await fixture("child-b", ids.childB, {
    thread_id: ids.parent,
    end_byte_offset: parentSize,
  });
  const childASize = Buffer.byteLength(await readFile(childA, "utf8"));
  const grandchild = await fixture("grandchild", ids.grandchild, {
    thread_id: ids.childA,
    end_byte_offset: childASize,
  });
  const archived = await fixture("archived-parent", ids.archived);
  const archivedSize = Buffer.byteLength(await readFile(archived, "utf8"));
  const archivedChild = await fixture(
    "archived-child",
    "00000000-0000-0000-0000-000000000006",
    { thread_id: ids.archived, end_byte_offset: archivedSize },
  );

  assert.deepEqual(await validateExplicitSessionLineage([{ source: parent }]), {
    sessionCount: 1,
    referenceCount: 0,
  });
  assert.equal(
    (
      await validateExplicitSessionLineage([
        { source: parent },
        { source: childA },
        { source: childB },
        { source: grandchild },
      ])
    ).referenceCount,
    3,
  );
  assert.equal(
    (
      await validateExplicitSessionLineage([
        { source: archived },
        { source: archivedChild },
      ])
    ).referenceCount,
    1,
  );
  await assert.rejects(
    validateExplicitSessionLineage([{ source: archivedChild }]),
    /outside the supplied set/,
  );

  const badOffset = await fixture(
    "bad-offset",
    "00000000-0000-0000-0000-000000000007",
    { thread_id: ids.parent, end_byte_offset: parentSize + 1 },
  );
  await assert.rejects(
    validateExplicitSessionLineage([{ source: parent }, { source: badOffset }]),
    /past the source rollout/,
  );
  const fractionalOffset = await fixture(
    "fractional-offset",
    "00000000-0000-0000-0000-000000000008",
    { thread_id: ids.parent, end_byte_offset: 1.5 },
  );
  await assert.rejects(
    validateExplicitSessionLineage([{ source: parent }, { source: fractionalOffset }]),
    /Invalid history_base.end_byte_offset/,
  );

  const encryptedRecord = {
    type: "response_item",
    payload: { type: "reasoning", encrypted_content: "synthetic-ciphertext" },
  };
  const changedParentId = "00000000-0000-0000-0000-000000000009";
  const changedParent = await fixture("changed-parent", changedParentId, null, [
    encryptedRecord,
    { type: "event_msg", payload: "visible" },
  ]);
  const changedCutoff = Buffer.byteLength(await readFile(changedParent));
  const changedChild = await fixture(
    "changed-child",
    "00000000-0000-0000-0000-000000000010",
    { thread_id: changedParentId, end_byte_offset: changedCutoff },
  );
  const changedCandidate = join(root, "changed-parent-candidate.jsonl");
  await transformFile(changedParent, changedCandidate);
  await assert.rejects(
    validateExplicitSessionLineage([
      { source: changedParent, candidate: changedCandidate },
      { source: changedChild },
    ]),
    /past the candidate rollout|changes bytes before/,
  );

  const safeParentId = "00000000-0000-0000-0000-000000000011";
  const safeParent = await fixture("safe-parent", safeParentId, null, [
    { type: "event_msg", payload: "visible" },
  ]);
  const safeCutoff = Buffer.byteLength(await readFile(safeParent));
  await writeFile(
    safeParent,
    `${await readFile(safeParent, "utf8")}${JSON.stringify(encryptedRecord)}\n`,
    "utf8",
  );
  const safeChild = await fixture(
    "safe-child",
    "00000000-0000-0000-0000-000000000012",
    { thread_id: safeParentId, end_byte_offset: safeCutoff },
  );
  const safeCandidate = join(root, "safe-parent-candidate.jsonl");
  await transformFile(safeParent, safeCandidate);
  const repeatedInput = [
    { source: safeParent, candidate: safeCandidate },
    { source: safeChild },
  ];
  assert.deepEqual(
    await validateExplicitSessionLineage(repeatedInput),
    await validateExplicitSessionLineage(repeatedInput),
  );

  const restoredParent = join(root, "parent-restored.jsonl");
  const rollbackBackup = join(root, "rollback-parent-backup.jsonl");
  await copyFile(parent, restoredParent);
  await copyFile(parent, rollbackBackup);
  await writeFile(restoredParent, '{"type":"event_msg","payload":"broken"}\n', "utf8");
  await copyFile(rollbackBackup, restoredParent);
  assert.equal(
    (
      await validateExplicitSessionLineage([
        { source: restoredParent, taskId: ids.parent },
        { source: childA },
      ])
    ).referenceCount,
    1,
  );

  console.log("PASS: no-lineage, parent-child, multi-level, and multiple-child fixtures");
  console.log("PASS: cross-set, invalid, fractional, and out-of-range references fail closed");
  console.log("PASS: sanitizer changes before cutoffs fail; safe changes after cutoffs pass");
  console.log("PASS: repeated checks and restored originals pass");
} finally {
  await rm(root, { recursive: true, force: true });
}
