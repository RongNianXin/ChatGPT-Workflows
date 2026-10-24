// Exercise the real list renderer with synthetic tasks, without a service or user data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  for (const relative of ['../check-codex-session.ps1', 'Start-SessionDesk.ps1', 'Read-DeskMetadata.ps1', 'Invoke-IsolatedAnalyzer.ps1']) {
    const bytes = fs.readFileSync(path.join(__dirname, '../../实用小工具/Codex会话交接评估/windows-local', relative));
    assert.ok(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${relative}: PowerShell 5.1 UTF-8 BOM`);
    assert.ok(!bytes.toString('utf8').includes('\ufffd'), `${relative}: no destructive decoding replacements`);
  }
  const html = fs.readFileSync(path.join(__dirname, '../../实用小工具/Codex会话交接评估/windows-local/desk.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const startup = script.indexOf("render();api('/api/tasks')");
  assert.ok(startup > 0, 'locate startup without running service requests');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html.replace(/<script>[\s\S]*?<\/script>/g, ''));
    await page.addScriptTag({ content: script.slice(0, startup) });
    for (const locale of ['zh-CN', 'en-US']) {
      await page.evaluate(locale => {
        language = locale;
        tasks = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: `Fixture ${i}`, project: 'Fixture' }));
        recommendations.clear();
        render();
      }, locale);
      assert.equal(await page.locator('.task').count(), 10, 'unqueried tasks remain usable');
      assert.equal(await page.locator('.task [data-query]:enabled').count(), 10);
      assert.equal(await page.locator('.scorebar').count(), 10, 'scale remains visible before querying');
      assert.equal(await page.locator('.scorebar .seg.on').count(), 0, 'missing results do not fill segments');
      assert.equal(await page.locator('.scorebar .seg.tick').count(), 20, 'three/eight markers never disappear');
      await page.evaluate(() => {
        rememberScore({ id: '0', state: 'done', finished: '2025-01-01T00:00:00Z', assessmentVersion: 'handoff-score-v6-traditional', level: 'recommended', score: 3, scoreBasis: 'traditional', contextInputTokens: 164949, contextObservedAt: '2025-01-01T00:00:00Z' });
        rememberScore({ id: '1', state: 'done', finished: '2025-01-01T00:00:00Z', assessmentVersion: 'handoff-score-v6-traditional', level: 'required', score: 8, scoreBasis: 'traditional', contextInputTokens: 0 });
        rememberScore({ id: '2', state: 'done', finished: '2025-01-01T00:00:00Z', assessmentVersion: 'handoff-score-v6-traditional', level: 'unknown', score: null });
        rememberScore({ id: '3', state: 'done', finished: '2025-01-01T00:00:00Z', assessmentVersion: 'context-observation-v2', contextPercent: 95 });
        render();
      });
      assert.equal(await page.locator('.task').count(), 10, 'mixed new, unknown and historical results render');
      assert.equal(await page.locator('.scorebar.advice .seg.on').count(), 3);
      assert.equal(await page.locator('.scorebar.required .seg.on').count(), 8);
      assert.match(await page.locator('[data-id="0"] .input-note').textContent(), /164,949/);
      assert.match(await page.locator('[data-id="1"] .input-note').textContent(), /(?:：|: )0 (?:Token|tokens)/);
      assert.match(await page.locator('[data-id="2"] .input-note').textContent(), /未知|unknown/);
      assert.doesNotMatch(await page.locator('[data-id="0"] .score-note').textContent(), /传统评分|文件大小|压缩次数|Traditional score|file size|compaction count/);
      assert.match(await page.locator('[data-id="0"] .input-note').getAttribute('title'), /含缓存输入|including cached input/);
      assert.equal(await page.locator('.scorebar .seg.tick').count(), 20);
      await page.evaluate(() => {
        for (const [id, score] of [['4', null], ['5', 0], ['6', 2.5], ['7', '3']])
          rememberScore({ id, score, level: 'required', state: 'done', finished: '2025-01-01T00:00:00Z', assessmentVersion: 'handoff-score-v6-traditional' });
        rememberScore({ id: '8', score: 8, level: 'required', state: 'done', finished: '2025-01-01T00:00:00Z', assessmentVersion: 'handoff-score-v5', sourceChanged: true });
        render();
      });
      for (const id of ['4', '5', '6', '7']) {
        assert.equal(await page.locator(`[data-id="${id}"] .required-badge`).count(), 0, 'invalid or zero scores cannot inherit a red level');
      }
      assert.match(await page.locator('[data-id="8"] .score-note').textContent(), /历史评分|Historical score/);
      assert.doesNotMatch(await page.locator('[data-id="5"] .score-note').textContent(), /评分依据|Score basis/);
      await page.evaluate(() => {
        for (const [id, value] of [['4', -1], ['5', '123'], ['6', 2.5], ['7', Number.MAX_SAFE_INTEGER + 1]]) {
          rememberScore({ id, state: 'done', finished: '2025-01-02T00:00:00Z', score: 1, assessmentVersion: 'handoff-score-v6-traditional', contextInputTokens: value });
        }
        render();
      });
      for (const id of ['4', '5', '6', '7']) assert.match(await page.locator(`[data-id="${id}"] .input-note`).textContent(), /未知|unknown/);
      await page.evaluate(() => {
        rememberScore({ id: '0', state: 'done', finished: '2025-01-03T00:00:00Z', assessmentVersion: 'handoff-score-v6-traditional', score: 3, contextInputTokens: 164949, contextObservedAt: '2025-01-01T00:00:00Z', restored: true });
        render();
      });
      assert.match(await page.locator('[data-id="0"] .input-note').textContent(), /上次查询输入|Previous query input/);
      await page.evaluate(() => { jobs.set('0', { state: 'failed' }); render(); });
      assert.match(await page.locator('[data-id="0"] .input-note').textContent(), /刷新失败|refresh failed/);
      assert.match(await page.locator('[data-id="0"] .input-note').getAttribute('title'), /2025/);
      await page.locator('#search').fill('Fixture 9');
      assert.equal(await page.locator('.task').count(), 1, 'unqueried task remains searchable');
      await page.locator('#search').fill('');
    }
    console.log('SessionDesk rendering regression: PASS (both languages; new, unknown, mixed and legacy results; fixed 3/8 markers)');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
