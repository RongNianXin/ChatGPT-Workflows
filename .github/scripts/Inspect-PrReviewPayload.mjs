import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Inspect one actual GitHub create-review payload. Never send, edit or save it.
// Structural acceptance is not a decision about findings or authorization.
export function inspectPrReviewPayload(payload, { allowInline = false, inlineReason = '' } = {}) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 'FAIL', errors: ['INVALID_PAYLOAD'], remote_actions_performed: 0 };
  }
  if (typeof payload.commit_id !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(payload.commit_id)) errors.push('EXPLICIT_HEAD_REQUIRED');
  if (!['COMMENT', 'REQUEST_CHANGES', 'APPROVE'].includes(payload.event)) errors.push('FINAL_EVENT_REQUIRED');
  if (typeof payload.body !== 'string' || !payload.body.trim()) errors.push('COMPLETE_BODY_REQUIRED');
  const comments = payload.comments === undefined ? [] : payload.comments;
  if (!Array.isArray(comments)) errors.push('INVALID_COMMENTS');
  else {
    if (comments.length && (allowInline !== true || typeof inlineReason !== 'string' || !inlineReason.trim())) {
      errors.push('FRAGMENTED_REVIEW_REQUIRES_EXPLICIT_EXCEPTION');
    }
    for (const comment of comments) {
      if (!comment || typeof comment !== 'object' || Array.isArray(comment) ||
          typeof comment.body !== 'string' || !comment.body.trim() ||
          typeof comment.path !== 'string' || !comment.path.trim()) {
        errors.push('INVALID_INLINE_COMMENT');
        break;
      }
    }
  }
  return {
    status: errors.length ? 'FAIL' : 'PASS', errors,
    review_submissions: 1,
    inline_comments: Array.isArray(comments) ? comments.length : null,
    delivery_mode: Array.isArray(comments) && comments.length ? 'INLINE_EXCEPTION' : 'SINGLE_BODY',
    requires_semantic_and_authorization_review: true,
    remote_actions_performed: 0
  };
}

function main(args) {
  let payloadPath, allowInline = false, inlineReason = '';
  const seen = new Set();
  for (const arg of args) {
    const key = arg.split('=')[0];
    if (seen.has(key)) throw new Error('DUPLICATE_ARGUMENT');
    seen.add(key);
    if (arg.startsWith('--payload=')) payloadPath = arg.slice('--payload='.length);
    else if (arg === '--allow-inline') allowInline = true;
    else if (arg.startsWith('--inline-reason=')) inlineReason = arg.slice('--inline-reason='.length);
    else throw new Error('UNKNOWN_ARGUMENT');
  }
  if (!payloadPath) throw new Error('PAYLOAD_PATH_REQUIRED');
  if (!allowInline && inlineReason) throw new Error('INLINE_REASON_WITHOUT_EXCEPTION');
  const result = inspectPrReviewPayload(JSON.parse(fs.readFileSync(payloadPath, 'utf8').replace(/^\uFEFF/, '')), { allowInline, inlineReason });
  console.log(JSON.stringify(result));
  process.exitCode = result.status === 'PASS' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    // Do not print supplied bodies, paths, credentials or parser excerpts.
    const known = ['DUPLICATE_ARGUMENT', 'UNKNOWN_ARGUMENT', 'PAYLOAD_PATH_REQUIRED', 'INLINE_REASON_WITHOUT_EXCEPTION'];
    console.log(JSON.stringify({ status: 'FAIL', errors: [known.includes(error.message) ? error.message : 'PAYLOAD_READ_OR_PARSE_FAILED'], remote_actions_performed: 0 }));
    process.exitCode = 1;
  }
}
