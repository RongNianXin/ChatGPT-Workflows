'use strict';
const $ = (id) => document.getElementById(id);
const md = window.markdownit({ html: false, linkify: true, breaks: false });
const escapeHtml = md.utils.escapeHtml;
const MAX_BYTES = 8 * 1024 * 1024;
const documents = new Map();
let activeId = null;
let renderVersion = 0;
let toastTimer;
let observer;
let database;
let codeContents = [];
let selectedHeading = '';
let contentReady = false;
let importBusy = false;
let replacementId = null;
let searchTimer;
let matches = [];
let matchIndex = -1;
let scrollFrame = 0;

function icons() { window.lucide.createIcons(); }
function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
}
function note(message, action, label) {
  $('notice').replaceChildren();
  $('notice').hidden = !message;
  if (!message) return;
  $('notice').append(document.createTextNode(message));
  if (action) {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', action);
    $('notice').append(button);
  }
}
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* File URLs may deny storage. */ } }
function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('local-markdown-reader', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Storage blocked'));
  });
}
async function persist(entry, remove = false) {
  if (!database) return false;
  try {
    await new Promise((resolve, reject) => {
      const tx = database.transaction('files', 'readwrite');
      const store = tx.objectStore('files');
      if (remove) store.delete(entry.id);
      else store.put({
        id: entry.id,
        name: entry.name,
        handle: entry.handle,
        text: entry.text || '',
        modified: entry.modified || 0,
        readAt: entry.readAt || null,
        order: entry.order ?? 0,
        remoteUrl: entry.remoteUrl || ''
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch { return false; }
}
async function restoredEntries() {
  return new Promise((resolve, reject) => {
    const request = database.transaction('files').objectStore('files').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function statusLabel(entry) {
  if (entry.kind === 'session') return '本次载入 · 重开需重新选择';
  if (entry.error) return entry.error;
  return entry.saved ? '原文件 · 已记住' : '原文件 · 本次授权';
}
async function persistDocumentOrder() {
  const jobs = [];
  [...documents.values()].forEach((entry, index) => {
    entry.order = index;
    if (entry.saved) jobs.push(persist(entry));
  });
  await Promise.all(jobs);
}
function moveDocument(id, beforeId) {
  if (id === beforeId) return;
  const entries = [...documents.values()];
  const moving = documents.get(id);
  if (!moving) return;
  const remaining = entries.filter(entry => entry.id !== id);
  const targetIndex = beforeId ? remaining.findIndex(entry => entry.id === beforeId) : remaining.length;
  remaining.splice(targetIndex < 0 ? remaining.length : targetIndex, 0, moving);
  documents.clear();
  remaining.forEach(entry => documents.set(entry.id, entry));
  renderDocuments();
  persistDocumentOrder();
}
function renderDocuments() {
  const search = $('document-search').value.trim().toLocaleLowerCase();
  $('documents').replaceChildren();
  $('document-count').textContent = documents.size;
  for (const entry of documents.values()) {
    if (!entry.name.toLocaleLowerCase().includes(search)) continue;
    const row = document.createElement('div');
    row.className = 'document-row' + (entry.id === activeId ? ' active' : '');
    row.draggable = true;
    row.title = '拖动调整文档顺序';
    row.dataset.documentId = entry.id;
    row.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', entry.id);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (event) => {
      event.preventDefault(); row.classList.remove('drag-over');
      moveDocument(event.dataTransfer.getData('text/plain'), entry.id);
    });
    const button = document.createElement('button');
    button.className = 'document-button';
    button.setAttribute('aria-current', String(entry.id === activeId));
    button.innerHTML = '<i data-lucide="file-text"></i><span></span>';
    button.querySelector('span').textContent = entry.name;
    const small = document.createElement('small');
    const sameNames = [...documents.values()].filter(item => item.name === entry.name);
    small.textContent = statusLabel(entry) + (sameNames.length > 1 ? ' · 文档 ' + (sameNames.indexOf(entry) + 1) : '');
    button.querySelector('span').append(small);
    button.addEventListener('click', () => { selectDocument(entry.id); closePanels(); });
    row.append(button);
    {
      const remove = document.createElement('button');
      remove.className = 'icon-button remove-document';
      remove.title = '从列表移除 ' + entry.name;
      remove.setAttribute('aria-label', remove.title);
      remove.innerHTML = '<i data-lucide="x"></i>';
      remove.addEventListener('click', async () => {
        if (entry.handle && !(await persist(entry, true)) && entry.saved) {
          notify('未能清除保存的条目，请重试'); return;
        }
        documents.delete(entry.id);
        try { localStorage.removeItem('reader-position-' + entry.id); } catch { /* Storage is optional. */ }
        if (activeId === entry.id) {
          const next = documents.keys().next().value;
          if (next) await selectDocument(next);
          else showEmpty();
        }
        renderDocuments();
      });
      row.append(remove);
    }
    $('documents').append(row);
  }
  if (!$('documents').childElementCount) {
    const empty = document.createElement('p'); empty.className = 'empty-label'; empty.textContent = documents.size ? '没有匹配的文档' : '暂无文档'; $('documents').append(empty);
  }
  icons();
}
md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const id = codeContents.push(token.content) - 1;
  const language = token.info.trim().split(/\s+/)[0];
  const label = language === 'text' ? '提示词' : (language || '文本');
  return `<section class="code-block"><div class="code-toolbar"><span>${escapeHtml(label)}</span><button class="icon-button copy-code" data-code="${id}" title="复制完整文本" aria-label="复制完整文本"><i data-lucide="copy"></i></button></div><pre><code>${escapeHtml(token.content)}</code></pre></section>`;
};
md.renderer.rules.image = (tokens, index) => `<span class="image-label">图片：${escapeHtml(tokens[index].content || '未命名图片')}（未加载）</span>`;
md.renderer.rules.reader_anchor = (tokens, index) => `<span class="source-anchor" id="source-anchor-${index}" data-source-anchor="${escapeHtml(tokens[index].content)}"></span>`;

function slug(text) {
  return text.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
}
function setActiveHeading(id) {
  const changed = selectedHeading !== id;
  selectedHeading = id;
  for (const link of $('toc').querySelectorAll('a')) {
    const active = link.hash === '#' + id;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'location');
      if (changed) {
        const panel = $('outline').getBoundingClientRect();
        const item = link.getBoundingClientRect();
        if (item.top < panel.top + 120 || item.bottom > panel.bottom) $('outline').scrollTop += item.top - panel.top - 145;
      }
    }
    else link.removeAttribute('aria-current');
  }
}
function syncOutline() {
  const headings = [...$('content').querySelectorAll('h1,h2,h3,h4,h5,h6')];
  let current = headings[0];
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= 145) current = heading;
    else break;
  }
  if (current) setActiveHeading(current.id);
}
function jumpTo(id) {
  const heading = document.getElementById(id);
  if (!heading || !$('content').contains(heading)) return false;
  heading.scrollIntoView({ behavior: 'instant', block: 'start' });
  setActiveHeading(id);
  closePanels();
  return true;
}
function renderContent(entry) {
  observer?.disconnect();
  codeContents = [];
  selectedHeading = '';
  const tokens = md.parse(entry.text || '', {});
  // Recognize only standalone empty anchors; never enable arbitrary raw HTML.
  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokens[i].type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i + 1].type !== 'paragraph_close') continue;
    const anchor = /^<a\s+(?:id|name)=["']([^"'<>]+)["']\s*>\s*<\/a>$/i.exec(tokens[i].content.trim());
    if (anchor) {
      tokens[i - 1].hidden = true; tokens[i + 1].hidden = true;
      tokens[i].type = 'reader_anchor'; tokens[i].content = anchor[1];
    }
  }
  // Raw HTML remains text. Only the parser's own elements enter the document.
  $('content').innerHTML = md.renderer.render(tokens, md.options, {});
  for (const table of $('content').querySelectorAll('table')) {
    const wrap = document.createElement('div'); wrap.className = 'table-scroll';
    table.before(wrap); wrap.append(table);
  }
  const headings = [...$('content').querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const slugs = new Map();
  headings.forEach((heading, index) => {
    heading.id = 'heading-' + index;
    const base = slug(heading.textContent);
    const count = slugs.get(base) || 0;
    slugs.set(base, count + 1);
    heading.dataset.sourceAnchor = base + (count ? '-' + count : '');
  });
  $('toc').replaceChildren();
  headings.forEach((heading) => {
    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.textContent = heading.textContent;
    link.dataset.level = heading.tagName.slice(1);
    link.addEventListener('click', (event) => { event.preventDefault(); jumpTo(heading.id); });
    $('toc').append(link);
  });
  $('heading-count').textContent = headings.length;
  if (!headings.length) $('toc').textContent = '没有章节标题';
  filterHeadings();
  for (const button of $('content').querySelectorAll('.copy-code')) {
    button.addEventListener('click', async () => {
      const text = codeContents[Number(button.dataset.code)];
      try { await navigator.clipboard.writeText(text); notify('已复制完整文本'); }
      catch {
        $('copy-fallback').value = text;
        $('copy-dialog').showModal();
        $('copy-fallback').focus();
        $('copy-fallback').select();
        notify('自动复制不可用，已选中文本，请使用系统复制');
      }
    });
  }
  for (const link of $('content').querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (/^https?:\/\//i.test(href)) {
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
    } else {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        let target;
        try { target = decodeURIComponent(href); } catch { notify('链接格式无效'); return; }
        const [file, fragment] = target.split('#');
        if (file) {
          const name = file.split(/[\\/]/).pop();
          const candidates = [...documents.values()].filter((item) => item.name === name);
          const remoteUrl = resolveRemoteTarget(target);
          if (!candidates.length) {
            if (remoteUrl) { openRemoteTarget(remoteUrl); return; }
            notify('请先通过“打开文档”选择链接对应的文件，或设置当前文档的远端地址'); return;
          }
          chooseLinkDocument(target, candidates, fragment, remoteUrl);
          return;
        }
        if (fragment) {
          const found = [...$('content').querySelectorAll('[data-source-anchor]')].find((h) => h.dataset.sourceAnchor === fragment.toLocaleLowerCase());
          if (!found || !jumpTo(found.id)) notify('未找到该标题或锚点');
        }
      });
    }
  }
  observer = new IntersectionObserver(syncOutline, { rootMargin: '-80px 0px -55% 0px' });
  headings.forEach((heading) => observer.observe(heading));
  if (headings[0]) setActiveHeading(headings[0].id);
  updateTextSearch(false);
  icons();
}
function resolveRemoteTarget(target) {
  const entry = documents.get(activeId);
  const base = entry?.remoteUrl || '';
  if (!base) return null;
  try {
    const url = new URL(target, base);
    return /^https?:$/i.test(url.protocol) ? url.href : null;
  } catch { return null; }
}
function openRemoteTarget(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
function chooseLinkDocument(target, candidates, fragment, remoteUrl) {
  $('link-target').textContent = target;
  $('link-choices').replaceChildren();
  candidates.forEach((entry, index) => {
    const button = document.createElement('button');
    button.textContent = entry.name + ' · ' + statusLabel(entry) + (candidates.length > 1 ? ' · 文档 ' + (index + 1) : '');
    button.addEventListener('click', async () => {
      $('link-dialog').close();
      await selectDocument(entry.id);
      if (activeId !== entry.id) return;
      if (fragment) {
        const found = [...$('content').querySelectorAll('[data-source-anchor]')].find(h => h.dataset.sourceAnchor.toLocaleLowerCase() === fragment.toLocaleLowerCase());
        if (!found || !jumpTo(found.id)) notify('未找到该标题或锚点');
      }
    });
    $('link-choices').append(button);
  });
  if (remoteUrl) {
    const button = document.createElement('button');
    button.textContent = '在远端文档中打开';
    button.addEventListener('click', () => { $('link-dialog').close(); openRemoteTarget(remoteUrl); });
    $('link-choices').append(button);
  }
  $('link-dialog').showModal();
}
function updateTextSearch(scroll = true) {
  clearTimeout(searchTimer);
  for (const mark of $('content').querySelectorAll('mark.reader-match')) mark.replaceWith(document.createTextNode(mark.textContent));
  $('content').normalize(); matches = []; matchIndex = -1;
  const query = $('text-search').value.toLocaleLowerCase();
  if (query) {
    const walker = document.createTreeWalker($('content'), NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement.closest('.code-toolbar') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.textContent; const lower = text.toLocaleLowerCase();
      let start = 0; let index = lower.indexOf(query); if (index < 0) continue;
      const fragment = document.createDocumentFragment();
      while (index >= 0 && matches.length < 1000) {
        fragment.append(document.createTextNode(text.slice(start, index)));
        const mark = document.createElement('mark'); mark.className = 'reader-match'; mark.textContent = text.slice(index, index + query.length);
        fragment.append(mark); matches.push(mark); start = index + query.length; index = lower.indexOf(query, start);
      }
      fragment.append(document.createTextNode(text.slice(start))); node.replaceWith(fragment);
      if (matches.length >= 1000) break;
    }
  }
  moveMatch(0, scroll);
}
function moveMatch(direction, scroll = true) {
  matches[matchIndex]?.classList.remove('current');
  matchIndex = matches.length ? (matchIndex + direction + matches.length) % matches.length : -1;
  if (matches.length && direction === 0) matchIndex = 0;
  matches[matchIndex]?.classList.add('current');
  $('match-count').textContent = (matchIndex + 1) + ' / ' + matches.length + (matches.length === 1000 ? '+' : '');
  $('previous-match').disabled = $('next-match').disabled = !matches.length;
  if (scroll) matches[matchIndex]?.scrollIntoView({ block: 'center', behavior: 'instant' });
}
function savePosition() {
  if (!contentReady) return;
  const entry = documents.get(activeId); if (!entry) return;
  entry.position = window.scrollY;
  if (entry.saved) storageSet('reader-position-' + entry.id, String(entry.position));
}
function restorePosition(entry) {
  const value = entry.position ?? Number(storageGet('reader-position-' + entry.id) || 0);
  window.scrollTo(0, Number.isFinite(value) ? Math.max(0, value) : 0);
}
function filterHeadings() {
  const term = $('heading-search').value.trim().toLocaleLowerCase();
  $('toc').querySelectorAll('a').forEach((link) => { link.hidden = !link.textContent.toLocaleLowerCase().includes(term); });
}
async function readFile(file) {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error('仅支持 Markdown 或纯文本文件');
  if (file.size > MAX_BYTES) throw new Error('文件超过 8 MB，未载入');
  const bytes = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n'); }
  catch { throw new Error('文件不是有效 UTF-8 编码，未载入'); }
}
async function refreshEntry(entry, requestPermission = false) {
  const revision = (entry.readRevision || 0) + 1;
  entry.readRevision = revision;
  try {
  const permission = requestPermission
    ? await entry.handle.requestPermission({ mode: 'read' })
    : await entry.handle.queryPermission({ mode: 'read' });
  if (permission !== 'granted') {
    if (entry.readRevision === revision) entry.error = '需要重新授权';
    return false;
  }
  const file = await entry.handle.getFile();
  const text = await readFile(file);
  if (entry.readRevision !== revision) return false;
  entry.text = text;
  entry.modified = file.lastModified;
  entry.readAt = new Date();
  entry.error = '';
  await persist(entry);
  return true;
  } catch (error) {
    if (entry.readRevision === revision) {
      entry.error = error.name === 'NotFoundError' ? '原文件已移动或删除，请重新选择' : '读取失败：' + error.message;
    }
    return false;
  }
}
function showEntryState(entry) {
  $('file-name').textContent = entry.name;
  $('source-state').textContent = statusLabel(entry) + (entry.readAt ? ' · ' + entry.readAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' 读取' : '');
  $('refresh').disabled = false;
  $('set-remote').disabled = false;
  if (entry.error) note(entry.error + (entry.text ? '；当前显示上次成功读取的内容。' : ''), () => refreshCurrent(true), '重新授权 / 重试');
  else if (entry.kind === 'session') note('本次载入的文件副本；读取最新版本需重新选择文件。', () => chooseReplacement(entry.id), '重新选择');
  else if (!entry.saved) note('浏览器未能记住文件授权，关闭页面后需要重新选择。');
  else note('');
}
function showEmpty() {
  ++renderVersion;
  activeId = null;
  contentReady = false;
  observer?.disconnect();
  codeContents = [];
  selectedHeading = '';
  storageSet('reader-last-file', '');
  $('content').replaceChildren(); $('toc').replaceChildren();
  $('file-name').textContent = ''; $('source-state').textContent = '';
  $('heading-count').textContent = '0';
  $('heading-search').value = ''; $('text-search').value = '';
  updateTextSearch(false);
  $('find-bar').hidden = true;
  $('find-text').setAttribute('aria-expanded', 'false');
  $('find-text').disabled = $('refresh').disabled = $('set-remote').disabled = true;
  $('empty-state').hidden = false;
  document.querySelector('.document-end').hidden = true;
  note(''); renderDocuments();
  window.scrollTo(0, 0);
}
async function selectDocument(id) {
  const entry = documents.get(id);
  if (!entry) return;
  savePosition();
  contentReady = false;
  observer?.disconnect();
  const version = ++renderVersion;
  activeId = id;
  $('empty-state').hidden = true;
  document.querySelector('.document-end').hidden = false;
  $('find-text').disabled = false;
  storageSet('reader-last-file', id);
  $('content').replaceChildren(); $('toc').replaceChildren();
  $('file-name').textContent = entry.name; $('source-state').textContent = '正在读取';
  $('refresh').disabled = true;
  $('heading-count').textContent = ''; note('');
  if (entry.handle) await refreshEntry(entry);
  if (version !== renderVersion) return;
  $('heading-search').value = '';
  $('text-search').value = '';
  showEntryState(entry); renderContent(entry); renderDocuments();
  restorePosition(entry); contentReady = true;
}
let refreshing = false;
async function refreshCurrent(requestPermission = false) {
  const entry = documents.get(activeId);
  if (!entry || refreshing || importBusy || !contentReady) return;
  if (!entry.handle) { if (requestPermission) chooseReplacement(entry.id); return; }
  refreshing = true;
  const version = renderVersion;
  const previous = entry.text;
  const position = window.scrollY;
  try { await refreshEntry(entry, requestPermission); }
  finally { refreshing = false; }
  if (version !== renderVersion || activeId !== entry.id) return;
  showEntryState(entry); renderDocuments();
  if (previous !== entry.text) { renderContent(entry); window.scrollTo(0, position); if (!entry.error) notify('已载入最新内容'); }
  else if (requestPermission && !entry.error) notify('已重新读取，内容没有变化');
}
async function addSessionFiles(files) {
  if (importBusy) return;
  importBusy = true;
  const replace = documents.get(replacementId); replacementId = null;
  let last;
  for (const file of files) {
    try {
      if (replace && (files.length !== 1 || file.name !== replace.name)) { notify('请选择同名原文件，当前文档未替换'); break; }
      const entry = { id: replace?.id || crypto.randomUUID(), name: file.name, kind: 'session', text: await readFile(file), readAt: new Date(), position: replace?.position, remoteUrl: replace?.remoteUrl || '' };
      documents.set(entry.id, entry); last = entry.id;
    } catch (error) { notify(file.name + '：' + error.message); }
  }
  importBusy = false;
  if (last) await selectDocument(last);
}
function chooseReplacement(id) {
  replacementId = id; $('file-input').multiple = false; $('file-input').click();
}
function chooseOrdinaryFiles() {
  replacementId = null; $('file-input').multiple = true; $('file-input').click();
}
async function openFiles() {
  if (importBusy) return;
  if (!window.showOpenFilePicker) { chooseOrdinaryFiles(); return; }
  importBusy = true;
  try {
    const handles = await window.showOpenFilePicker({ multiple: true, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.txt'] } }] });
    let last;
    for (const handle of handles) {
      try {
        let existing;
        for (const entry of documents.values()) if (entry.handle && await entry.handle.isSameEntry(handle)) { existing = entry; break; }
        const entry = existing || { id: crypto.randomUUID(), name: handle.name, handle, kind: 'handle' };
        await refreshEntry(entry);
        entry.saved = await persist(entry);
        documents.set(entry.id, entry); await persistDocumentOrder(); last = entry.id;
      } catch (error) { notify(handle.name + '：' + error.message); }
    }
    if (last) await selectDocument(last);
  } catch (error) {
    if (error.name === 'AbortError') return;
    notify('文件授权不可用，已切换普通文件选择'); chooseOrdinaryFiles();
  } finally { importBusy = false; }
}
function closePanels() {
  document.body.classList.remove('show-library', 'show-outline');
  $('toggle-library').setAttribute('aria-expanded', 'false');
  $('toggle-outline').setAttribute('aria-expanded', 'false');
}
$('open-files').addEventListener('click', openFiles);
$('empty-open').addEventListener('click', openFiles);
$('file-input').addEventListener('change', async (event) => { await addSessionFiles([...event.target.files]); event.target.value = ''; });
$('refresh').addEventListener('click', () => refreshCurrent(true));
$('set-remote').addEventListener('click', () => {
  const entry = documents.get(activeId);
  if (!entry) return;
  $('remote-url').value = entry.remoteUrl || '';
  $('remote-dialog').showModal();
  $('remote-url').focus();
});
$('document-search').addEventListener('input', renderDocuments);
$('heading-search').addEventListener('input', filterHeadings);
$('back-top').addEventListener('click', () => { window.scrollTo(0, 0); syncOutline(); });
window.addEventListener('scroll', () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; if (contentReady) syncOutline(); });
}, { passive: true });
$('close-copy').addEventListener('click', () => $('copy-dialog').close());
$('close-link').addEventListener('click', () => $('link-dialog').close());
$('close-remote').addEventListener('click', () => $('remote-dialog').close());
$('clear-remote').addEventListener('click', async () => {
  const entry = documents.get(activeId); if (!entry) return;
  entry.remoteUrl = ''; await persist(entry); $('remote-dialog').close(); notify('已清除当前文档的远端地址');
});
$('save-remote').addEventListener('click', async () => {
  const entry = documents.get(activeId); if (!entry) return;
  const value = $('remote-url').value.trim();
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) throw new Error('仅支持 HTTP 或 HTTPS 地址');
    entry.remoteUrl = url.href; await persist(entry); $('remote-dialog').close(); notify('已保存当前文档的远端地址');
  } catch (error) { notify('远端地址无效：' + error.message); }
});
$('find-text').addEventListener('click', () => {
  $('find-bar').hidden = !$('find-bar').hidden;
  $('find-text').setAttribute('aria-expanded', String(!$('find-bar').hidden));
  if (!$('find-bar').hidden) $('text-search').focus();
});
$('text-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(updateTextSearch, 180); });
$('text-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); moveMatch(event.shiftKey ? -1 : 1); } });
$('previous-match').addEventListener('click', () => moveMatch(-1));
$('next-match').addEventListener('click', () => moveMatch(1));
$('close-find').addEventListener('click', () => { $('find-bar').hidden = true; $('find-text').setAttribute('aria-expanded', 'false'); $('text-search').value = ''; updateTextSearch(false); });
$('theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme; storageSet('reader-theme', theme);
});
for (const panel of ['library', 'outline']) $('toggle-' + panel).addEventListener('click', () => {
  const wasOpen = document.body.classList.contains('show-' + panel);
  closePanels();
  if (!wasOpen) { document.body.classList.add('show-' + panel); $('toggle-' + panel).setAttribute('aria-expanded', 'true'); }
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePanels(); });
window.addEventListener('focus', () => refreshCurrent());
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCurrent(); });
document.documentElement.dataset.theme = storageGet('reader-theme') || 'light';
async function init() {
  const remembered = storageGet('reader-last-file');
  showEmpty();
  const initialVersion = renderVersion;
  try {
    database = await openDatabase();
    const entries = (await restoredEntries()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const entry of entries) documents.set(entry.id, { ...entry, kind: 'handle', saved: true, text: entry.text || '', error: '' });
    if (renderVersion === initialVersion && documents.size) {
      await selectDocument(documents.has(remembered) ? remembered : documents.keys().next().value);
    }
    else renderDocuments();
  } catch { database = null; }
  window.addEventListener('pagehide', () => { savePosition(); storageSet('reader-last-file', activeId); });
}
init();
