import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { markDelivered } from './Mark-Handoff-Delivered.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mark-handoff-delivered-'));
const receiptPath = path.join(root, 'receipt.json');
const artifactPath = path.join(root, 'handoff.md');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const artifact = Buffer.from('# handoff\n', 'utf8');
const digest = 'a'.repeat(64);
fs.writeFileSync(artifactPath, artifact);
fs.writeFileSync(receiptPath, `${JSON.stringify({
  schema_version: 1,
  artifact_status: 'GENERATED_NOT_DELIVERED',
  snapshot_id: 'sample-project-commander-handoff-20260924-final-1',
  snapshot_file: 'handoff.md',
  snapshot_sha256: sha256(artifact),
  seal_digest: digest,
  fact_cutoff: '2026-09-24T00:00:00.000Z',
  event_id: 'event-1',
  rule_manifest_sha256: digest
}, null, 2)}\n`, 'utf8');

const deliveredPath = `${receiptPath}.delivery.json`;
const delivered = markDelivered(receiptPath, 'sample-project-commander-31', 'delivery-1', deliveredPath);
assert.equal(delivered.artifact_status, 'DELIVERED');
assert.equal(delivered.delivered_to, 'sample-project-commander-31');
assert.equal(JSON.parse(fs.readFileSync(deliveredPath, 'utf8')).source_receipt_sha256, sha256(fs.readFileSync(receiptPath)));
assert.throws(() => markDelivered(receiptPath, 'sample-project-commander-31', 'delivery-2', deliveredPath), /refusing to overwrite/);

fs.writeFileSync(artifactPath, Buffer.from('# tampered\n', 'utf8'));
assert.throws(() => markDelivered(receiptPath, 'sample-project-commander-31', 'delivery-3', `${receiptPath}.tampered.json`), /artifact hash/);
console.log('Mark handoff delivered: PASS (3 cases)');
