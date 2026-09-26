const { chromium } = require(process.argv[2] || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const tool = __dirname;
const root = path.resolve(tool, '../..');
const output = path.join(root, '.playwright-cli');
fs.mkdirSync(output, { recursive: true });
const MarkdownIt = require(path.join(tool, 'node_modules/markdown-it'));
const parser = new MarkdownIt({ html: false, linkify: true });
const manual = fs.readFileSync(path.join(root, '总指挥工作流/第二代总指挥的工作模式/01-操作者操作手册.md'), 'utf8');
const headingCount = parser.parse(manual, {}).filter(t => t.type === 'heading_open').length;
const errors = [];
const remoteRequests = [];
(async () => {
  const browser = await chromium.launch({ channel: process.argv[3] || 'chrome', headless: true });
  let server;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { if (/^https?:/.test(r.url())) remoteRequests.push(r.url()); });
    await page.goto(pathToFileURL(path.join(tool, 'index.html')).href);
    await page.locator('#empty-state').waitFor();
    assert.equal(await page.locator('.document-row').count(), 0);
    await page.screenshot({ path: path.join(output, 'reader-empty.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'empty mobile layout');
    await page.screenshot({ path: path.join(output, 'reader-empty-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.locator('#import-files').count(), 0, 'single open control');
    assert(await page.locator('#refresh').isDisabled(), 'no current file to refresh');
    await page.evaluate(() => { window.showOpenFilePicker = undefined; });
    const firstChooser = page.waitForEvent('filechooser');
    await page.locator('#empty-open').click();
    await (await firstChooser).setFiles({ name: '最新手册.md', mimeType: 'text/markdown', buffer: Buffer.from('# 最新手册\n\n## 新章节') });
    await page.getByRole('heading', { name: '最新手册', exact: true }).waitFor();
    assert.equal(await page.locator('.document-row').count(), 1, 'only selected documents appear');
    await page.getByRole('button', { name: '从列表移除 最新手册.md', exact: true }).click();
    await page.locator('#empty-state').waitFor();
    assert.equal(await page.locator('#toc a').count(), 0, 'last removal clears outline');
    assert.equal(await page.locator('#content').textContent(), '', 'last removal clears content');
    const canceledCount = await page.locator('.document-row').count();
    const onUnexpectedChooser = () => { throw new Error('Canceled picker must not fall back'); };
    page.on('filechooser', onUnexpectedChooser);
    await page.evaluate(async () => {
      window.showOpenFilePicker = async () => { throw new DOMException('Canceled', 'AbortError'); };
      await openFiles();
    });
    page.off('filechooser', onUnexpectedChooser);
    assert.equal(await page.locator('.document-row').count(), canceledCount);
    await page.evaluate(() => { window.showOpenFilePicker = async () => { throw new DOMException('Unavailable', 'SecurityError'); }; });
    const fallbackChooser = page.waitForEvent('filechooser');
    await page.locator('#open-files').click();
    await (await fallbackChooser).setFiles({ name: '兼容模式.md', mimeType: 'text/markdown', buffer: Buffer.from('# 兼容读取') });
    await page.getByRole('heading', { name: '兼容读取', exact: true }).waitFor();
    assert((await page.locator('#source-state').textContent()).includes('本次载入'));
    await page.getByRole('button', { name: '从列表移除 兼容模式.md', exact: true }).click();
    await page.locator('#empty-state').waitFor();
    await page.locator('#file-input').setInputFiles({ name: '导航测试.md', mimeType: 'text/markdown', buffer: Buffer.from(manual) });
    await page.locator('#toc a').nth(8).waitFor();
    await page.getByRole('link', { name: '场景 2B：保持功能不变，精简现有代码', exact: true }).click();
    const g = await page.getByRole('heading', { name: '场景 2B：保持功能不变，精简现有代码', exact: true }).boundingBox();
    assert(g.y >= 65 && g.y < 150, '2B anchor position');
    await page.getByRole('link', { name: '场景 2F：复盘最近一批工作', exact: true }).click();
    const f = await page.getByRole('heading', { name: '场景 2F：复盘最近一批工作', exact: true }).boundingBox();
    assert(f.y >= 65 && f.y < 150, '2F anchor position');
    await page.getByRole('button', { name: '回到顶部' }).click();
    await page.waitForFunction(() => document.querySelector('#toc a.active')?.textContent === '第二代工作流操作者操作手册');
    await page.screenshot({ path: path.join(root, '.playwright-cli/reader-desktop.png'), fullPage: false });
    await page.getByRole('button', { name: '从列表移除 导航测试.md', exact: true }).click();
    await page.locator('#empty-state').waitFor();
    await page.locator('#file-input').setInputFiles([
      { name: '操作手册.md', mimeType: 'text/markdown', buffer: Buffer.from(manual) },
      { name: '另一项目.md', mimeType: 'text/markdown', buffer: Buffer.from('# 项目文档\n\n## 场景甲\n\n说明正文。\n\n```text\n第一行\n  缩进 <>& 【参数】\n```\n\n## 场景甲\n\n[返回](#场景甲)\n\n<script>window.injected=true</script>\n\n![图片](https://example.invalid/tracker.png)\n') }
    ]);
    await page.getByRole('heading', { name: '项目文档', exact: true }).waitFor();
    assert.equal(await page.locator('.document-row').count(), 2);
    assert.equal(await page.locator('.remove-document').count(), 2, 'every document is removable');
    assert.equal(await page.locator('#toc a').count(), 3);
    assert.equal(await page.locator('#content img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal(new Set(await page.locator('#content h2').evaluateAll((hs) => hs.map(h => h.id))).size, 2);
    await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedText = text; } } }); });
    await page.getByRole('button', { name: '复制完整文本' }).click();
    assert.equal(await page.evaluate(() => window.copiedText), '第一行\n  缩进 <>& 【参数】\n');
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
    await page.getByRole('button', { name: '复制完整文本' }).click();
    assert.equal(await page.locator('#copy-fallback').inputValue(), '第一行\n  缩进 <>& 【参数】\n');
    assert(await page.locator('#copy-fallback').evaluate(e => e.selectionStart === 0 && e.selectionEnd === e.value.length));
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '查找正文', exact: true }).click();
    await page.getByRole('searchbox', { name: '查找正文内容', exact: true }).fill('缩进');
    await page.locator('mark.reader-match').waitFor();
    await page.getByRole('button', { name: '复制完整文本' }).click();
    assert.equal(await page.locator('#copy-fallback').inputValue(), '第一行\n  缩进 <>& 【参数】\n');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '关闭查找', exact: true }).click();
    await page.getByRole('button', { name: /^操作手册\.md/ }).click();
    await page.getByRole('heading', { name: '第二代工作流操作者操作手册', exact: true }).waitFor();
    const tokens = parser.parse(manual, {});
    assert.equal(await page.locator('#toc a').count(), tokens.filter(t => t.type === 'heading_open').length);
    const outlineStyles = await page.evaluate(() => {
      const level2 = document.querySelector('#toc a[data-level="2"]');
      const level3 = document.querySelector('#toc a[data-level="3"]');
      const style2 = getComputedStyle(level2);
      const style3 = getComputedStyle(level3);
      return { weight2: Number(style2.fontWeight), background2: style2.backgroundColor, padding2: parseFloat(style2.paddingLeft), padding3: parseFloat(style3.paddingLeft) };
    });
    assert(outlineStyles.weight2 >= 600, 'content level-one headings are emphasized');
    assert.notEqual(outlineStyles.background2, 'rgba(0, 0, 0, 0)', 'content level-one headings have a subtle background');
    assert(outlineStyles.padding3 > outlineStyles.padding2, 'content level-two headings are indented');
    const expected = tokens.filter(t => t.type === 'fence').map(t => t.content);
    assert.deepEqual(await page.locator('pre code').allTextContents(), expected);
    await page.getByRole('link', { name: '场景 5A：建立“执行 AI＋独立检查 AI”配对｜发给当前负责安排的 AI', exact: true }).click();
    const savedY = await page.evaluate(() => scrollY);
    await page.getByRole('button', { name: /^另一项目\.md/ }).click();
    await page.getByRole('heading', { name: '项目文档', exact: true }).waitFor();
    await page.getByRole('button', { name: /^操作手册\.md/ }).click();
    assert(Math.abs((await page.evaluate(() => scrollY)) - savedY) < 3, 'document position restored');
    await page.screenshot({ path: path.join(root, '.playwright-cli/reader-manual.png'), fullPage: false });
    await page.getByRole('button', { name: '切换明暗主题' }).click();
    await page.screenshot({ path: path.join(root, '.playwright-cli/reader-dark.png'), fullPage: false });
    await page.getByRole('button', { name: '切换明暗主题' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '章节目录', exact: true }).click();
    await page.getByRole('link', { name: '场景 2F：复盘最近一批工作', exact: true }).click();
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('show-outline')), false);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile horizontal overflow');
    await page.screenshot({ path: path.join(root, '.playwright-cli/reader-mobile.png'), fullPage: false });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.deepEqual(errors, [], 'file URL page errors');
    assert.deepEqual(remoteRequests, [], 'file URL external network requests');
    server = http.createServer((req, res) => {
      const relative = decodeURIComponent(req.url.split('?')[0]);
      const file = path.resolve(tool, '.' + (relative === '/' ? '/index.html' : relative));
      if (!file.startsWith(tool + path.sep)) { res.writeHead(403).end(); return; }
      try {
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
        res.end(fs.readFileSync(file));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.locator('#empty-state').waitFor();
    // Exercise real browser handles and IndexedDB using an origin-private fixture.
    // Native OS picker/restart permission UX still requires manual platform testing.
    const handleSupport = await page.evaluate(async () => {
      if (!navigator.storage?.getDirectory) return false;
      const dir = await navigator.storage.getDirectory();
      const handle = await dir.getFileHandle('sync-test.md', { create: true });
      const writer = await handle.createWritable(); await writer.write('# 版本一\n\n## 初始标题'); await writer.close();
      window.testHandle = handle;
      window.showOpenFilePicker = async () => [handle];
      return true;
    });
    if (handleSupport) {
      await page.locator('#open-files').click();
      await page.getByRole('heading', { name: '版本一', exact: true }).waitFor();
      await page.locator('#refresh').click();
      await page.getByText('已重新读取“sync-test.md”，内容没有变化', { exact: true }).waitFor();
      await page.evaluate(async () => {
        const writer = await window.testHandle.createWritable(); await writer.write('# 手动刷新版本\n\n## 手动新增标题'); await writer.close();
      });
      await page.locator('#refresh').click();
      await page.getByRole('heading', { name: '手动刷新版本', exact: true }).waitFor();
      assert.equal(await page.locator('#toc a').count(), 2, 'manual refresh rebuilds outline');
      await page.evaluate(async () => {
        const writer = await window.testHandle.createWritable(); await writer.write('# 版本二\n\n## 更新后的标题'); await writer.close();
        window.dispatchEvent(new Event('focus'));
      });
      await page.getByRole('heading', { name: '版本二', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: '版本二', exact: true }).waitFor();
      assert((await page.locator('#source-state').textContent()).includes('已记住'));
      await page.getByRole('button', { name: '从列表移除 sync-test.md', exact: true }).click();
      await page.locator('#empty-state').waitFor();
      await page.reload();
      await page.waitForFunction(() => database !== undefined);
      assert.equal(await page.locator('.document-row').count(), 0, 'removed file is not restored');
      assert.equal(await page.evaluate(async () => {
        const dir = await navigator.storage.getDirectory();
        const handle = await dir.getFileHandle('sync-test.md');
        window.showOpenFilePicker = async () => [handle];
        return (await handle.getFile()).text();
      }), '# 版本二\n\n## 更新后的标题', 'removing entry leaves source unchanged');
      await page.locator('#open-files').click();
      await page.getByRole('heading', { name: '版本二', exact: true }).waitFor();
      await page.evaluate(async () => {
        const dir = await navigator.storage.getDirectory(); await dir.removeEntry('sync-test.md');
      });
      await page.getByRole('button', { name: '重新读取当前文件', exact: true }).click();
      await page.getByText('原文件已移动或删除，请重新选择', { exact: true }).first().waitFor();
      assert((await page.locator('#content').textContent()).includes('版本二'), 'unreadable source retains the last successful local cache');
      assert((await page.locator('#notice').textContent()).includes('上次成功读取的内容'), 'cached content is marked as potentially stale');
    }
    await page.locator('#file-input').setInputFiles({ name: '链接.md', mimeType: 'text/markdown', buffer: Buffer.from('# 链接测试\n\n[旧标题](#旧标题)\n\n<a id="旧标题"></a>\n\n## 新标题\n\n[另一文档](../somewhere/同名.md#目标)\n\n' + '正文\n\n'.repeat(50)) });
    await page.getByRole('heading', { name: '链接测试', exact: true }).waitFor();
    await page.getByRole('link', { name: '旧标题', exact: true }).click();
    assert.equal(await page.locator('.source-anchor').count(), 1);
    assert(!(await page.locator('#content').textContent()).includes('<a id='));
    await page.locator('#file-input').setInputFiles([
      { name: '同名.md', mimeType: 'text/markdown', buffer: Buffer.from('# 文档一\n\n## 目标') },
      { name: '同名.md', mimeType: 'text/markdown', buffer: Buffer.from('# 文档二\n\n## 目标') }
    ]);
    const reordered = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.document-row')];
      const source = rows.at(-1).dataset.documentId;
      const target = rows[0].dataset.documentId;
      const transfer = new DataTransfer();
      rows.at(-1).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      const upperY = rows[0].getBoundingClientRect().top + 1;
      rows[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, clientY: upperY, dataTransfer: transfer }));
      const insertsBefore = rows[0].classList.contains('drag-before');
      rows[0].dispatchEvent(new DragEvent('drop', { bubbles: true, clientY: upperY, dataTransfer: transfer }));
      const beforeOrder = document.querySelector('.document-row').dataset.documentId === source;
      const afterRows = [...document.querySelectorAll('.document-row')];
      const lowerSource = afterRows[0].dataset.documentId;
      const lowerTarget = afterRows[1].dataset.documentId;
      const lowerTransfer = new DataTransfer();
      afterRows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: lowerTransfer }));
      const lowerY = afterRows[1].getBoundingClientRect().bottom - 1;
      afterRows[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, clientY: lowerY, dataTransfer: lowerTransfer }));
      const insertsAfter = afterRows[1].classList.contains('drag-after');
      afterRows[1].dispatchEvent(new DragEvent('drop', { bubbles: true, clientY: lowerY, dataTransfer: lowerTransfer }));
      const finalRows = [...document.querySelectorAll('.document-row')];
      return { insertsBefore, beforeOrder, insertsAfter, afterOrder: finalRows[0].dataset.documentId === lowerTarget && finalRows[1].dataset.documentId === lowerSource };
    });
    assert.deepEqual(reordered, { insertsBefore: true, beforeOrder: true, insertsAfter: true, afterOrder: true }, 'document rows support before and after placement');
    await page.getByRole('button', { name: /^链接\.md/ }).click();
    await page.getByRole('button', { name: '设置当前文档的远端地址', exact: true }).click();
    await page.getByRole('textbox', { name: '当前文档远端地址', exact: true }).fill('https://github.com/example/repo/blob/main/docs/current.md');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByRole('link', { name: '另一文档', exact: true }).click();
    assert.equal(await page.locator('#link-choices button').count(), 3);
    await page.locator('#link-choices button').first().click();
    await page.getByRole('heading', { name: '文档一', exact: true }).waitFor();
    await page.getByRole('button', { name: /^链接\.md/ }).click();
    await page.getByRole('link', { name: '另一文档', exact: true }).click();
    assert.equal(await page.locator('#link-choices button').count(), 3);
    const remotePopup = page.waitForEvent('popup');
    await page.getByRole('button', { name: '在远端文档中打开', exact: true }).click();
    const remotePage = await remotePopup;
    assert.equal(remotePage.url(), 'https://github.com/example/repo/blob/main/somewhere/%E5%90%8C%E5%90%8D.md#%E7%9B%AE%E6%A0%87');
    await remotePage.close();
    assert(!(await page.locator('#toast').textContent()).includes('阻止'), 'successful remote opening must not report a blocked popup');
    await page.getByRole('button', { name: /^同名\.md/ }).first().click();
    await page.evaluate(() => { documents.get(activeId).remoteUrl = 'https://example.org/docs/current.md'; });
    const originalCount = await page.locator('.document-row').count();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '重新选择当前文件', exact: true }).click();
    await (await chooser).setFiles({ name: '同名.md', mimeType: 'text/markdown', buffer: Buffer.from('# 文档一更新\n\n## 目标') });
    await page.getByRole('heading', { name: '文档一更新', exact: true }).waitFor();
    assert.equal(await page.locator('.document-row').count(), originalCount, 'reload session replaces entry');
    assert.equal(await page.evaluate(() => documents.get(activeId).remoteUrl), 'https://example.org/docs/current.md', 'reload retains remote URL');
    await page.locator('#file-input').setInputFiles({ name: 'invalid.md', mimeType: 'text/markdown', buffer: Buffer.from([0xff, 0xfe, 0xff]) });
    assert.equal(await page.locator('.document-row').count(), originalCount, 'invalid UTF-8 not imported');
    const raceResult = await page.evaluate(async () => {
      let finishOld;
      let reads = 0;
      const entry = { handle: {
        queryPermission: async () => 'granted',
        getFile: () => ++reads === 1 ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(new File(['# 新结果'], 'race.md'))
      } };
      const older = refreshEntry(entry);
      await Promise.resolve(); await Promise.resolve();
      const newer = refreshEntry(entry);
      await newer;
      finishOld(new File(['# 旧结果'], 'race.md'));
      await older;
      return entry.text;
    });
    assert.equal(raceResult, '# 新结果', 'late old read cannot overwrite latest text');
    const permissionResult = await page.evaluate(async () => {
      let permission = 'denied';
      const entry = { id: 'permission-test', name: 'permission.md', kind: 'handle', text: '# 旧文本', handle: {
        queryPermission: async () => permission,
        requestPermission: async () => { permission = 'granted'; return permission; },
        getFile: async () => new File(['# 重新授权结果'], 'permission.md')
      } };
      documents.set(entry.id, entry);
      await selectDocument(entry.id);
      const denied = document.getElementById('content').textContent.includes('旧文本') && entry.error === '需要重新授权'
        && document.getElementById('notice').textContent.includes('上次成功读取的内容');
      await refreshCurrent(true);
      return { denied, granted: document.getElementById('content').textContent.includes('重新授权结果') };
    });
    assert.deepEqual(permissionResult, { denied: true, granted: true });
    await page.getByRole('button', { name: '从列表移除 permission.md', exact: true }).click();
    await page.waitForFunction(() => contentReady && activeId !== 'permission-test');
    assert.equal(await page.locator('.document-row.active').count(), 1, 'active removal selects remaining document');
    const activeBeforeRemoval = await page.evaluate(() => activeId);
    await page.locator('.document-row:not(.active) .remove-document').first().click();
    assert.equal(await page.evaluate(() => activeId), activeBeforeRemoval, 'non-active removal keeps current document');
    assert.deepEqual(errors, [], 'page errors');
    assert(remoteRequests.every(url => url.startsWith('http://127.0.0.1:')), 'external network requests');
    console.log(JSON.stringify({ pass: true, manualHeadings: headingCount, manualCodeBlocks: expected.length, handlesAndReloadOnLocalhost: handleSupport, externalRequests: 0, errors, screenshots: ['reader-desktop.png','reader-manual.png','reader-dark.png','reader-mobile.png'] }, null, 2));
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
