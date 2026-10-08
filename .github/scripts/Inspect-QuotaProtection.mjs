import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const percent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const clock = value => Number.isSafeInteger(value) && value > 0;
const key = value => typeof value === 'string' && value.length > 0 && value === value.trim();
const near = (a, b) => Math.abs(a - b) <= 1;
const precision = value => Number(value.toFixed(9));

// accountKey is a private opaque binding checked against the actual account by the caller.
// No sampling, network, file output, authorization or platform state changes occur here.
export function normalizeQuotaObservation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !key(input.accountKey) || !key(input.limitId) || !clock(input.windowDurationMins) ||
      !clock(input.resetsAt) || !clock(input.observedAt)) return { valid: false, reason: 'INVALID_OBSERVATION' };
  const hasUsed = input.usedPercent !== undefined;
  const hasRemaining = input.remainingPercent !== undefined;
  if ((!hasUsed && !hasRemaining) || (hasUsed && !percent(input.usedPercent)) ||
      (hasRemaining && !percent(input.remainingPercent)) ||
      (hasUsed && hasRemaining && Math.abs(input.usedPercent + input.remainingPercent - 100) > 1e-9)) {
    return { valid: false, reason: 'INVALID_PERCENTAGE' };
  }
  const usedPercent = precision(hasUsed ? input.usedPercent : 100 - input.remainingPercent);
  return { valid: true, observation: {
    accountKey: input.accountKey, limitId: input.limitId, windowDurationMins: input.windowDurationMins,
    resetsAt: input.resetsAt, observedAt: input.observedAt, usedPercent, remainingPercent: precision(100 - usedPercent)
  } };
}

const sameBinding = (a, b) => a.accountKey === b.accountKey && a.limitId === b.limitId && a.windowDurationMins === b.windowDurationMins;
const sameSample = (a, b) => sameBinding(a, b) && a.resetsAt === b.resetsAt &&
  a.observedAt === b.observedAt && a.usedPercent === b.usedPercent;

export function evaluateQuotaProtection(input = {}) {
  const invalid = reason => ({ decision: 'UNKNOWN', reasonCodes: [reason], usage: null, nextState: null });
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (input.ignoreUnknown !== undefined && typeof input.ignoreUnknown !== 'boolean') ||
      (input.initialize !== undefined && typeof input.initialize !== 'boolean')) return invalid('INVALID_INPUT');
  const normalized = normalizeQuotaObservation(input.current);
  const current = normalized.observation;
  let state;
  if (input.initialize === true) {
    if (input.state !== undefined) return invalid('INITIALIZATION_WITH_EXISTING_STATE');
    if (!normalized.valid) return invalid(normalized.reason);
    if (current.observedAt >= current.resetsAt) return invalid('STALE_RESET_AT_INITIALIZATION');
    if (input.budget !== undefined && (!input.budget || typeof input.budget !== 'object' || Array.isArray(input.budget))) return invalid('INVALID_BUDGET');
    const reserve = input.budget?.reserve === undefined ? 5 : input.budget.reserve;
    const limit = input.budget?.limit === undefined ? Math.max(0, Math.min(20, current.remainingPercent - reserve)) : input.budget.limit;
    if (!percent(reserve) || !percent(limit)) return invalid('INVALID_BUDGET');
    state = { limit: precision(limit), reserve: precision(reserve), knownConsumed: 0, historyComplete: true,
      previous: current, resetAnchor: current.resetsAt };
  } else {
    if (input.budget !== undefined) return invalid('CONTINUATION_CANNOT_CHANGE_BUDGET');
    const s = input.state;
    const previous = normalizeQuotaObservation(s?.previous);
    if (!s || !percent(s.limit) || !percent(s.reserve) ||
        typeof s.knownConsumed !== 'number' || !Number.isFinite(s.knownConsumed) || s.knownConsumed < 0 ||
        typeof s.historyComplete !== 'boolean' || !clock(s.resetAnchor) ||
        !previous.valid || !near(s.resetAnchor, previous.observation.resetsAt)) return invalid('INVALID_OR_MISSING_STATE');
    state = { limit: precision(s.limit), reserve: precision(s.reserve), knownConsumed: precision(s.knownConsumed),
      historyComplete: s.historyComplete, previous: previous.observation, resetAnchor: s.resetAnchor };
  }
  let segmentDelta = 0;
  const reasons = [];
  const markUnknown = reason => { state.historyComplete = false; segmentDelta = null; reasons.push(reason); };
  if (!normalized.valid) {
    markUnknown(normalized.reason);
  } else if (input.initialize !== true) {
    const previous = state.previous;
    if (!sameBinding(previous, current)) {
      markUnknown('ACCOUNT_POOL_OR_WINDOW_CHANGED');
    } else if (sameSample(previous, current)) {
      // An already counted sample is idempotent, including after an unknown gap.
    } else if (current.observedAt <= previous.observedAt) {
      markUnknown('TIME_ORDER_OR_SAME_TIME_CONFLICT');
    } else {
      const earliestReset = Math.min(state.resetAnchor, previous.resetsAt, current.resetsAt);
      if (!near(state.resetAnchor, current.resetsAt) || previous.observedAt >= earliestReset || current.observedAt >= earliestReset ||
          current.usedPercent < previous.usedPercent) {
        markUnknown(!near(state.resetAnchor, current.resetsAt) ? 'RESET_CHANGED' :
          current.usedPercent < previous.usedPercent ? 'USED_DECREASED' : 'RESET_BOUNDARY_CROSSED');
        // Begin a new observable segment while preserving both the lower bound and the unknown gap.
        state.resetAnchor = current.resetsAt;
      } else {
        segmentDelta = precision(current.usedPercent - previous.usedPercent);
        state.knownConsumed = precision(state.knownConsumed + segmentDelta);
      }
      state.previous = current;
    }
  }
  const balanceKnown = normalized.valid && sameSample(state.previous, current) && current.observedAt < current.resetsAt;
  if (state.knownConsumed >= state.limit) reasons.push('TASK_LIMIT_REACHED');
  if (balanceKnown && current.remainingPercent <= state.reserve) reasons.push('RESERVE_REACHED');
  let decision;
  if (reasons.includes('TASK_LIMIT_REACHED') || reasons.includes('RESERVE_REACHED')) decision = 'STOP';
  else if (!state.historyComplete || !balanceKnown) decision = input.ignoreUnknown === true ? 'CONTINUE_WITH_RESTRICTIONS' : 'UNKNOWN';
  else decision = 'CONTINUE';
  if (!state.historyComplete && !reasons.length) reasons.push('HISTORICAL_GAP');
  return { decision, reasonCodes: reasons, usage: {
    usedPercent: balanceKnown ? current.usedPercent : null,
    remainingPercent: balanceKnown ? current.remainingPercent : null,
    knownConsumed: state.knownConsumed, segmentDelta, historyComplete: state.historyComplete,
    taskLimit: state.limit, reserve: state.reserve
  }, nextState: state };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (process.argv.length !== 2) throw new Error('INVALID_INPUT');
    const chunks = [], buffer = Buffer.alloc(8192);
    let size = 0, count;
    while ((count = fs.readSync(0, buffer, 0, buffer.length, null)) > 0) {
      size += count;
      if (size > 1024 * 1024) throw new Error('INVALID_INPUT');
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    const result = evaluateQuotaProtection(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write('INVALID_INPUT: expected a bounded JSON object on stdin; no input echoed.\n');
    process.exitCode = 1;
  }
}
