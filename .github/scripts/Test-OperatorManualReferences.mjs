import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Stable semantic anchors belong to the manual. Display numbers belong to headings.
// This module never writes files. Only the authorized maintainer applies its projection.
const bindingPattern = /<!-- SCENARIO_REFS: (\{[^\n]*\}) -->/g;
const manualDigest = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
const machineComment = /<!--\s*SCENARIO_/i;
const stripManualMetadata = text => text
  .replace(/^[\t ]*<!-- SCENARIO_REFS: \{[^\r\n]*\} -->[\t ]*\r?\n/gm, '')
  .replace(/<!-- SCENARIO_HISTORY:(?:BEGIN|END) -->/g, '');

// Migration and projection return a pair. They never write the manual or sidecar.
export function externalizeOperatorManual(text) {
  const parsed = bindings(text), catalog = scenarioCatalog(text);
  if (parsed.errors.length || catalog.errors.length) throw new Error([...parsed.errors, ...catalog.errors].join('; '));
  const source = validateScenarioDocument(text, catalog, { manual: true });
  if (source.status !== 'PASS') throw new Error(source.errors.join('; '));
  const plain = stripManualMetadata(text), sections = [];
  for (let i = 0; i < parsed.result.length; i++) {
    const block = parsed.result[i], end = parsed.result[i + 1]?.index ?? text.length;
    const line = text.slice(0, block.index).split('\n').length;
    const preceding = [...catalog.byAnchor.values()].filter(item => item.line < line).at(-1);
    const history = [];
    const part = text.slice(block.end, end);
    for (const match of part.matchAll(/<!-- SCENARIO_HISTORY:BEGIN -->([^]*?)<!-- SCENARIO_HISTORY:END -->/g)) {
      history.push({
        before: stripManualMetadata(part.slice(0, match.index)).slice(-40),
        text: match[1],
        after: stripManualMetadata(part.slice(match.index + match[0].length)).slice(0, 40)
      });
    }
    sections.push({ anchor: preceding?.anchor ?? null, references: block.map, history });
  }
  const metadata = { schema_version: 1, document_ref: '01-操作者操作手册.md', manual_sha256: manualDigest(plain), sections };
  virtualOperatorManual(plain, metadata);
  return { text: plain, metadata };
}

function virtualOperatorManual(text, metadata, { verifyDigest = true } = {}) {
  if (machineComment.test(text)) throw new Error('operator manual contains machine inspection comments');
  const exact = (object, keys) => object && typeof object === 'object' && !Array.isArray(object) &&
    Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
  if (!exact(metadata, ['schema_version', 'document_ref', 'manual_sha256', 'sections']) ||
      metadata.schema_version !== 1 || metadata.document_ref !== '01-操作者操作手册.md' ||
      !/^[a-f0-9]{64}$/.test(metadata.manual_sha256) || !Array.isArray(metadata.sections)) throw new Error('invalid operator manual sidecar');
  if (verifyDigest && metadata.manual_sha256 !== manualDigest(text)) throw new Error('operator manual sidecar digest mismatch');
  const catalog = scenarioCatalog(text);
  if (catalog.errors.length) throw new Error(catalog.errors.join('; '));
  const offsets = [0]; for (const match of text.matchAll(/\n/g)) offsets.push(match.index + 1);
  const definitions = [...catalog.byAnchor.values()].map(item => ({ ...item, start: offsets[item.line - 1], end: offsets[item.line] ?? text.length }));
  const expected = new Set([null, ...catalog.byAnchor.keys()]), seen = new Set(), edits = [], historySpans = [];
  for (const section of metadata.sections) {
    if (!exact(section, ['anchor', 'references', 'history']) || !expected.has(section.anchor) || seen.has(section.anchor) ||
        !section.references || typeof section.references !== 'object' || Array.isArray(section.references) ||
        Object.values(section.references).some(value => typeof value !== 'string') || !Array.isArray(section.history)) throw new Error('missing, duplicate or malformed manual section binding');
    seen.add(section.anchor);
    const current = section.anchor === null ? { start: 0, end: offsets[1] ?? text.length } : definitions.find(item => item.anchor === section.anchor);
    const limit = definitions.find(item => item.start > current.start)?.start ?? text.length;
    edits.push({ start: current.end, end: current.end, value: `<!-- SCENARIO_REFS: ${JSON.stringify(section.references)} -->\n` });
    const content = text.slice(current.end, limit);
    for (const history of section.history) {
      if (!exact(history, ['before', 'text', 'after']) || typeof history.before !== 'string' || typeof history.after !== 'string' || typeof history.text !== 'string' || !history.text) throw new Error('invalid external history boundary');
      const quote = history.before + history.text + history.after, position = content.indexOf(quote);
      if (position < 0 || content.lastIndexOf(quote) !== position) throw new Error('external history boundary is missing or ambiguous');
      const start = current.end + position + history.before.length, end = start + history.text.length;
      if (historySpans.some(span => start < span.end && end > span.start)) throw new Error('external history boundaries overlap');
      historySpans.push({ start, end });
      edits.push({ start, end, value: `<!-- SCENARIO_HISTORY:BEGIN -->${history.text}<!-- SCENARIO_HISTORY:END -->` });
    }
  }
  if (seen.size !== expected.size || [...expected].some(anchor => !seen.has(anchor))) throw new Error('operator manual sidecar omits a scenario section');
  let virtual = text; for (const edit of edits.sort((a,b) => b.start - a.start)) virtual = virtual.slice(0, edit.start) + edit.value + virtual.slice(edit.end);
  return virtual;
}

export function validateOperatorManual(text, catalog, metadata) {
  try { return validateScenarioDocument(virtualOperatorManual(text, metadata), catalog, { manual: true }); }
  catch (error) { return { status: 'FAIL', errors: [error.message], references: 0 }; }
}

export function synchronizeOperatorManual(originalText, editedText, metadata) {
  // Validate the pre-edit pair first: a new body cannot self-certify an old binding.
  const originalCatalog = scenarioCatalog(originalText);
  const original = validateOperatorManual(originalText, originalCatalog, metadata);
  if (original.status !== 'PASS') throw new Error(original.errors.join('; '));
  const catalog = scenarioCatalog(editedText);
  const virtual = virtualOperatorManual(editedText, metadata, { verifyDigest: false });
  const pair = externalizeOperatorManual(synchronizeScenarioReferences(virtual, catalog, { manual: true }));
  const verified = validateOperatorManual(pair.text, scenarioCatalog(pair.text), pair.metadata);
  if (verified.status !== 'PASS') throw new Error(verified.errors.join('; '));
  return pair;
}
export function scenarioTokens(text, { includeHeadings = false } = {}) {
  const masked = text.replace(/<!-- SCENARIO_HISTORY:BEGIN -->[\s\S]*?<!-- SCENARIO_HISTORY:END -->/g, s => s.replace(/[^\n]/g, ' '))
    .replace(/<!--[^]*?-->/g, s => s.replace(/[^\n]/g, ' '));
  const tokens = [];
  const pattern = /(?<![A-Za-z0-9_])(?:Gen\d+(?:\.\d+)?|\d+[A-Z](?:-\d+)?)(?![A-Za-z0-9_.-])|场景\s*\d+(?![A-Za-z0-9_.-])|场景[零一二三四五六七]/gu;
  for (const m of masked.matchAll(pattern)) {
    const before = masked.slice(masked.lastIndexOf('\n', m.index) + 1, m.index);
    if (!includeHeadings && /^#{1,6}\s/.test(before)) continue;
    if (/(?:旧\s*(?:编号\s*)?|原场景\s*|旧版[^\n]{0,24}(?:中的|的|“|「)\s*)$/.test(before)) continue;
    const code = /^场景\s*\d/.test(m[0]) ? m[0].replace(/^场景\s*/, '') : m[0];
    tokens.push({ code, index: m.index, length: m[0].length, raw: m[0] });
  }
  return tokens;
}

export function scenarioCatalog(manual) {
  const byAnchor = new Map(), byCode = new Map(), allAnchors = new Set(), headingCounts = new Map(), errors = [];
  const lines = manual.split('\n'); let pending = null, fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { if (!fence) fence = f[1]; else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
    if (fence) continue;
    for (const a of line.matchAll(/<a id="([^"]+)"><\/a>/g)) allAnchors.add(a[1]);
    const anyHeading = line.match(/^#{1,6}\s+(.+)/);
    if (anyHeading) {
      const base = slug(anyHeading[1]), count = headingCounts.get(base) || 0;
      allAnchors.add(count ? `${base}-${count}` : base); headingCounts.set(base, count + 1);
    }
    const anchor = line.match(/^<a id="(scenario-[a-z0-9-]+)"><\/a>\s*$/);
    if (anchor) { pending = anchor[1]; continue; }
    const heading = line.match(/^#{2,4} ((?:场景\s+(\d+[A-Z]?|Gen\d+(?:\.\d+)?)|场景([零一二三四五六七])|(EXT-\d{3}))[：:]\s*(.+))\s*$/);
    if (heading) {
      const code = heading[2] || (heading[3] ? '场景' + heading[3] : heading[4]);
      if (!pending) { errors.push(`line ${i + 1}: scenario ${code} has no stable semantic anchor`); continue; }
      const value = { anchor: pending, code, title: heading[5].trim(), heading: heading[1], line: i + 1 };
      if (byAnchor.has(pending)) errors.push(`duplicate semantic anchor: ${pending}`);
      if (byCode.has(code)) errors.push(`duplicate current scenario number: ${code}`);
      byAnchor.set(pending, value); byCode.set(code, value); pending = null;
    } else if (/^#{1,6}\s/.test(line)) pending = null;
  }
  return { byAnchor, byCode, allAnchors, errors };
}

function bindings(text) {
  const result = [], errors = [];
  for (const match of text.matchAll(bindingPattern)) {
    try {
      const map = JSON.parse(match[1]);
      if (Object.values(map).some(value => typeof value !== 'string')) throw new Error('labels must be strings');
      if (new Set(Object.values(map)).size !== Object.values(map).length) throw new Error('one number is bound to multiple meanings');
      result.push({ index: match.index, end: match.index + match[0].length, map });
    } catch (error) { errors.push(`invalid reference binding: ${error.message}`); }
  }
  return { result, errors };
}

function slug(title) {
  return title.toLowerCase().replace(/<[^>]*>/g, '').replace(/[\[\]`*_]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '').replace(/\s/g, '-');
}

export function validateScenarioDocument(text, catalog, { manual = false } = {}) {
  const errors = [...catalog.errors], parsed = bindings(text); errors.push(...parsed.errors);
  const historyOpen = (text.match(/<!-- SCENARIO_HISTORY:BEGIN -->/g) || []).length;
  const historyClose = (text.match(/<!-- SCENARIO_HISTORY:END -->/g) || []).length;
  let historyDepth = 0;
  for (const tag of text.matchAll(/<!-- SCENARIO_HISTORY:(BEGIN|END) -->/g)) {
    historyDepth += tag[1] === 'BEGIN' ? 1 : -1;
    if (historyDepth < 0 || historyDepth > 1) errors.push('unordered or nested history range');
  }
  if (historyOpen !== historyClose || historyDepth !== 0) errors.push('unbalanced history range');
  const tokens = scenarioTokens(text, { includeHeadings: !manual });
  if (tokens.length && !parsed.result.length) errors.push('current references have no semantic bindings');
  for (let i = 0; i < parsed.result.length; i++) {
    const block = parsed.result[i], end = parsed.result[i + 1]?.index ?? text.length;
    for (const [anchor, code] of Object.entries(block.map)) {
      const target = catalog.byAnchor.get(anchor);
      if (!target) errors.push(`reference target missing: ${anchor}`);
      else if (target.code !== code) errors.push(`meaning/number mismatch: ${anchor} is ${target.code}, reference still says ${code}`);
    }
    for (const token of tokens.filter(t => t.index >= block.end && t.index < end)) {
      if (!Object.values(block.map).includes(token.code)) errors.push(`line ${text.slice(0, token.index).split('\n').length}: unbound current reference ${token.code}`);
    }
  }
  if (tokens.some(t => t.index < (parsed.result[0]?.index ?? text.length))) errors.push('references precede their semantic binding');
  for (const link of text.matchAll(/\[[^\]\n]+\]\(([^\s)]+)\)/g)) {
    const target = decodeURIComponent(link[1]);
    if (target.includes('01-操作者操作手册.md#')) {
      const anchor = target.split('#')[1];
      if (!catalog.allAnchors.has(anchor)) errors.push(`broken inbound manual anchor: ${anchor}`);
    }
  }
  if (manual) {
    const anchors = new Set(), headingCounts = new Map(); let fence = null;
    for (const line of text.split('\n')) {
      const f = line.match(/^\s*(`{3,}|~{3,})/);
      if (f) { if (!fence) fence = f[1]; else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
      if (fence) continue;
      for (const m of line.matchAll(/<a id="([^"]+)"><\/a>/g)) {
        if (anchors.has(m[1])) errors.push(`duplicate explicit anchor: ${m[1]}`);
        anchors.add(m[1]);
      }
      const h = line.match(/^#{1,6}\s+(.+)/);
      if (h) { const base = slug(h[1]), count = headingCounts.get(base) || 0; anchors.add(count ? `${base}-${count}` : base); headingCounts.set(base, count + 1); }
    }
    const toc = text.slice(text.indexOf('## 目录'), text.indexOf('## 快速上手'));
    const tocNumbers = [...toc.matchAll(/^(\d+)\. /gm)].map(m => Number(m[1]));
    if (tocNumbers.some((n, i) => n !== i + 1)) errors.push('table of contents ordering is not consecutive');
    const overview = text.slice(text.indexOf('### 场景总览'), text.indexOf('<!-- SCENARIO_HISTORY:BEGIN -->'));
    const registeredMeanings = new Set([...overview.matchAll(/\]\(#(scenario-[a-z0-9-]+)\)/g)].map(m => m[1]));
    for (const definition of catalog.byAnchor.values()) {
      const escaped = definition.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`(?<![A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_.-])`, 'u').test(overview)) errors.push(`scenario overview omits current entry: ${definition.code}`);
      if (!registeredMeanings.has(definition.anchor)) errors.push(`scenario overview omits semantic target: ${definition.anchor}`);
    }
    for (const link of text.matchAll(/\[([^\]\n]+)\]\(#([^\s)]+)\)/g)) {
      if (!anchors.has(decodeURIComponent(link[2]))) errors.push(`broken internal anchor: ${link[2]}`);
      const target = catalog.byAnchor.get(link[2]);
      if (target) {
        const normalize = value => value.replace(/^场景\s*/, '').replace(/[：:\s]/g, '');
        if (normalize(link[1]) !== normalize(target.heading)) errors.push(`linked title differs from ${target.anchor}`);
      }
    }
  }
  return { status: errors.length ? 'FAIL' : 'PASS', errors: [...new Set(errors)], references: tokens.length };
}

// Pure projection: updates every bound occurrence from semantic identity, never
// a global number substitution. Missing/deleted/ambiguous meanings fail closed.
export function synchronizeScenarioReferences(text, catalog, { manual = false } = {}) {
  if (catalog.errors.length) throw new Error(catalog.errors.join('; '));
  const parsed = bindings(text); if (parsed.errors.length) throw new Error(parsed.errors.join('; '));
  const replacements = [], tokens = scenarioTokens(text, { includeHeadings: !manual });
  for (let i = 0; i < parsed.result.length; i++) {
    const block = parsed.result[i], end = parsed.result[i + 1]?.index ?? text.length;
    const codes = new Map(), next = {};
    for (const [anchor, code] of Object.entries(block.map)) {
      const target = catalog.byAnchor.get(anchor); if (!target) throw new Error(`reference target missing: ${anchor}`);
      if (Object.values(next).includes(target.code)) throw new Error('ambiguous target number');
      codes.set(code, target.code); next[anchor] = target.code;
    }
    for (const token of tokens.filter(t => t.index >= block.end && t.index < end)) {
      if (!codes.has(token.code)) throw new Error(`unbound current reference ${token.code}`);
      const code = codes.get(token.code);
      replacements.push({ start: token.index, end: token.index + token.length, value: /^场景\s*\d/.test(token.raw) ? '场景 ' + code : code });
    }
    replacements.push({ start: block.index, end: block.end, value: '<!-- SCENARIO_REFS: ' + JSON.stringify(next) + ' -->' });
  }
  for (const link of text.matchAll(/\[([^\]\n]+)\]\(#(scenario-[a-z0-9-]+)\)/g)) {
    const target = catalog.byAnchor.get(link[2]); if (!target) throw new Error(`link target missing: ${link[2]}`);
    // Full-title links are the generated directory; short links keep their wording.
    if (link[1].includes('：') || link[1].includes(' ')) {
      replacements.push({ start: link.index, end: link.index + link[0].length, value: `[${target.heading}](#${target.anchor})` });
    }
  }
  // Link replacements own their labels, which may also contain numeric tokens.
  const filtered = replacements.filter(r => !replacements.some(other => other !== r && other.start <= r.start && other.end >= r.end && other.end - other.start > r.end - r.start));
  let result = text; for (const r of filtered.sort((a, b) => b.start - a.start)) result = result.slice(0, r.start) + r.value + result.slice(r.end);
  return result;
}

function selfTests() {
  const base = '<a id="scenario-local-task"></a>\n### 场景 2：普通目标\n<a id="scenario-simplify"></a>\n### 场景 2B：精简代码\n';
  const catalog = scenarioCatalog(base), bind = '<!-- SCENARIO_REFS: {"scenario-local-task":"2"} -->\n';
  let checks = 0; const check = (name, fn) => { assert.doesNotThrow(fn, name); checks++; };
  check('same existing number, wrong meaning', () => assert.equal(validateScenarioDocument(bind + '2B 的范围未变时继续返工', catalog).status, 'FAIL'));
  check('valid local-task reference', () => assert.equal(validateScenarioDocument(bind + '场景 2 的范围未变时继续返工', catalog).status, 'PASS'));
  check('deleted meaning', () => assert.equal(validateScenarioDocument(bind + '场景 2', scenarioCatalog(base.replace('<a id="scenario-local-task"></a>\n### 场景 2：普通目标\n', ''))).status, 'FAIL'));
  check('duplicate number', () => assert.ok(scenarioCatalog(base.replace('场景 2B：', '场景 2：')).errors.length));
  check('duplicate meaning', () => assert.ok(scenarioCatalog(base.replace('scenario-simplify', 'scenario-local-task')).errors.length));
  check('renumber does not silently retarget', () => assert.equal(validateScenarioDocument(bind + '场景 2', scenarioCatalog(base.replace('场景 2：', '场景 3：'))).status, 'FAIL'));
  check('pure renumber synchronization', () => { const c = scenarioCatalog(base.replace('场景 2：', '场景 3：')); const result = synchronizeScenarioReferences(bind + '场景 2', c); assert.ok(result.endsWith('场景 3')); assert.equal(validateScenarioDocument(result, c).status, 'PASS'); });
  check('order is not identity', () => assert.equal(validateScenarioDocument(bind + '场景 2', scenarioCatalog(base.split('<a id="scenario-simplify">')[1] ? base.slice(base.indexOf('<a id="scenario-simplify">')) + base.slice(0, base.indexOf('<a id="scenario-simplify">')) : base)).status, 'PASS'));
  check('copyable fenced prompt is covered', () => assert.equal(validateScenarioDocument(bind + '```text\n2B 的范围\n```', catalog).status, 'FAIL'));
  check('explicit old-number history retained', () => assert.equal(validateScenarioDocument(bind + '<!-- SCENARIO_HISTORY:BEGIN -->旧 2B 改为场景 2<!-- SCENARIO_HISTORY:END -->\n场景 2', catalog).status, 'PASS'));
  check('history cannot mask later current reference', () => assert.equal(validateScenarioDocument(bind + '<!-- SCENARIO_HISTORY:BEGIN -->旧 2B<!-- SCENARIO_HISTORY:END -->\n2B', catalog).status, 'FAIL'));
  check('malformed binding rejected', () => assert.equal(validateScenarioDocument('<!-- SCENARIO_REFS: {"a":2} -->\n场景 2', catalog).status, 'FAIL'));
  check('new unbound reference rejected', () => assert.equal(validateScenarioDocument(bind + 'Gen1.3', catalog).status, 'FAIL'));
  check('synchronization rejects deleted target', () => assert.throws(() => synchronizeScenarioReferences(bind + '场景 2', scenarioCatalog(''))));
  check('same-number semantic swap', () => {
    const swapped = scenarioCatalog(base.replace('场景 2：', '场景 X：').replace('场景 2B：', '场景 2：').replace('场景 X：', '场景 2B：'));
    assert.equal(validateScenarioDocument(bind + '场景 2', swapped).status, 'FAIL');
    const fixed = synchronizeScenarioReferences(bind + '场景 2', swapped);
    assert.ok(fixed.endsWith('场景 2B')); assert.equal(validateScenarioDocument(fixed, swapped).status, 'PASS');
  });
  check('title synchronization follows stable identity', () => {
    const renamed = scenarioCatalog(base.replace('普通目标', '普通任务'));
    assert.ok(synchronizeScenarioReferences(bind + '[场景 2：普通目标](#scenario-local-task)', renamed).includes('[场景 2：普通任务]'));
  });
  check('unbalanced history rejected', () => assert.equal(validateScenarioDocument(bind + '<!-- SCENARIO_HISTORY:BEGIN -->\n场景 2', catalog).status, 'FAIL'));
  check('reverse history markers rejected', () => assert.equal(validateScenarioDocument(bind + '<!-- SCENARIO_HISTORY:END --><!-- SCENARIO_HISTORY:BEGIN -->', catalog).status, 'FAIL'));
  check('duplicate reference meaning rejected', () => assert.equal(validateScenarioDocument('<!-- SCENARIO_REFS: {"scenario-local-task":"2","scenario-simplify":"2"} -->\n场景 2', catalog).status, 'FAIL'));
  check('fenced text does not create a scenario definition', () => assert.equal(scenarioCatalog(base + '```text\n### 场景 2B：示例\n```').errors.length, 0));
  check('rule heading is a checked reference', () => assert.equal(validateScenarioDocument(bind + '## 场景 2B：本地闭环实现', catalog).status, 'FAIL'));
  check('separate rule sections cannot borrow another meaning', () => {
    const text = bind + '## 本地闭环\n2B 的范围\n<!-- SCENARIO_REFS: {"scenario-simplify":"2B"} -->\n## 代码精简\n2B 保持功能';
    assert.equal(validateScenarioDocument(text, catalog).status, 'FAIL');
  });
  check('current migration target synchronizes while old source stays', () => {
    const c = scenarioCatalog(base.replace('场景 2：', '场景 3：'));
    const result = synchronizeScenarioReferences(bind + '旧 <!-- SCENARIO_HISTORY:BEGIN -->2B<!-- SCENARIO_HISTORY:END -->归入场景 2', c);
    assert.ok(result.includes('旧 <!-- SCENARIO_HISTORY:BEGIN -->2B<!-- SCENARIO_HISTORY:END -->归入场景 3')); assert.equal(validateScenarioDocument(result, c).status, 'PASS');
  });
  check('registry entry is not a number substring', () => {
    const text = '<!-- SCENARIO_REFS: {"scenario-local-task":"2","scenario-simplify":"2B"} -->\n## 目录\n1. [场景 2：普通目标](#scenario-local-task)\n2. [场景 2B：精简代码](#scenario-simplify)\n## 快速上手\n### 场景总览\n[场景 2：普通目标](#scenario-local-task)；[场景 2B：精简代码](#scenario-simplify)\n<!-- SCENARIO_HISTORY:BEGIN -->旧编号<!-- SCENARIO_HISTORY:END -->\n' + base;
    assert.equal(validateScenarioDocument(text, catalog, { manual: true }).status, 'PASS');
    assert.ok(validateScenarioDocument(text.replace('### 场景总览\n[场景 2：普通目标](#scenario-local-task)；', '### 场景总览\n'), catalog, { manual: true }).errors.includes('scenario overview omits current entry: 2'));
    assert.equal(validateScenarioDocument(text.replaceAll('普通目标', '旧名称'), catalog, { manual: true }).status, 'FAIL');
  });
  check('inbound document anchor is validated', () => assert.equal(validateScenarioDocument(bind + '[场景 2](../01-操作者操作手册.md#missing)', catalog).status, 'FAIL'));
  const fixture = '# 手册\n' +
    '<!-- SCENARIO_REFS: {"scenario-local-task":"2","scenario-simplify":"2B"} -->\n' +
    '## 目录\n1. [场景 2：普通目标](#scenario-local-task)\n2. [场景 2B：精简代码](#scenario-simplify)\n' +
    '## 快速上手\n### 场景总览\n[场景 2：普通目标](#scenario-local-task)；[场景 2B：精简代码](#scenario-simplify)\n' +
    '旧 <!-- SCENARIO_HISTORY:BEGIN -->6/6A<!-- SCENARIO_HISTORY:END --> 归入场景 2。\n' +
    '<a id="scenario-local-task"></a>\n### 场景 2：普通目标\n<!-- SCENARIO_REFS: {"scenario-local-task":"2"} -->\n' +
    '```text\n场景 2 的范围不变时继续。\n```\n' +
    '<a id="scenario-simplify"></a>\n### 场景 2B：精简代码\n<!-- SCENARIO_REFS: {} -->\n';
  const pair = externalizeOperatorManual(fixture), externalCatalog = scenarioCatalog(pair.text);
  check('migration rejects broken source before removing history markers', () => assert.throws(() => externalizeOperatorManual(fixture.replace('<!-- SCENARIO_HISTORY:BEGIN -->', ''))));
  check('external migration keeps a clean manual and checked references', () => {
    assert.equal(machineComment.test(pair.text), false);
    assert.equal(validateOperatorManual(pair.text, externalCatalog, pair.metadata).status, 'PASS');
  });
  check('missing external metadata fails closed', () => assert.equal(validateOperatorManual(pair.text,externalCatalog,undefined).status,'FAIL'));
  check('unsupported external metadata version rejected', () => assert.equal(validateOperatorManual(pair.text,externalCatalog,{...pair.metadata,schema_version:2}).status,'FAIL'));
  check('wrong manual digest rejected', () => assert.equal(validateOperatorManual(pair.text+'\n',externalCatalog,pair.metadata).status,'FAIL'));
  check('omitted external section rejected', () => assert.equal(validateOperatorManual(pair.text,externalCatalog,{...pair.metadata,sections:pair.metadata.sections.slice(1)}).status,'FAIL'));
  check('duplicate external section rejected', () => assert.equal(validateOperatorManual(pair.text,externalCatalog,{...pair.metadata,sections:[...pair.metadata.sections,pair.metadata.sections[0]]}).status,'FAIL'));
  check('history must locate exact text', () => {
    const bad=structuredClone(pair.metadata); bad.sections[0].history[0].text='not here';
    assert.equal(validateOperatorManual(pair.text,externalCatalog,bad).status,'FAIL');
  });
  check('overlapping external history rejected', () => {
    const bad=structuredClone(pair.metadata); bad.sections[0].history.push(bad.sections[0].history[0]);
    assert.equal(validateOperatorManual(pair.text,externalCatalog,bad).status,'FAIL');
  });
  check('wrong semantic binding rejected even with matching digest', () => {
    const bad=structuredClone(pair.metadata); bad.sections[1].references={'scenario-simplify':'2'};
    assert.equal(validateOperatorManual(pair.text,externalCatalog,bad).status,'FAIL');
  });
  check('projection synchronizes manual and sidecar together without comments', () => {
    const edited=pair.text.replace('### 场景 2：','### 场景 3：');
    const projected=synchronizeOperatorManual(pair.text,edited,pair.metadata);
    assert.ok(projected.text.includes('场景 3 的范围'));
    assert.equal(machineComment.test(projected.text),false);
    assert.equal(validateOperatorManual(projected.text,scenarioCatalog(projected.text),projected.metadata).status,'PASS');
    assert.equal(validateOperatorManual(projected.text,scenarioCatalog(projected.text),pair.metadata).status,'FAIL');
  });
  check('projection cannot self-certify an invalid pre-edit pair', () => assert.throws(()=>synchronizeOperatorManual(pair.text+'x',pair.text,pair.metadata)));
  check('machine comments may not return to manual', () => assert.equal(validateOperatorManual(pair.text+'\n<!-- SCENARIO_REFS: {} -->',externalCatalog,{...pair.metadata,manual_sha256:manualDigest(pair.text+'\n<!-- SCENARIO_REFS: {} -->')}).status,'FAIL'));
  return checks;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const ruleRoot = path.join(root, '总指挥工作流/第二代总指挥的工作模式');
  const manual = fs.readFileSync(path.join(ruleRoot, '01-操作者操作手册.md'), 'utf8');
  const manualMetadata = JSON.parse(fs.readFileSync(path.join(ruleRoot, 'templates/OPERATOR_MANUAL_REFERENCES.json'), 'utf8'));
  const catalog = scenarioCatalog(manual), testCount = selfTests(); let total = 0, failures = 0;
  const docs = ['01-操作者操作手册.md', '02-总指挥核心规则.md', '04-状态、目标变更与交接规范.md', 'docs/AUTOMATED_TESTING_LESSONS.md', 'docs/EXECUTION_AND_INDEPENDENT_REVIEW.md'];
  for (const name of docs) {
    const text = fs.readFileSync(path.join(ruleRoot, name), 'utf8');
    const result = name === docs[0] ? validateOperatorManual(text, catalog, manualMetadata) : validateScenarioDocument(text, catalog);
    total += result.references; if (result.status !== 'PASS') { failures++; for (const error of result.errors.slice(0, 16)) console.error(`FAIL ${name}: ${error}`); }
  }
  if (failures) process.exitCode = 1;
  else console.log(`Operator manual references: PASS (${catalog.byAnchor.size} meanings, ${total} current references, ${docs.length} documents, ${testCount} mutation checks)`);
}
