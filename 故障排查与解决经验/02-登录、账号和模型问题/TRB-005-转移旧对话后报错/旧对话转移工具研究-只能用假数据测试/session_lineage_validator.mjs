import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const SESSION_FILE_PATTERN =
  /^rollout-.*-([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\.jsonl$/i;

function fail(message) {
  throw new Error(message);
}

function collectHistoryBases(value, output) {
  if (Array.isArray(value)) {
    for (const item of value) collectHistoryBases(item, output);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (key === "history_base") output.push(nested);
    collectHistoryBases(nested, output);
  }
}

function taskIdFromRecords(path, records) {
  for (const record of records) {
    if (record?.type === "session_meta" && typeof record?.payload?.id === "string") {
      return record.payload.id;
    }
  }
  return basename(path).match(SESSION_FILE_PATTERN)?.[1] ?? null;
}

function parseJsonl(buffer, label) {
  const text = buffer.toString("utf8");
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, index) => {
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (line.length === 0) fail(`${label}: blank JSONL line at ${index + 1}`);
    try {
      return JSON.parse(line);
    } catch (error) {
      fail(`${label}: invalid JSON at line ${index + 1}: ${error.message}`);
    }
  });
}

export async function inspectExplicitSessionFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    fail("Lineage validation requires an explicit, non-empty file list");
  }
  const sessions = [];
  for (const file of files) {
    if (!file || typeof file.source !== "string") fail("Every lineage entry needs a source path");
    const sourceBytes = await readFile(file.source);
    const sourceRecords = parseJsonl(sourceBytes, file.source);
    const candidateBytes = file.candidate ? await readFile(file.candidate) : sourceBytes;
    const candidateRecords = file.candidate
      ? parseJsonl(candidateBytes, file.candidate)
      : sourceRecords;
    const taskId = file.taskId ?? taskIdFromRecords(file.source, sourceRecords);
    if (typeof taskId !== "string" || taskId.length === 0) {
      fail(`Cannot determine task ID for ${file.source}`);
    }
    const historyBases = [];
    for (const record of candidateRecords) collectHistoryBases(record, historyBases);
    sessions.push({
      taskId,
      source: file.source,
      candidate: file.candidate ?? null,
      sourceBytes,
      candidateBytes,
      historyBases,
    });
  }
  return sessions;
}

export async function validateExplicitSessionLineage(files) {
  const sessions = await inspectExplicitSessionFiles(files);
  const byTaskId = new Map();
  for (const session of sessions) {
    if (byTaskId.has(session.taskId)) fail(`Duplicate task ID in supplied set: ${session.taskId}`);
    byTaskId.set(session.taskId, session);
  }

  let referenceCount = 0;
  for (const child of sessions) {
    for (const historyBase of child.historyBases) {
      referenceCount += 1;
      if (historyBase === null || typeof historyBase !== "object") {
        fail(`Invalid history_base in ${child.taskId}`);
      }
      const { thread_id: parentId, end_byte_offset: offset } = historyBase;
      if (typeof parentId !== "string" || parentId.length === 0) {
        fail(`Invalid history_base.thread_id in ${child.taskId}`);
      }
      if (!Number.isSafeInteger(offset) || offset < 0) {
        fail(`Invalid history_base.end_byte_offset in ${child.taskId}`);
      }
      const parent = byTaskId.get(parentId);
      if (!parent) {
        fail(`Referenced parent is outside the supplied set: ${parentId}`);
      }
      if (offset > parent.sourceBytes.length) {
        fail(`History cutoff is past the source rollout: ${parentId}`);
      }
      if (offset > parent.candidateBytes.length) {
        fail(`History cutoff is past the candidate rollout: ${parentId}`);
      }
      if (
        !parent.sourceBytes.subarray(0, offset).equals(parent.candidateBytes.subarray(0, offset))
      ) {
        fail(`Candidate changes bytes before a referenced history cutoff: ${parentId}`);
      }
    }
  }

  return { sessionCount: sessions.length, referenceCount };
}
