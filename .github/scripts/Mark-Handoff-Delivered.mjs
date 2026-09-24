import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const safe = value => typeof value === 'string' && /^[A-Za-z0-9._:-]+$/.test(value);

export function markDelivered(receiptPath, recipient, deliveryEventId, outputPath = `${receiptPath}.delivery.json`) {
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  if (receipt.schema_version !== 1 || receipt.artifact_status !== 'GENERATED_NOT_DELIVERED') throw new Error('receipt must be a schema v1 GENERATED_NOT_DELIVERED record');
  if (!safe(recipient) || !safe(deliveryEventId)) throw new Error('recipient and delivery event id must be portable logical ids');
  if (!/^[0-9a-f]{64}$/.test(receipt.snapshot_sha256 || '') || !/^[0-9a-f]{64}$/.test(receipt.seal_digest || '') || !/^[0-9a-f]{64}$/.test(receipt.rule_manifest_sha256 || '')) throw new Error('receipt has invalid integrity fields');
  if (typeof receipt.snapshot_file !== 'string' || path.basename(receipt.snapshot_file) !== receipt.snapshot_file) throw new Error('receipt snapshot_file must be a basename next to the receipt');
  const snapshotPath = path.join(path.dirname(receiptPath), receipt.snapshot_file);
  if (!fs.existsSync(snapshotPath) || !fs.statSync(snapshotPath).isFile()) throw new Error(`handoff artifact is missing: ${snapshotPath}`);
  if (sha256(fs.readFileSync(snapshotPath)) !== receipt.snapshot_sha256) throw new Error('handoff artifact hash does not match the receipt');
  const record = {
    schema_version: 1,
    artifact_status: 'DELIVERED',
    snapshot_id: receipt.snapshot_id,
    snapshot_file: receipt.snapshot_file,
    snapshot_sha256: receipt.snapshot_sha256,
    seal_digest: receipt.seal_digest,
    fact_cutoff: receipt.fact_cutoff,
    event_id: receipt.event_id,
    rule_manifest_sha256: receipt.rule_manifest_sha256,
    delivery_event_id: deliveryEventId,
    delivered_to: recipient,
    delivered_at: new Date().toISOString(),
    source_receipt_sha256: sha256(fs.readFileSync(receiptPath))
  };
  if (fs.existsSync(outputPath)) throw new Error(`refusing to overwrite existing delivery record: ${outputPath}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  fs.linkSync(tempPath, outputPath);
  fs.unlinkSync(tempPath);
  return record;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.length < 5 || process.argv.length > 6) { console.error('usage: node Mark-Handoff-Delivered.mjs <receipt-json> <recipient-id> <delivery-event-id> [output-json]'); process.exitCode = 2; }
  else {
    try { console.log(JSON.stringify(markDelivered(process.argv[2], process.argv[3], process.argv[4], process.argv[5]), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
