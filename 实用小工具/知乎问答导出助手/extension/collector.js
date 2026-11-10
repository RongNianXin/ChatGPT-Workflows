/* Original local prototype. No external libraries, signature forging or credential extraction. */
async function aiOutpostReadOnlyExport(options = {}) {
  const testing = options.testMode === true;
  const pageMatch = typeof location !== "undefined"
    ? location.pathname.match(/^\/question\/(\d+)(?:\/answer\/(\d+))?\/?$/) : null;
  const Q = testing ? String(options.questionId || "304592543") : pageMatch?.[1];
  let sampleCurrentAnswer = options.sampleCurrentAnswer === true || options.mode === "single";
  let sampleId = sampleCurrentAnswer ? String(options.selectedAnswerId || pageMatch?.[2] || "") : null;
  let shortRun = options.diagnosticShortRun === true || (sampleCurrentAnswer && options.mode !== "single");
  if (options.showMenu === true && !testing) {
    if (location.origin !== "https://www.zhihu.com" || !pageMatch) return;
    if (document.getElementById("ai-outpost-readonly-export")) return;
    const menu = document.createElement("section");
    menu.id = "ai-outpost-readonly-export";
    menu.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#fff;color:#173847;border:2px solid #28796f;border-radius:10px;padding:16px;max-width:390px;font:15px/1.6 sans-serif";
    const title = document.createElement("div"), hint = document.createElement("p");
    title.style.paddingRight = "30px";
    const menuCross = document.createElement("button");
    menuCross.textContent = "×";
    menuCross.ariaLabel = "关闭选择菜单";
    menuCross.title = "关闭选择菜单";
    menuCross.style.cssText = "position:absolute;right:8px;top:6px;width:28px;height:28px;padding:0;border:0;background:#fff;color:#173847;font:24px/28px sans-serif;cursor:pointer";
    title.textContent = "知乎只读导出 0.6.7：选择扫描范围";
    hint.textContent = "两个选项都包含问题原文、对应回答及其下正常返回的评论和楼中楼。选择后才发出请求。";
    let initial;
    try { initial = JSON.parse(document.getElementById("js-initialData")?.textContent || "null"); } catch {}
    const questionTitle = initial?.initialState?.entities?.questions?.[Q]?.title;
    if (typeof questionTitle === "string") title.textContent += `：《${questionTitle}》`;
    const currentId = pageMatch[2];
    const currentAnswer = initial?.initialState?.entities?.answers?.[currentId];
    const hasCurrentAnswer = !!currentId && currentAnswer?.type === "answer" &&
      String(currentAnswer.question?.id) === Q &&
      ((typeof currentAnswer.id === "string" && /^\d+$/.test(currentAnswer.id)) ||
       (typeof currentAnswer.id === "number" && Number.isSafeInteger(currentAnswer.id))) &&
      String(currentAnswer.id) === currentId;
    const single = document.createElement("button"), whole = document.createElement("button");
    single.textContent = "1. 检索这个帖子的原文以及当前的这一篇回答";
    whole.textContent = "2. 检索这个帖子的原文以及所有的回答";
    if (!hasCurrentAnswer) hint.textContent += " 当前不能唯一确定这一篇回答；可打开想看的具体回答后选第1项，或直接选第2项。";
    menu.append(title, menuCross, hint, single, whole);
    document.body.append(menu);
    const choice = await new Promise(resolve => {
      single.onclick = () => {
        if (!hasCurrentAnswer) { hint.textContent = "当前不能唯一确定这一篇回答。请打开想看的具体回答后选第1项；检索整个问题可直接点第2项。"; return; }
        resolve({mode: "single", id: currentId});
      };
      whole.onclick = () => resolve({mode: "question"});
      menuCross.onclick = () => resolve(null);
    });
    menu.remove();
    if (!choice) return {runStatus: "menu_closed"};
    options = {...options, mode: choice.mode, selectedAnswerId: choice.id,
      expectedQuestionId: options.expectedQuestionId ?? Q,
      expectedAnswerId: Object.hasOwn(options, "expectedAnswerId") ? options.expectedAnswerId : pageMatch[2] || null};
    sampleCurrentAnswer = choice.mode === "single";
    sampleId = sampleCurrentAnswer ? choice.id : null;
    shortRun = false;
  }
  const requestLimit = shortRun ? 30 : 1000;
  const origin = "https://www.zhihu.com";
  let box, label, runHeading, saveButton, stopButton, closeButton, downloadUrl, activeController, wakeWait;
  let cancelled = false, closeRequested = false, finished = false;
  if (!testing) {
    if (location.origin !== origin || !pageMatch) return;
    if (document.getElementById("ai-outpost-readonly-export")) return;
    box = document.createElement("section");
    box.id = "ai-outpost-readonly-export";
    box.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#fff;color:#173847;border:2px solid #28796f;border-radius:10px;padding:16px;max-width:350px;font:15px/1.6 sans-serif;box-shadow:0 4px 24px #0003";
    const heading = document.createElement("div");
    runHeading = heading;
    heading.textContent = `知乎只读导出 0.6.7：${sampleCurrentAnswer && !shortRun ? `单篇回答${sampleId}` : sampleCurrentAnswer ? "单回答评论短测，最多30次请求" : shortRun ? "诊断短测，最多30次请求" : "整题采集"}${!shortRun ? "，最多1000次／20分钟" : ""}`;
    heading.style.paddingRight = "30px";
    closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.ariaLabel = "关闭结果面板";
    closeButton.title = "放弃本次采集并关闭，不下载未完成结果";
    closeButton.disabled = false;
    closeButton.style.cssText = "position:absolute;right:8px;top:6px;width:28px;height:28px;padding:0;border:0;background:transparent;color:#173847;font:24px/28px sans-serif;cursor:pointer";
    closeButton.onclick = () => {
      if (finished) { if (downloadUrl) URL.revokeObjectURL(downloadUrl); box.remove(); return; }
      closeRequested = true;
      cancelled = true;
      activeController?.abort();
      wakeWait?.();
      // Keep the hidden guard until cancellation settles, preventing overlapping restarts.
      box.style.display = "none";
    };
    label = document.createElement("p");
    const stop = document.createElement("button");
    stop.textContent = "停止并保存已有数据";
    stopButton = stop;
    stop.onclick = () => {
      cancelled = true;
      activeController?.abort();
      wakeWait?.();
      label.textContent = "正在停止，保留已读取数据……";
    };
    saveButton = document.createElement("button");
    saveButton.textContent = "保存当前进度JSON";
    box.append(heading, closeButton, label, stop, saveButton);
    document.body.append(box);
  }
  const clock = () => typeof performance !== "undefined" ? performance.now() : Date.now();
  const startedClock = clock();
  const minRequestGapMs = 1500;
  const maxRunMs = 20 * 60 * 1000;
  const totalLimitReached = () => clock() - startedClock >= maxRunMs;
  let lastRequestStart = null, lastRequestEnd = null, accumulatedWaitMs = 0, accumulatedRequestMs = 0;
  const report = {
    schemaVersion: 3, exporterVersion: "0.6.7", prototype: true, questionId: Q,
    collectionScope: {kind: sampleCurrentAnswer ? "single_answer_comments" : "question", answerId: sampleId},
    startedAt: new Date().toISOString(), finishedAt: null,
    question: null, answers: [], requests: [], stoppedReason: null,
    answerListReachedEnd: false, complete: false, runStatus: "running",
    issues: [], paginationEvents: [], answerListNotes: [],
    scope: "Only normally returned visible content. Deleted/restricted items cannot be restored.",
    privacy: "Local file. Request diagnostics omit headers, cookies, account state and raw query values. Content HTML retains its original links.",
    media: "HTML image references retained; this version does not download images or video.",
    mediaPolicy: {video: "not_collected_or_transcribed", imageBytes: "not_downloaded",
      emptyBody: "unknown_unless_independently_verified; never assume video"},
    diagnostics: {
      version: 1,
      run: {mode: shortRun ? "diagnostic_short" : sampleCurrentAnswer ? "single_full" : "question_full", requestLimit, plannedStop: false},
      answers: {initial: [], pages: [], counters: {}, unsupportedReturnedCount: 0},
      commentPages: []
    }
  };
  const answerMap = new Map(), rootOwners = new Map();
  const seenRequests = new Set();
  const cursorLabels = new Map();
  let requestCount = 0;
  const sleep = testing ? async () => {} : (ms) => new Promise(resolve => {
    const done = () => { clearTimeout(timer); wakeWait = null; resolve(); };
    const timer = setTimeout(done, ms);
    wakeWait = done;
  });
  const update = (message) => { if (label) label.textContent = message; };
  const requireId = (id) => {
    if (typeof id === "number" && !Number.isSafeInteger(id))
      throw new Error("编号超出安全整数范围，不能确认原始编号");
    const value = String(id ?? "");
    if (!/^\d+$/.test(value)) throw new Error("响应中的编号无效");
    return value;
  };
  const requireCount = (value) => {
    if (!((typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) &&
        Number.isSafeInteger(Number(value)) && Number(value) >= 0))
      throw new Error("响应中的数量缺失或无效，不能核对完整性");
    return Number(value);
  };
  const fail = (code, message) => Object.assign(new Error(message), { code });
  // Diagnostic values are projected explicitly; never copy arbitrary response fields.
  const safeId = value => ((typeof value === "string" && /^\d+$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)) ? String(value) : null;
  const safeCount = value => (typeof value === "number" ||
    (typeof value === "string" && /^\d+$/.test(value))) &&
    Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const safeType = value => ["answer", "feed", "comment", "article", "advertisement", "question"].includes(value)
    ? value : value == null ? "missing" : "other";
  const counters = b => ({
    total: safeCount(b.counts?.total_counts ?? b.paging?.totals),
    collapsed: safeCount(b.counts?.collapsed_counts),
    reviewing: safeCount(b.counts?.reviewing_counts)
  });
  const environment = () => {
    let visibility = "unknown", focus = "unknown";
    try {
      if (typeof document !== "undefined") {
        if (["visible", "hidden", "prerender"].includes(document.visibilityState))
          visibility = document.visibilityState;
        const focused = typeof document.hasFocus === "function" ? document.hasFocus() : null;
        if (typeof focused === "boolean") focus = focused ? "focused" : "unfocused";
      }
    } catch { /* Missing DOM capabilities stay unknown. */ }
    return {visibility, focus};
  };
  const observeQuestion = () => {
    if (testing) return safeCount(options.initial?.initialState?.entities?.questions?.[Q]?.answerCount);
    try {
      return safeCount(JSON.parse(document.getElementById("js-initialData")?.textContent || "null")
        ?.initialState?.entities?.questions?.[Q]?.answerCount);
    } catch { return null; }
  };
  const recoverable = error => ["PAGE_REPEAT", "PAGE_NO_END", "PAGE_NO_PROGRESS"].includes(error?.code);
  const noteIssue = (answer, scope, error) => {
    const message = `${scope}：${String(error?.message || error)}`;
    answer.notes.push(message);
    report.issues.push({ answerId: answer.id, scope, code: error.code || "FATAL", message });
  };
  const download = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: "application/json"}));
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `知乎-${Q}-${sampleCurrentAnswer ? `单回答-${sampleId || "未知"}-` : "整题-"}${shortRun ? "诊断短测-" : ""}${report.runStatus === "running" ? "进行中" : report.complete || report.selectedAnswerComplete ? "已核齐文字" : "部分数据"}-${Date.now()}.json`;
    a.click();
  };
  if (saveButton) saveButton.onclick = download;
  function allowed(url, expectedPath) {
    const u = new URL(url, origin);
    if (u.origin !== origin || u.username || u.password || u.pathname !== expectedPath)
      throw new Error("响应中的下一页不属于当前读取范围，已停止");
    return u;
  }
  function canonical(u) {
    const value = new URL(u.href);
    value.hash = "";
    value.searchParams.sort();
    return value.href;
  }
  function describe(u) {
    // Labels show equality and progress without exporting cursor/session values.
    const raw = JSON.stringify(["cursor", "offset", "order", "order_by"].map(k => [k, u.searchParams.get(k)]));
    if (!cursorLabels.has(raw)) cursorLabels.set(raw, `cursor-${cursorLabels.size + 1}`);
    return { path: u.pathname, cursorTag: cursorLabels.get(raw) };
  }
  async function request(url, expectedPath, format = "json") {
    const checkPage = () => {
      if (!testing && (location.origin !== origin ||
          !new RegExp(sampleCurrentAnswer && pageMatch?.[2] ? `^/question/${Q}/answer/${pageMatch[2]}/?$` :
            `^/question/${Q}(?:/answer/\\d+)?/?$`).test(location.pathname)))
        throw fail("PAGE_CHANGED", "目标页面已切换，停止本次读取并保留已有数据");
    };
    checkPage();
    const u = allowed(url, expectedPath);
    if (cancelled) throw fail("CANCELLED", "操作者停止");
    if (requestCount >= requestLimit) {
      if (shortRun) throw fail("DIAGNOSTIC_LIMIT", "诊断短测已按计划达到30次请求上限，保留部分数据；不代表整题采集失败或完成");
      throw fail("LIMIT", "已达到本次1000次请求上限，保留部分数据");
    }
    if (totalLimitReached())
      throw fail("LIMIT", "已达到本次20分钟上限，保留部分数据");
    const requestKey = canonical(u);
    if (seenRequests.has(requestKey)) {
      report.paginationEvents.push({...describe(u), event: "repeat_blocked_before_request"});
      throw fail("PAGE_REPEAT", "下一页重复，无法确认分页完整");
    }
    // Keep serial requests >=1500ms apart at their start; the preceding request
    // already consumes part/all of that interval, so do not sleep another1500ms.
    const beforeWait = clock(), environmentBeforeWait = environment();
    const processingGapMs = lastRequestEnd === null ? null : Math.max(0, beforeWait - lastRequestEnd);
    const plannedWaitMs = lastRequestStart === null ? 0 :
      Math.ceil(Math.max(0, minRequestGapMs - (beforeWait - lastRequestStart)));
    if (!testing && lastRequestStart !== null) {
      let remaining = plannedWaitMs;
      while (remaining > 0 && !cancelled) {
        await sleep(remaining);
        remaining = Math.ceil(Math.max(0, minRequestGapMs - (clock() - lastRequestStart)));
      }
    }
    const actualWaitMs = Math.max(0, clock() - beforeWait);
    accumulatedWaitMs += actualWaitMs;
    if (cancelled) throw fail("CANCELLED", "操作者停止");
    if (totalLimitReached())
      throw fail("LIMIT", "已达到本次20分钟上限，保留部分数据");
    checkPage();
    seenRequests.add(requestKey);
    requestCount++;
    const requestStart = clock();
    const startGapMs = lastRequestStart === null ? null : requestStart - lastRequestStart;
    lastRequestStart = requestStart;
    const controller = new AbortController();
    activeController = controller;
    const remainingRunMs = Math.max(1, maxRunMs - (requestStart - startedClock));
    const timer = setTimeout(() => controller.abort(), Math.min(20000, remainingRunMs));
    const diagnostic = {...describe(u), index: requestCount, status: null,
      startedAfterMs: Math.round(requestStart - startedClock), startGapMs,
      plannedWaitMs, actualWaitMs: Math.round(actualWaitMs),
      waitOverrunMs: Math.round(Math.max(0, actualWaitMs - plannedWaitMs)),
      processingGapMs: processingGapMs === null ? null : Math.round(processingGapMs),
      environmentBeforeWait, environmentAtStart: environment()};
    report.requests.push(diagnostic);
    try {
      // Browser supplies its normal same-origin session. No explicit Cookie/header capture.
      let response;
      try {
        response = await (testing ? options.fetch : fetch)(u.href, {
          method: "GET", credentials: "same-origin", redirect: "error", signal: controller.signal
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) throw error;
        throw fail("REQUEST_FAILED", "网络请求失败，停止本次读取；不保存底层错误原文、不重试");
      }
      diagnostic.status = safeCount(response.status);
      if (!response.ok) throw fail("HTTP_STOP", `HTTP ${diagnostic.status ?? "未知"}，停止本次读取；不重试或切换通道`);
      let data;
      try { data = format === "html" ? await response.text() : await response.json(); }
      catch (error) {
        if (cancelled || controller.signal.aborted) throw error;
        throw fail("INVALID_RESPONSE", "响应JSON解析失败，停止本次读取；不保存错误或响应片段");
      }
      if (cancelled) throw fail("CANCELLED", "操作者停止");
      if (totalLimitReached()) throw fail("LIMIT", "已达到本次20分钟上限，保留部分数据");
      if (controller.signal.aborted) throw fail("TIMEOUT", "请求超时（20秒），停止本次读取并保留已有数据");
      checkPage();
      if (format === "html") { diagnostic.responseKind = "question_page_initial_data"; return data; }
      if (!data || typeof data !== "object") throw new Error("返回内容格式异常");
      diagnostic.returnedCount = Array.isArray(data.data) ? data.data.length : null;
      diagnostic.firstId = safeId(data.data?.[0]?.id ?? data.data?.[0]?.target?.id);
      diagnostic.lastId = safeId(data.data?.at(-1)?.id ?? data.data?.at(-1)?.target?.id);
      diagnostic.isEnd = typeof data.paging?.is_end === "boolean" ? data.paging.is_end : null;
      diagnostic.reportedTotal = counters(data).total;
      diagnostic.sort = ["score", "ts"].includes(u.searchParams.get("order_by")) ? u.searchParams.get("order_by") : null;
      diagnostic.collapsedCount = counters(data).collapsed;
      diagnostic.reviewingCount = counters(data).reviewing;
      if (typeof data.paging?.next === "string") {
        const next = allowed(data.paging.next, expectedPath);
        diagnostic.nextCursorTag = describe(next).cursorTag;
        diagnostic.nextAlreadyRequested = seenRequests.has(canonical(next));
      }
      return data;
    } catch (error) {
      if (cancelled) {
        diagnostic.errorCode = "CANCELLED";
        throw fail("CANCELLED", "操作者停止");
      }
      diagnostic.errorCode = totalLimitReached() ? "LIMIT" : controller.signal.aborted ? "TIMEOUT" :
        ["HTTP_STOP", "PAGE_REPEAT", "PAGE_NO_END", "PAGE_NO_PROGRESS", "INVALID_RESPONSE", "PAGE_CHANGED"].includes(error.code) ? error.code : "REQUEST_FAILED";
      if (totalLimitReached()) throw fail("LIMIT", "已达到本次20分钟上限，保留部分数据");
      if (controller.signal.aborted) throw fail("TIMEOUT", "请求超时（20秒），停止本次读取并保留已有数据");
      throw error;
    } finally {
      const duration = Math.max(0, clock() - requestStart);
      diagnostic.durationMs = Math.round(duration);
      diagnostic.environmentAtEnd = environment();
      lastRequestEnd = clock();
      accumulatedRequestMs += duration;
      clearTimeout(timer); activeController = null;
    }
  }
  function imageRepresentation(html) {
    // Only the observed CDN/source form is comparable; unfamiliar markup stays unequal.
    const withoutImageFallbacks = html.replace(/<noscript>\s*<img\b[^<>]*>\s*<\/noscript>/gi, "");
    if (/<\/?noscript\b/i.test(withoutImageFallbacks) ||
        /<\s*(?:script|style|textarea|title|xmp|iframe|noembed|noframes|plaintext)\b|<!--/i.test(html)) return JSON.stringify([html]);
    const edits = [];
    html.replace(/<[a-zA-Z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>/g, (tag, tagOffset) => {
      if (!/^<img\s/i.test(tag) ||
          !/^<img(?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>$/i.test(tag)) return tag;
      tag.replace(/(\s[\w:-]+\s*=\s*)(["'])(.*?)\2/g, (match, prefix, quote, value, attrOffset) => {
        const name = prefix.trim().split(/\s*=/)[0].toLowerCase();
        if (!["src", "data-original", "data-actualsrc", "data-default-watermark-src"].includes(name) ||
            !/^https:\/\/pic(?:1|x|a)\.zhimg\.com\/[^\s"'<>\\?#]+\?source=[a-f0-9]{8}$/.test(value)) return match;
        const start = tagOffset + attrOffset + prefix.length + quote.length;
        edits.push({start, end: start + value.length,
          path: value.slice(value.indexOf("/", 8), value.indexOf("?"))});
        return match;
      });
      return tag;
    });
    const parts = [];
    let end = 0;
    for (const edit of edits) {
      parts.push(html.slice(end, edit.start), {imagePath: edit.path});
      end = edit.end;
    }
    parts.push(html.slice(end));
    return JSON.stringify(parts);
  }
  function putAnswer(a) {
    if (!a || a.type !== "answer") return "skipped";
    if (String(a.question?.id) !== Q) throw new Error("回答归属与当前问题不符");
    const id = requireId(a.id);
    const declaredCommentCount = requireCount(a.commentCount ?? a.comment_count);
    const item = {
      id, author: a.author?.name || "", contentHtml: typeof a.content === "string" ? a.content : "",
      bodyStatus: typeof a.content === "string" && a.content ? "html_present" : "empty_unknown",
      truncated: a.contentNeedTruncated ?? a.content_need_truncated ?? null,
      declaredCommentCount, observedCommentCounts: [declaredCommentCount],
      comments: [], commentPagesReachedEnd: false, commentsComplete: false,
      commentStatus: "not_started", replyGroups: [], notes: [], warnings: [],
      commentVariants: [], answerVariants: [], foldedPagesReachedEnd: null
    };
    if (item.bodyStatus === "empty_unknown")
      item.warnings.push("未取得文字正文，类型待确认；视频不读取或转写，但不能仅凭空正文认定为视频");
    const old = answerMap.get(id);
    if (!old) { answerMap.set(id, item); report.answers.push(item); return "accepted"; }
    if (!old.observedCommentCounts.includes(declaredCommentCount)) {
      old.observedCommentCounts.push(declaredCommentCount);
      old.notes.push("回答列表中同一回答的声明评论数发生变化，暂不确认完整");
    }
    if ((old.contentHtml !== item.contentHtml || old.truncated !== item.truncated) &&
        !old.answerVariants.some(v => v.observed.contentHtml === item.contentHtml && v.observed.truncated === item.truncated)) {
      const imageOnly = old.truncated === item.truncated &&
        imageRepresentation(old.contentHtml) === imageRepresentation(item.contentHtml);
      old.answerVariants.push({kind: imageOnly ? "image_url_representation" : "body_or_truncation_change",
        previous: {contentHtml: old.contentHtml, truncated: old.truncated},
        observed: {contentHtml: item.contentHtml, truncated: item.truncated}, requestIndex: requestCount});
      if (imageOnly) old.warnings.push("图片链接的已知CDN域名或source参数不同，两版保留；不代表图片字节已核验");
      else old.notes.push("同一回答返回了不同正文或截断标志，两个版本均保留，暂不确认完整");
    }
    if (item.contentHtml.length > old.contentHtml.length) {
      old.contentHtml = item.contentHtml; old.truncated = item.truncated; old.bodyStatus = item.bodyStatus;
      return "updated_longer";
    }
    return "duplicate";
  }
  function observeAnswer(a, record, eligible = true) {
    record.outcome = "rejected";
    record.reason = "validation_failed";
    if (!eligible || !a || a.type !== "answer") {
      record.outcome = "skipped";
      record.reason = eligible ? "initial_not_answer" : "target_not_answer";
      return;
    }
    if (String(a.question?.id) !== Q) record.reason = "question_mismatch";
    else if (safeId(a.id) === null) record.reason = "invalid_id";
    record.outcome = putAnswer(a);
    record.reason = {accepted: "new_id", updated_longer: "longer_content", duplicate: "existing_id"}[record.outcome];
  }
  function putComment(c, map, rootId, observation) {
    if (observation) observation.outcome = "rejected";
    const id = requireId(c.id);
    const root = requireId(c.reply_root_comment_id || rootId || id);
    if (typeof c.content !== "string") throw new Error("评论正文缺失");
    const item = {
      id, author: c.author?.name || "", contentHtml: c.content,
      replyToId: requireId(c.reply_comment_id),
      rootId: root, declaredChildCount: Number(c.child_comment_count || 0)
    };
    if (rootId && (root !== rootId || id === rootId || item.replyToId === "0"))
      throw new Error("内嵌楼中楼归属不符");
    const old = map.get(id);
    if (old && (old.contentHtml !== item.contentHtml || old.replyToId !== item.replyToId || old.rootId !== root)) {
      const relationChanged = old.replyToId !== item.replyToId || old.rootId !== root;
      const variant = {
        id, kind: relationChanged ? "relation_conflict" : "content_variant",
        previous: {contentHtml: old.contentHtml, replyToId: old.replyToId, rootId: old.rootId},
        observed: {contentHtml: item.contentHtml, replyToId: item.replyToId, rootId: item.rootId},
        requestIndex: requestCount
      };
      if (!activeAnswer.commentVariants.some(x => x.id === id &&
          JSON.stringify(x.observed) === JSON.stringify(variant.observed))) {
        activeAnswer.commentVariants.push(variant);
        const message = `评论${id}${relationChanged ? "关联字段不同，未裁定归属" : "返回了不同HTML，两个版本均保留"}`;
        (relationChanged ? activeAnswer.notes : activeAnswer.warnings).push(message);
      }
      // Do not replace the first observed record or silently discard the other.
      if (observation) observation.outcome = relationChanged ? "relation_conflict" : "content_variant";
      return id;
    }
    map.set(id, item);
    if (observation) observation.outcome = old ? "duplicate" : "accepted";
    return id;
  }
  async function pages(initial, path, onData) {
    let next = initial;
    const pageIdsSeen = new Set();
    for (;;) {
      const b = await request(next, path);
      if (!Array.isArray(b.data)) throw new Error("分页正文缺失");
      const ids = JSON.stringify(b.data.map(x => String(x.id ?? x.target?.id ?? "")));
      const repeatedBody = pageIdsSeen.has(ids);
      pageIdsSeen.add(ids);
      const added = onData(b);
      if (b.paging?.is_end === true) return true;
      if (!b.data.length || typeof b.paging?.next !== "string") throw fail("PAGE_NO_END", "没有末页证据");
      // The first child page may legitimately repeat already embedded replies.
      if (added === 0 && repeatedBody)
        throw fail("PAGE_NO_PROGRESS", "页面记录重复且没有新增记录，无法确认分页继续");
      allowed(b.paging.next, path);
      next = b.paging.next;
    }
  }
  let activeAnswer = null;
  try {
    if (!testing) {
      const current = location.pathname.match(/^\/question\/(\d+)(?:\/answer\/(\d+))?\/?$/);
      if (location.origin !== origin || !current || current[1] !== Q ||
          (current[2] || null) !== (pageMatch?.[2] || null))
        throw fail("PAGE_CHANGED", "选择期间目标页面发生变化，未启动请求；请重新打开菜单");
    }
    if ((options.expectedQuestionId != null && options.expectedQuestionId !== Q) ||
        (Object.hasOwn(options, "expectedAnswerId") && options.expectedAnswerId !== (pageMatch?.[2] || null)))
      throw fail("PAGE_CHANGED", "点击后目标页面发生变化，未启动请求；请返回原目标页面");
    if (sampleCurrentAnswer && !sampleId)
      throw fail("SAMPLE_PAGE_REQUIRED", "单回答短测只允许在当前问题的具体回答页启动，未请求任何接口");
    let initial;
    try {
      initial = testing ? options.initial :
        JSON.parse(document.getElementById("js-initialData")?.textContent || "null");
    } catch {
      throw fail("INVALID_INITIAL", "页面初始JSON无法解析，未启动请求；不保存错误或页面片段");
    }
    const detailAnswer = !sampleCurrentAnswer && pageMatch?.[2]
      ? Object.values(initial?.initialState?.entities?.answers || {}).find(a =>
        a?.type === "answer" && safeId(a.id) === pageMatch[2]) : null;
    // An answer detail's list may describe only that answer. Always bootstrap
    // whole-question mode from the normal canonical question page, never guess a cursor.
    if (!sampleCurrentAnswer && pageMatch?.[2]) {
      const path = `/question/${Q}`;
      const html = await request(`${origin}${path}`, path, "html");
      // Template contents stay inert: never append them to the active document.
      let scripts;
      try {
        const template = document.createElement("template");
        template.innerHTML = html;
        scripts = template.content.querySelectorAll("script#js-initialData");
      } catch { throw fail("BOOTSTRAP_UNAVAILABLE", "无法安全解析正常问题页，已停止；不保存页面或底层错误"); }
      if (scripts.length !== 1)
        throw fail("BOOTSTRAP_UNAVAILABLE", "正常问题页未提供唯一的启动数据，已停止；不猜接口或绕过访问限制");
      try { initial = JSON.parse(scripts[0].textContent); }
      catch { throw fail("INVALID_INITIAL", "问题总页启动数据无法解析，已停止；不保存页面或错误片段"); }
      report.diagnostics.run.bootstrap = "canonical_question_page";
    }
    const state = initial?.initialState;
    const q = state?.entities?.questions?.[Q];
    if (!q || String(q.id) !== Q) throw new Error("页面没有可核对的问题初始数据");
    report.question = {title: typeof q.title === "string" ? q.title : null,
      detailHtml: typeof q.detail === "string" ? q.detail : null,
      declaredAnswerCount: q.answerCount ?? null,
      textComplete: typeof q.title === "string" && typeof q.detail === "string", notes: []};
    if (!report.question.textComplete)
      report.question.notes.push("问题标题或原文缺失或类型异常，不能确认所选范围文字完整");
    if (runHeading && typeof q.title === "string") runHeading.textContent += `：《${q.title}》`;
    requireCount(report.question.declaredAnswerCount);
    report.diagnostics.answers.counters.initialDeclared = safeCount(q.answerCount);
    const initialAnswers = Object.values(state.entities.answers || {});
    if (detailAnswer) initialAnswers.push(detailAnswer);
    report.diagnostics.answers.initial = initialAnswers.map(a =>
      ({type: safeType(a?.type), id: safeId(a?.id), outcome: "not_processed", reason: "prior_validation_stop"}));
    if (sampleCurrentAnswer && (!/^\d+$/.test(sampleId) ||
        !initialAnswers.some(a => safeId(a?.id) === sampleId && a?.type === "answer")))
      throw fail("SAMPLE_UNAVAILABLE", "当前页面初始数据没有目标回答；已停止，不猜测或补查其他接口");
    initialAnswers.forEach((a, i) => {
      const record = report.diagnostics.answers.initial[i];
      if (sampleCurrentAnswer && safeId(a?.id) !== sampleId) {
        record.outcome = "skipped"; record.reason = "outside_sample_scope";
      } else observeAnswer(a, record);
    });
    report.diagnostics.answers.counters.initialObtained = answerMap.size;
    if (!sampleCurrentAnswer) {
    const listing = state.question?.answers?.[Q];
    if (!listing || typeof listing.isDrained !== "boolean") throw new Error("回答列表分页状态缺失");
    if (listing.isDrained) report.answerListReachedEnd = true;
    else {
      const path = `/api/v4/questions/${Q}/feeds`;
      if (!listing.next) throw new Error("回答列表下一页入口缺失");
      report.answerListReachedEnd = await pages(listing.next, path, (b) => {
        const before = answerMap.size;
        const page = {requestIndex: requestCount, counters: counters(b), records: b.data.map(item =>
          ({type: safeType(item?.type), targetType: safeType(item?.target?.type),
            id: safeId(item?.target?.id ?? item?.id), outcome: "not_processed", reason: "prior_validation_stop"}))};
        report.diagnostics.answers.pages.push(page);
        try {
          b.data.forEach((item, i) => observeAnswer(item?.target, page.records[i], item?.target?.type === "answer"));
          const unsupported = b.data.filter((item, i) => item?.type === "answer" && page.records[i].outcome === "skipped").length;
          report.diagnostics.answers.unsupportedReturnedCount += unsupported;
          if (unsupported)
            report.answerListNotes.push("返回了未支持的回答结构，未采集该记录，不能确认返回范围或完整性");
        } finally {
          page.newUniqueCount = answerMap.size - before;
          page.obtainedAfter = answerMap.size;
        }
        update(`已取得${answerMap.size}篇回答文字，继续读取回答列表……`);
        return answerMap.size - before;
      });
    }
    if (Number(report.question.declaredAnswerCount) !== answerMap.size)
      report.answerListNotes.push(`回答数量未对齐：页面声明${report.question.declaredAnswerCount}篇，实得${answerMap.size}篇；不猜测缺失原因`);
    }
    for (const answer of answerMap.values()) {
      activeAnswer = answer;
      answer.commentStatus = "reading_roots";
      update(`回答文字${answerMap.size}篇；正在读取${answer.author}的评论和楼中楼……`);
      const map = new Map(), rootIds = [], roots = new Map();
      let reportedTotal = null;
      // Keep partial comments visible in the output even when a later request fails.
      const refresh = () => { answer.comments = [...map.values()]; };
      const path = `/api/v4/comment_v5/answers/${answer.id}/root_comment`;
      let latestAdvertised = false, collapsed = null, reviewing = null;
      const foldedRootIds = new Set();
      const ingestRoots = (b, normal = true) => {
          const before = roots.size;
          const returnedRoots = [...(b.top || []), ...b.data];
          const page = {requestIndex: requestCount, answerId: answer.id, layer: normal ? "roots" : "collapsed",
            sort: report.requests.at(-1).sort, counters: counters(b),
            roots: returnedRoots.map((c, i) => ({id: safeId(c?.id),
              source: i < (b.top || []).length ? "top" : "data",
              declaredChildren: safeCount(c?.child_comment_count), outcome: "not_processed"})), inline: []};
          returnedRoots.forEach(c => {
            if (Array.isArray(c?.child_comments)) c.child_comments.forEach(child =>
              page.inline.push({id: safeId(child?.id), rootId: safeId(c?.id), outcome: "not_processed"}));
          });
          report.diagnostics.commentPages.push(page);
          const total = b.counts?.total_counts ?? b.paging?.totals ?? null;
          if (normal && total !== null) {
            requireCount(total);
            if (reportedTotal !== null && Number(reportedTotal) !== Number(total))
              answer.notes.push("评论接口的声明总数在翻页期间发生变化，暂不确认完整");
            reportedTotal = total;
            answer.reportedCommentTotal = total;
          }
          if (normal) {
            latestAdvertised ||= Array.isArray(b.sorter) && b.sorter.some(x => x.type === "ts");
            if (b.counts?.collapsed_counts == null || b.counts?.reviewing_counts == null)
              answer.notes.push("折叠或审核评论计数未提供，不能将未知当作0确认完整");
            if (b.counts?.collapsed_counts != null) {
              const observed = requireCount(b.counts.collapsed_counts);
              if (collapsed !== null && collapsed !== observed)
                answer.notes.push("折叠评论的声明计数在翻页期间发生变化，暂不确认完整");
              collapsed = observed;
            }
            if (b.counts?.reviewing_counts != null) {
              const observed = requireCount(b.counts.reviewing_counts);
              if (reviewing !== null && reviewing !== observed)
                answer.notes.push("审核评论的声明计数在翻页期间发生变化，暂不确认完整");
              reviewing = observed;
            }
            answer.commentCounters = {total: reportedTotal, collapsed, reviewing};
          }
          try {
            let rootIndex = 0, inlineIndex = 0;
            for (const c of returnedRoots) {
              const record = page.roots[rootIndex++];
              record.outcome = "rejected";
              if (String(c.reply_comment_id) !== "0" ||
                  String(c.reply_root_comment_id) !== String(c.id))
                throw new Error("根评论归属不符");
              requireCount(c.child_comment_count);
              const rid = putComment(c, map, undefined, record);
              if (!normal) foldedRootIds.add(rid);
              if (!roots.has(rid)) { rootIds.push(rid); roots.set(rid, c); rootOwners.set(rid, answer.id); }
              else if (Number(roots.get(rid).child_comment_count) !== Number(c.child_comment_count))
                answer.notes.push(`评论${rid}的声明回复数在翻页期间发生变化`);
              for (const child of c.child_comments || []) {
                const inline = page.inline[inlineIndex++];
                putComment(child, map, rid, inline);
              }
            }
          } finally {
            refresh();
            page.uniqueReturnedIds = [...new Set([...page.roots, ...page.inline].map(c => c.id).filter(x => x !== null))];
            page.uniqueRootsAfter = roots.size;
            page.uniqueCommentsAfter = map.size;
          }
          return roots.size - before;
      };
      try {
        answer.commentPagesReachedEnd = await pages(`${origin}${path}?order_by=score&limit=20&offset=`, path, ingestRoots);
      } catch (error) {
        if (!recoverable(error)) throw error;
        noteIssue(answer, "根评论", error);
      }
      const rootCapacity = [...roots.values()].reduce((n, c) => n + 1 + Number(c.child_comment_count), 0);
      const rootCountGap = reportedTotal !== null && rootCapacity < Number(reportedTotal);
      if ((!answer.commentPagesReachedEnd || rootCountGap) && latestAdvertised) {
        answer.warnings.push(`${answer.commentPagesReachedEnd ? "默认排序虽到末页，但根评论及声明回复合计少于总数" : "默认排序分页异常"}；使用该响应明确提供的“最新”排序补查，不改变身份或权限`);
        try {
          answer.commentPagesReachedEnd = await pages(`${origin}${path}?order_by=ts&limit=20&offset=`, path, ingestRoots);
          for (const issue of report.issues.filter(x => x.answerId === answer.id && x.scope === "根评论")) {
            issue.resolvedBy = "response_advertised_latest_sort_reached_end";
            answer.notes = answer.notes.filter(x => x !== issue.message);
          }
        } catch (error) {
          if (!recoverable(error)) throw error;
          noteIssue(answer, "最新排序根评论", error);
        }
      }
      if (collapsed > 0) {
        // Normal user-visible folded-comment layer, verified in captured site JS.
        const foldedPath = `/api/v4/comment_v5/answers/${answer.id}/collapse_comments`;
        try {
          answer.foldedPagesReachedEnd = await pages(
            `${origin}${foldedPath}?order_by=score&limit=20&offset=`, foldedPath, b => ingestRoots(b, false));
        } catch (error) {
          if (!recoverable(error)) throw error;
          answer.foldedPagesReachedEnd = false;
          noteIssue(answer, "折叠评论", error);
        }
      }
      if (reviewing > 0) answer.notes.push(`接口声明${reviewing}条审核中评论，未尝试读取受限审核层`);
      if (collapsed > 0) {
        answer.foldedCoverage = {declared: collapsed, uniqueRootRecords: foldedRootIds.size,
          definition: "Folded root IDs counted independently; no sum with normal roots or assumption about reply-inclusive counters."};
        if (foldedRootIds.size !== collapsed)
          answer.notes.push(`折叠层声明${collapsed}条，实得${foldedRootIds.size}个独立根评论；口径未核齐`);
      }
      answer.commentStatus = "reading_replies";
      for (const rid of rootIds) {
        const declared = Number(roots.get(rid).child_comment_count || 0);
        const count = () => [...map.values()].filter(c => c.rootId === rid && c.id !== rid).length;
        const group = { rootId: rid, declared, obtained: count(),
          status: count() === declared ? "inline_count_matched" : "not_started" };
        answer.replyGroups.push(group);
        if (count() < declared) {
          const childPath = `/api/v4/comment_v5/comment/${rid}/child_comment`;
          group.status = "reading";
          try {
            group.reachedEnd = await pages(`${origin}${childPath}`, childPath, b => {
              const before = count();
              const page = {requestIndex: requestCount, answerId: answer.id, rootId: rid, layer: "children",
                sort: report.requests.at(-1).sort, counters: counters(b), children: b.data.map(c =>
                  ({id: safeId(c?.id), rootId: safeId(c?.reply_root_comment_id), outcome: "not_processed"}))};
              report.diagnostics.commentPages.push(page);
              try {
                let childIndex = 0;
                for (const c of b.data) {
                  const record = page.children[childIndex++];
                  record.outcome = "rejected";
                  if (String(c.reply_root_comment_id) !== rid || rootOwners.get(rid) !== answer.id)
                    throw new Error("楼中楼归属不符");
                  putComment(c, map, rid, record);
                }
              } finally {
                refresh(); group.obtained = count();
                page.uniqueReturnedIds = [...new Set(page.children.map(c => c.id).filter(x => x !== null))];
                page.uniqueChildrenAfter = count();
              }
              return count() - before;
            });
            group.status = count() === declared ? "complete" : "partial";
          } catch (error) {
            group.status = "partial";
            if (!recoverable(error)) throw error;
            noteIssue(answer, `楼中楼${rid}`, error);
          }
        }
        group.obtained = count();
        if (count() !== declared) group.status = "partial";
        if (count() !== declared) answer.notes.push(`评论${rid}声明回复${declared}条，实得${count()}条`);
      }
      const missing = [...map.values()].filter(c => c.replyToId !== "0" && !map.has(c.replyToId));
      if (missing.length) answer.notes.push(`有${missing.length}条回复的上级评论未取得`);
      const broken = [...map.values()].filter(c => {
        if (c.replyToId === "0") return false;
        const chain = new Set([c.id]);
        let parent = map.get(c.replyToId);
        while (parent) {
          if (parent.rootId !== c.rootId || chain.has(parent.id)) return true;
          chain.add(parent.id);
          if (parent.replyToId === "0") return parent.id !== c.rootId;
          parent = map.get(parent.replyToId);
        }
        return false; // Missing parents have their own note above.
      });
      if (broken.length) answer.notes.push(`有${broken.length}条回复的父链跨组或成环`);
      if (reportedTotal === null || map.size !== Number(reportedTotal))
        answer.notes.push(`评论总数未对齐：声明${reportedTotal}，实得${map.size}`);
      if (answer.declaredCommentCount !== null &&
          Number(answer.declaredCommentCount) !== Number(reportedTotal))
        answer.notes.push("回答列表与评论接口的声明总数不同，可能发生变化，暂不确认完整");
      answer.reportedCommentTotal = reportedTotal;
      answer.commentsComplete = answer.commentPagesReachedEnd &&
        (collapsed === 0 || answer.foldedPagesReachedEnd === true) && answer.notes.length === 0;
      answer.commentStatus = answer.commentsComplete ? "complete" : "partial";
      activeAnswer = null;
    }
    const declared = report.question.declaredAnswerCount;
    if (totalLimitReached()) throw fail("LIMIT", "已达到本次20分钟上限，保留部分数据");
    const finalDeclared = observeQuestion();
    report.diagnostics.answers.counters.finalDeclared = finalDeclared;
    if (finalDeclared !== null && finalDeclared !== Number(declared))
      report.answerListNotes.push("页面重读的声明回答数发生变化，保留开始与结束值，暂不确认完整");
    report.complete = report.question.textComplete && !sampleCurrentAnswer && report.answerListReachedEnd && Number(declared) === answerMap.size &&
      report.answerListNotes.length === 0 &&
      report.answers.every(a => a.truncated === false && a.contentHtml && a.commentsComplete);
    report.selectedAnswerComplete = report.question.textComplete && sampleCurrentAnswer && report.answers.length === 1 &&
      report.answers[0].truncated === false && Boolean(report.answers[0].contentHtml) && report.answers[0].commentsComplete;
    report.runStatus = sampleCurrentAnswer ? shortRun ? "sample_finished" : "single_finished" : report.complete ? "complete" : "finished_partial";
    if (sampleCurrentAnswer) report.stoppedReason = `${shortRun ? "单回答样本" : "所选单篇回答"}已处理，${report.selectedAnswerComplete ? "该篇文字与评论已核齐" : "仍有缺口，见问题及该回答notes"}；未遍历整题，顶层complete不代表单篇结论`;
    else if (!report.complete) report.stoppedReason = "所返回数据已处理，但问题原文、回答数、截断标志或评论覆盖存在未对齐项；不能宣告全量" +
      (report.issues.find(x => !x.resolvedBy) ? `。首次缺口：${report.issues.find(x => !x.resolvedBy).message}` : "");
  } catch (error) {
    const plannedStop = error.code === "DIAGNOSTIC_LIMIT";
    report.diagnostics.run.plannedStop = plannedStop;
    report.runStatus = plannedStop ? "diagnostic_limit" : "stopped";
    if (activeAnswer) {
      activeAnswer.commentStatus = "partial";
      if (!plannedStop) noteIssue(activeAnswer, "本次停止", error);
    }
    report.stoppedReason = String(error?.message || error);
    report.globalStopCode = error.code || "FATAL";
  } finally {
    const incompleteAnswers = report.answers.filter(a => !a.commentsComplete || a.truncated !== false || !a.contentHtml);
    const unprocessed = report.answers.filter(a => a.commentStatus === "not_started");
    report.coverage = {
      scope: report.collectionScope.kind,
      question: {textComplete: report.question?.textComplete ?? false,
        textNotes: report.question?.notes.slice() ?? [],
        declaredAnswers: safeCount(report.question?.declaredAnswerCount),
        finalObservedDeclaredAnswers: report.diagnostics.answers.counters.finalDeclared ?? null,
        obtainedAnswers: report.answers.length, listReachedEnd: report.answerListReachedEnd,
        declaredMinusObtained: report.question ? Number(report.question.declaredAnswerCount) - report.answers.length : null},
      comments: {obtained: report.answers.reduce((n, a) => n + a.comments.length, 0),
        roots: report.answers.reduce((n, a) => n + a.comments.filter(c => c.replyToId === "0").length, 0),
        replies: report.answers.reduce((n, a) => n + a.comments.filter(c => c.replyToId !== "0").length, 0),
        answersVerified: report.answers.filter(a => a.commentsComplete).length,
        answersUnprocessed: unprocessed.length,
        answersWithGaps: report.answers.filter(a => !a.commentsComplete && a.commentStatus !== "not_started").length},
      unresolved: incompleteAnswers.map(a => ({answerId: a.id, commentStatus: a.commentStatus,
        declaredComments: safeCount(a.declaredCommentCount), reportedComments: safeCount(a.reportedCommentTotal),
        obtainedComments: a.comments.length, truncated: a.truncated !== false,
        bodyStatus: a.bodyStatus,
        notes: a.notes.slice()})),
      returnedScopeProcessed: !sampleCurrentAnswer && report.answerListReachedEnd &&
        report.diagnostics.answers.unsupportedReturnedCount === 0 &&
        !unprocessed.length && ["complete", "finished_partial"].includes(report.runStatus),
      allDeclaredCountsVerified: report.complete,
      definition: "Traversal of returned pages and agreement with declared counts are separate. Unknown or inaccessible content is not reconstructed. Image bytes/video are not downloaded."
    };
    Object.assign(report.diagnostics.answers.counters, {
      finalDeclared: report.diagnostics.answers.counters.finalDeclared ?? observeQuestion(), obtained: answerMap.size,
      reachedEnd: report.answerListReachedEnd,
      finalCountSource: "page_initial_data_reread_not_live_api"
    });
    report.diagnostics.run.environmentAtEnd = environment();
    report.finishedAt = new Date().toISOString();
    const elapsedMs = Math.round(Math.max(0, clock() - startedClock));
    report.performance = {
      mode: "serial_request_start_spacing", minRequestGapMs, concurrency: 1,
      elapsedMs, waitMs: Math.round(accumulatedWaitMs),
      requestMs: Math.round(accumulatedRequestMs),
      otherMs: Math.round(Math.max(0, elapsedMs - accumulatedWaitMs - accumulatedRequestMs)),
      definition: "Monotonic time: requestMs includes fetch/responseJSON; waitMs includes actual pacing sleeps. processingGapMs is previous response completion to next wait evaluation; unknown DOM states stay unknown. No browser throttling cause inferred."
    };
    if (!testing) {
      const finalState = ["stopped", "diagnostic_limit"].includes(report.runStatus) ? "提前停止：结果未完成" :
        report.complete || report.selectedAnswerComplete ? "检索完成：所选范围文字数据已核齐" : "检索结束：仍有缺口，未核齐";
      const resultMessage = `${finalState}。${sampleCurrentAnswer ? "单篇" : "整题"}：${report.answers.length}篇回答，${report.answers.reduce((n, a) => n + a.comments.length, 0)}条评论，${requestCount}/${requestLimit}次请求，用时${Math.floor(elapsedMs / 60000)}分${Math.floor(elapsedMs % 60000 / 1000)}秒。${report.stoppedReason || ""}`;
      update(resultMessage);
      saveButton.textContent = "保存本机JSON";
      stopButton.disabled = true;
      // One local file; if Chrome blocks automatic saving, the visible Save button remains.
      finished = true;
      if (closeRequested) {
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        box.remove();
      } else {
        try {
          saveButton.click();
          update(`${resultMessage} 已发起下载，请在浏览器下载列表确认；若没有文件，可点“保存本机JSON”。`);
        } catch {
          update(`${resultMessage} 未能发起下载，请点“保存本机JSON”重试；仍失败请保留面板截图。`);
        }
        closeButton.disabled = false;
        closeButton.title = "关闭结果面板";
        const back = document.createElement("button");
        back.textContent = "关闭结果面板（再次点击扩展可选范围）";
        back.onclick = () => closeButton.click();
        box.append(back);
      }
    }
  }
  return testing ? report : {runStatus: report.runStatus, complete: report.complete};
}
if (typeof module !== "undefined") module.exports = aiOutpostReadOnlyExport;
