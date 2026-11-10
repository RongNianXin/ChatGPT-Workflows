// Synthetic, portable regression: no captured content, account, browser or network.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync(process.env.COLLECTOR_SOURCE || path.join(__dirname, "collector.js"), "utf8");
const Q = "987654321", checks = {};
const answer = id => ({type: "answer", id, question: {id: Q}, content: "<p>Synthetic answer</p>",
  contentNeedTruncated: false, commentCount: 2});
async function collect(config = {}) {
  let time = 0, timer = 0, active = 0, maxActive = 0;
  const timers = new Map(), files = [], starts = [], paths = [], elements = [], blobs = new Map();
  const initial = {initialState: {entities: {questions: {[Q]: {id: Q, title: "Synthetic", detail: "<p>Synthetic original question</p>", answerCount: config.total ?? config.many ?? 2}},
    answers: {"101": answer("101")}}, question: {answers: {[Q]: {isDrained: false,
      next: `/api/v4/questions/${Q}/feeds?offset=first`}}}}};
  if (config.zero) {initial.initialState.entities.answers = {}; initial.initialState.entities.questions[Q].answerCount = 0;
    initial.initialState.question.answers[Q] = {isDrained: true};}
  if (config.invalidQuestionCount !== undefined)
    initial.initialState.entities.questions[Q].answerCount = config.invalidQuestionCount;
  if (config.oneAnswer) {
    initial.initialState.entities.questions[Q].answerCount = 1;
    initial.initialState.question.answers[Q] = {isDrained: true};
  }
  if (config.questionOverrides) Object.assign(initial.initialState.entities.questions[Q], config.questionOverrides);
  for (const key of config.omitQuestionFields || []) delete initial.initialState.entities.questions[Q][key];
  if (config.childPages) initial.initialState.entities.answers["101"].commentCount = 4;
  if (config.answerOverrides) Object.assign(initial.initialState.entities.answers["101"], config.answerOverrides);
  const canonicalInitial = JSON.parse(JSON.stringify(initial));
  if (config.omitCanonicalCurrent) delete canonicalInitial.initialState.entities.answers["101"];
  if (config.rootPages) initial.initialState.entities.answers["101"].commentCount = config.rootPages;
  if (config.detailOnly) initial.initialState.question.answers[Q] = {isDrained: true};
  if (config.missingCurrentAnswer) delete initial.initialState.entities.answers["101"];
  class ClockDate extends Date {constructor(...args) {super(...(args.length ? args : [1700000000000 + time]));}
    static now() {return 1700000000000 + time;}}
  class LocalURL extends URL {static createObjectURL(blob) {const k = `blob:${blobs.size}`; blobs.set(k, blob); return k;}
    static revokeObjectURL(k) {blobs.delete(k);}}
  const element = tag => {const e = {tag, style: {}, children: [], append(...items) {this.children.push(...items);},
    setAttribute() {}, remove() {this.removed = true;},
    click() {if (tag === "a") {
      if (config.downloadThrows) throw new Error("synthetic download blocked");
      files.push(blobs.get(this.href));
    } else this.onclick?.();}};
    if (tag === "template") Object.defineProperty(e, "innerHTML", {set(html) {
      const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
      const scripts = [...withoutComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
        .filter(m => /(?:^|\s)id\s*=\s*["']js-initialData["']/i.test(m[1]));
      e.content = {querySelectorAll: selector => {
        assert.equal(selector, "script#js-initialData");
        return scripts.map(m => ({textContent: m[2]}));
      }};
    }});
    elements.push(e); return e;};
  const sandbox = {module: {exports: {}}, URL: LocalURL, Blob, AbortController, Date: ClockDate,
    performance: {now: () => time}, location: {origin: "https://www.zhihu.com", pathname: config.pathname || `/question/${Q}`},
    document: {visibilityState: "visible", hasFocus: () => true, createElement: element, body: {append() {}},
      getElementById: id => id === "js-initialData" ? {textContent: JSON.stringify(initial)} :
        elements.find(e => e.id === id && !e.removed) || null},
    setTimeout: (fn, ms) => {const id = ++timer; timers.set(id, fn); if (ms < 20000) Promise.resolve().then(() => {
      if (config.closeDuringWait && timers.has(id)) {
        elements.find(e => e.ariaLabel === "关闭结果面板").click();
        assert.equal(timers.has(id), false);
      }
      if (timers.has(id)) {timers.delete(id); time += ms; fn();}
    }); return id;}, clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => {
      starts.push(time); paths.push(new URL(url).pathname); active++; maxActive = Math.max(maxActive, active);
      time += config.latency ?? 100;
      assert.equal(options.method, "GET"); assert.equal(options.headers, undefined);
      if (config.closeDuringFetch) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {active--; reject(new Error("aborted"));});
          if (config.saveBeforeClose) elements.find(e => e.textContent === "保存当前进度JSON").click();
          elements.find(e => e.ariaLabel === "关闭结果面板").click();
          assert.equal(elements.find(e => e.id === "ai-outpost-readonly-export").style.display, "none");
        });
      }
      if (config.stopDuringFetch) {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {active--; reject(new Error("aborted"));});
          elements.find(e => e.textContent === "停止并保存已有数据").click();
        });
      }
      if (config.http) {active--; return {ok: false, status: config.http};}
      const u = new URL(url);
      if (u.pathname === `/question/${Q}`) {
        if (config.bootstrapCancel) elements.find(e => e.textContent === "停止并保存已有数据").click();
        if (config.bootstrapClose) elements.find(e => e.ariaLabel === "关闭结果面板").click();
        return {ok: true, status: 200, text: async () => {
          active--;
          if (config.bootstrapError) throw new Error("SECRET_PAGE_BODY");
          const data = JSON.parse(JSON.stringify(canonicalInitial));
          if (config.bootstrapWrongQuestion) data.initialState.entities.questions[Q].id = "111";
          return config.html ?? `<html><script id="js-initialData" type="application/json">${JSON.stringify(data)}</script></html>`;
        }};
      }
      let body;
      if (u.pathname.endsWith("/feeds")) {
        body = {data: Array.from({length: (config.many || 2) - 1}, (_, i) =>
          ({type: "feed", target: answer(String(102 + i))})), paging: {is_end: true}};
        if (config.duplicateCommentCount !== undefined)
          body.data.unshift({type: "feed", target: {...answer("101"), commentCount: config.duplicateCommentCount}});
        if (config.directAnswer) body.data.push({...answer("999"), content: "<p>Unsupported direct answer</p>"});
        if (config.variantContent) body.data.unshift({type: "feed", target: {...answer("101"), content: config.variantContent}});
      }
      else if (config.childPages && u.pathname.endsWith("/child_comment")) {
        const n = Number(u.searchParams.get("offset") || 0), rid = "1011";
        if (config.childFailure && n === 1) {active--; return {ok: false, status: 503};}
        const childId = config.childRepeat && n === 1 ? "1013" : String(1013 + n);
        body = {data: [{id: childId, content: "Synthetic fetched reply", reply_comment_id: rid,
          reply_root_comment_id: rid, child_comment_count: 0}],
          paging: {is_end: n === 1 && !config.childRepeat,
            next: `${u.origin}${u.pathname}?offset=${n + 1}`}};
        if (config.childUnsafeNext) body.paging.next = config.childUnsafeNext;
      }
      else {
        const id = u.pathname.split("/").at(-2), root = id + "1", child = id + "2";
        body = {data: [{id: root, content: "Synthetic root", reply_comment_id: "0", reply_root_comment_id: root,
          child_comment_count: 1, child_comments: [{id: child, content: "Synthetic reply", reply_comment_id: root,
            reply_root_comment_id: root, child_comment_count: 0}]}],
          counts: {total_counts: config.commentMismatch ? 9 : 2, collapsed_counts: config.collapsedGap ? 1 : 0, reviewing_counts: 0},
          paging: {is_end: true}};
        if (config.childPages) {
          body.data[0].child_comment_count = 3;
          body.counts.total_counts = 4;
        }
        if (config.collapsedGap && u.pathname.endsWith("/collapse_comments"))
          body = {data: [], paging: {is_end: true, totals: 0}};
        if (config.rootPages) {
          const n = Number(u.searchParams.get("offset") || 0), rid = String(1000 + n);
          body = {data: [{id: rid, content: "Synthetic", reply_comment_id: "0", reply_root_comment_id: rid,
            child_comment_count: 0, child_comments: []}], counts: {total_counts: config.rootPages,
              ...(config.missingLayerCounts ? {} : {collapsed_counts: 0, reviewing_counts: 0})},
            paging: {is_end: n + 1 === config.rootPages,
              next: `${u.origin}${u.pathname}?order_by=score&limit=20&offset=${n + 1}`}};
          if (config.layerCounts) Object.assign(body.counts, config.layerCounts[n]);
        }
      }
      return {ok: true, status: 200, json: async () => {
        active--;
        if (config.navigate) sandbox.location.pathname = "/question/999999";
        if (config.finalCountChanged) initial.initialState.entities.questions[Q].answerCount = 2;
        if (config.stopOnJson) elements.find(e => e.textContent === "停止并保存已有数据").click();
        if (config.closeOnJson) elements.find(e => e.ariaLabel === "关闭结果面板").click();
        if (config.abortOnJson) [...timers.values()].at(-1)();
        return body;
      }};
    }};
  vm.runInNewContext(source, sandbox);
  const pending = sandbox.module.exports(config.options || {});
  if (config.options?.showMenu) {
    assert.equal(starts.length, 0, "menu must not fetch before choice");
    if (config.repeatClick) {
      await sandbox.module.exports(config.options);
      assert.equal(elements.filter(e => e.id === "ai-outpost-readonly-export" && !e.removed).length, 1);
      assert.equal(starts.length, 0);
    }
    if (config.menuNavigate) sandbox.location.pathname = "/question/111";
    if (config.menuNavigateSameQuestion) sandbox.location.pathname = `/question/${Q}/answer/102`;
    if (config.menuAction === "single") {
      elements.find(e => e.textContent?.startsWith("1. ")).click();
      if (config.invalidSelection) {
        assert.equal(starts.length, 0);
        if (config.thenWhole) elements.find(e => e.textContent?.startsWith("2. ")).click();
        else elements.find(e => e.ariaLabel === "关闭选择菜单").click();
      }
    } else if (["close", "cross"].includes(config.menuAction)) elements.find(e => e.ariaLabel === "关闭选择菜单").click();
    else elements.find(e => e.textContent === "2. 检索这个帖子的原文以及所有的回答").click();
  }
  const outcome = await pending;
  assert.equal(timers.size, 0);
  if (["close", "cross"].includes(config.menuAction) || (config.invalidSelection && !config.thenWhole)) {
    assert.equal(files.length, 0); assert.equal(starts.length, 0);
    return {report: null, starts, paths, maxActive, elements};
  }
  if (config.closeDuringFetch || config.closeDuringWait || config.closeOnJson || config.bootstrapClose || config.downloadThrows) {
    assert.equal(files.length, config.saveBeforeClose ? 1 : 0, "discarding must not add a final download");
    return {report: null, outcome, starts, paths, maxActive, elements, files};
  }
  assert.ok(files.length, "supported question must produce a final local file");
  return {report: JSON.parse(await files.at(-1).text()), starts, paths, maxActive, elements, files};
}
async function main() {
  let r = await collect();
  assert.equal(r.report.questionId, Q, "question ID is derived from actual page");
  assert.equal(r.report.complete, true);
  assert.equal(r.report.answers.length, 2);
  assert.equal(r.report.coverage.comments.obtained, 4);
  assert.equal(r.report.coverage.comments.roots, 2);
  const close = r.elements.find(e => e.ariaLabel === "关闭结果面板");
  assert.ok(close && close.textContent === "×" && close.disabled === false);
  close.click();
  assert.equal(r.files.length, 1, "closing after completion must not trigger another download");
  assert.equal(r.elements.find(e => e.id === "ai-outpost-readonly-export").removed, true);
  checks.finishedPanelCloseCross = "PASS";
  r = await collect({options: {showMenu: true}, menuAction: "cross"});
  assert.equal(r.report, null);
  assert.equal(r.elements.find(e => e.id === "ai-outpost-readonly-export").removed, true);
  checks.menuCrossClosesWithoutRequest = "PASS";
  r = await collect({closeDuringFetch: true});
  assert.equal(r.outcome.runStatus, "stopped");
  assert.equal(r.paths.length, 1);
  assert.equal(r.elements.find(e => e.id === "ai-outpost-readonly-export").removed, true);
  checks.activeCrossAbortsDiscardsAndRemoves = "PASS";
  r = await collect({closeDuringFetch: true, saveBeforeClose: true});
  assert.equal(JSON.parse(await r.files[0].text()).runStatus, "running");
  checks.discardDoesNotDeleteOrRedownloadManualSnapshot = "PASS";
  r = await collect({closeDuringWait: true});
  assert.equal(r.paths.length, 1);
  assert.equal(r.outcome.runStatus, "stopped");
  assert.equal(r.elements.find(e => e.id === "ai-outpost-readonly-export").removed, true);
  checks.waitingCrossCancelsTimerWithoutNextRequest = "PASS";
  for (const config of [{closeOnJson: true}, {bootstrapClose: true, detailOnly: true,
    pathname: `/question/${Q}/answer/101`, options: {showMenu: true}}]) {
    r = await collect(config);
    assert.equal(r.paths.length, 1);
    assert.equal(r.outcome.runStatus, "stopped");
    assert.equal(r.elements.find(e => e.id === "ai-outpost-readonly-export" && !e.removed), undefined);
  }
  checks.closeAtJsonOrBootstrapCannotSaveOrContinue = "PASS";
  r = await collect({stopDuringFetch: true});
  assert.equal(r.report.globalStopCode, "CANCELLED");
  assert.ok(!r.elements.find(e => e.id === "ai-outpost-readonly-export").removed);
  assert.ok(r.elements.some(e => (e.textContent || "").includes("提前停止")));
  checks.stopAndSaveStillDownloadsPartialAndKeepsPanel = "PASS";
  r = await collect({downloadThrows: true});
  assert.equal(r.outcome.runStatus, "complete");
  assert.ok(r.elements.some(e => (e.textContent || "").includes("未能发起下载")));
  assert.ok(!r.elements.find(e => e.id === "ai-outpost-readonly-export").removed);
  checks.downloadFailureKeepsManualSaveAndPanel = "PASS";
  r = await collect();
  assert.ok(r.elements.some(e => (e.textContent || "").includes("检索完成：所选范围文字数据已核齐")));
  assert.ok(r.elements.some(e => (e.textContent || "").includes("已发起下载")));
  assert.ok(!r.elements.some(e => (e.textContent || "").includes("已下载成功")));
  checks.completedStatusDoesNotClaimFileSaved = "PASS";
  assert.equal(r.report.coverage.comments.replies, 2);
  assert.equal(r.report.coverage.comments.answersVerified, 2);
  assert.equal(r.report.coverage.returnedScopeProcessed, true);
  checks.dynamicQuestionFullTraversal = "PASS";
  assert.equal(r.maxActive, 1);
  assert.ok(r.starts.slice(1).every((t, i) => t - r.starts[i] >= 1500));
  checks.productionSerialPacing = "PASS";
  r = await collect({many: 35});
  assert.equal(r.paths.length, 36);
  assert.equal(r.report.complete, true);
  assert.equal(r.report.coverage.comments.obtained, 70);
  assert.equal(r.report.diagnostics.run.requestLimit, 1000);
  assert.equal(r.maxActive, 1);
  checks.fullModeContinuesBeyond30Requests = "PASS";
  r = await collect({navigate: true});
  assert.equal(r.paths.length, 1);
  assert.equal(r.report.globalStopCode, "PAGE_CHANGED");
  assert.equal(r.report.coverage.returnedScopeProcessed, false);
  checks.pageNavigationStopsBeforeNextFetch = "PASS";
  r = await collect({total: 3});
  assert.equal(r.report.complete, false);
  assert.equal(r.report.coverage.question.declaredMinusObtained, 1);
  assert.equal(r.report.coverage.returnedScopeProcessed, true);
  assert.equal(r.report.coverage.allDeclaredCountsVerified, false);
  assert.ok(r.elements.some(e => (e.textContent || "").includes("检索结束：仍有缺口")));
  checks.traversalDoesNotEraseAnswerGap = "PASS";
  r = await collect({commentMismatch: true});
  assert.equal(r.report.complete, false);
  assert.equal(r.report.coverage.unresolved.length, 2);
  assert.equal(r.report.coverage.comments.answersWithGaps, 2);
  checks.commentGapReportedPerAnswer = "PASS";
  r = await collect({zero: true});
  assert.equal(r.paths.length, 0);
  assert.equal(r.report.complete, true);
  assert.equal(r.report.coverage.comments.obtained, 0);
  checks.zeroAnswersNoNetwork = "PASS";
  r = await collect({oneAnswer: true, rootPages: 2, missingLayerCounts: true,
    options: {mode: "single", selectedAnswerId: "101"}});
  assert.equal(r.report.answers[0].commentCounters.collapsed, null);
  assert.equal(r.report.answers[0].commentCounters.reviewing, null);
  assert.equal(r.report.selectedAnswerComplete, false);
  assert.ok(r.report.answers[0].notes.some(s => s.includes("计数未提供")));
  checks.missingLayerCountsRemainUnknownNotZero = "PASS";
  for (const mode of ["whole", "single"]) {
    for (const field of ["title", "detail"]) {
      for (const questionConfig of [{omitQuestionFields: [field]}, {questionOverrides: {[field]: null}},
        {questionOverrides: {[field]: {unexpected: true}}}]) {
        r = await collect({oneAnswer: true, ...questionConfig,
          ...(mode === "single" ? {options: {mode: "single", selectedAnswerId: "101"}} : {})});
        assert.equal(r.report.complete, false);
        assert.equal(Boolean(r.report.selectedAnswerComplete), false);
        assert.equal(r.report.question[field === "title" ? "title" : "detailHtml"], null);
        assert.equal(r.report.coverage.question.textComplete, false);
        assert.ok(r.report.question.notes.length > 0);
        assert.ok(!r.elements.some(e => (e.textContent || "").includes("检索完成：所选范围文字数据已核齐")));
      }
    }
  }
  checks.unknownQuestionTextCannotCertifyEitherScope = "PASS";
  r = await collect({oneAnswer: true, questionOverrides: {detail: ""}});
  assert.equal(r.report.complete, true);
  assert.equal(r.report.question.detailHtml, "");
  assert.equal(r.report.coverage.question.textComplete, true);
  checks.explicitEmptyQuestionDetailRemainsCompatible = "PASS";
  for (const field of ["collapsed_counts", "reviewing_counts"]) {
    for (const values of [[1, 0], [0, 1]]) {
      r = await collect({oneAnswer: true, rootPages: 2,
        layerCounts: values.map(value => ({[field]: value}))});
      assert.equal(r.report.complete, false);
      assert.equal(r.report.answers[0].commentsComplete, false);
      assert.ok(r.report.answers[0].notes.some(s => /计数在翻页期间发生变化/.test(s)));
    }
  }
  checks.changedLayerCountsInEitherDirectionNeverCertify = "PASS";
  r = await collect({oneAnswer: true, rootPages: 2});
  assert.equal(r.report.complete, true);
  checks.stableLayerCountsRemainCompatible = "PASS";
  r = await collect({oneAnswer: true, childPages: true});
  assert.equal(r.report.complete, true);
  assert.equal(r.report.answers[0].comments.length, 4);
  assert.equal(r.report.answers[0].replyGroups[0].status, "complete");
  assert.equal(r.paths.filter(p => p.endsWith("/child_comment")).length, 2);
  assert.equal(r.report.diagnostics.commentPages.filter(p => p.layer === "children").length, 2);
  assert.equal(r.maxActive, 1);
  checks.inlineInsufficientRepliesFetchedAcrossPages = "PASS";
  for (const config of [{childRepeat: true}, {childFailure: true}]) {
    r = await collect({oneAnswer: true, childPages: true, ...config});
    assert.equal(r.report.complete, false);
    assert.equal(r.report.answers[0].comments.length, 3);
    assert.equal(r.report.answers[0].replyGroups[0].status, "partial");
    assert.equal(r.paths.filter(p => p.endsWith("/child_comment")).length, 2);
    assert.ok(r.report.answers[0].comments.some(c => c.id === "1013"));
  }
  checks.replyRepeatOrFailurePreservesObtainedData = "PASS";
  for (const next of ["https://evil.example/api/v4/comment_v5/comment/1011/child_comment?offset=1",
    "https://www.zhihu.com/api/v4/comment_v5/comment/999/child_comment?offset=1"]) {
    r = await collect({oneAnswer: true, childPages: true, childUnsafeNext: next});
    assert.equal(r.report.complete, false);
    assert.equal(r.report.globalStopCode, "FATAL");
    assert.equal(r.paths.filter(p => p.endsWith("/child_comment")).length, 1);
    assert.ok(!r.paths.some(p => p.includes("/999/")));
    assert.equal(r.report.answers[0].comments.length, 2);
  }
  checks.unsafeReplyNextPageNeverRequested = "PASS";
  r = await collect({http: 429});
  assert.equal(r.paths.length, 1);
  assert.equal(r.report.runStatus, "stopped");
  assert.equal(r.report.coverage.returnedScopeProcessed, false);
  assert.equal(r.report.coverage.comments.answersUnprocessed, 1);
  checks.httpStopPreservesUnprocessedScope = "PASS";
  for (const value of [true, false, [], [2], " ", "2.0", "2e0", -1, 1.5]) {
    r = await collect({invalidQuestionCount: value});
    assert.equal(r.paths.length, 0, `invalid count ${JSON.stringify(value)} must stop before fetch`);
    assert.equal(r.report.complete, false);
    assert.equal(r.report.runStatus, "stopped");
  }
  checks.nonIntegerCountTypesRejected = "PASS";
  r = await collect({invalidQuestionCount: "2"});
  assert.equal(r.report.complete, true, "digit-string counts remain compatible");
  checks.digitStringCountsAccepted = "PASS";
  r = await collect({duplicateCommentCount: 3});
  assert.equal(r.report.complete, false, "changed duplicate answer metadata must not certify completeness");
  assert.equal(r.report.answers[0].commentsComplete, false);
  assert.ok(r.report.answers[0].notes.some(s => /声明评论数/.test(s)));
  assert.deepEqual(r.report.answers[0].observedCommentCounts, [2, 3]);
  checks.changedDuplicateCountNotCertified = "PASS";
  r = await collect({duplicateCommentCount: 2});
  assert.equal(r.report.complete, true, "unchanged duplicate metadata remains compatible");
  checks.unchangedDuplicateCountStillComplete = "PASS";
  r = await collect({directAnswer: true});
  assert.equal(r.report.complete, false, "skipped answer-shaped content must prevent completeness");
  assert.equal(r.report.coverage.returnedScopeProcessed, false);
  assert.ok(r.report.answerListNotes.some(s => /未支持/.test(s)));
  checks.unsupportedReturnedAnswerNotCertified = "PASS";
  r = await collect({options: {expectedQuestionId: "111"}});
  assert.equal(r.paths.length, 0);
  assert.equal(r.report.globalStopCode, "PAGE_CHANGED");
  checks.clickedQuestionBoundBeforeFirstFetch = "PASS";
  for (const content of ["<p>Edited</p>", "<p>Answer synthetic</p>"]){
    r = await collect({variantContent: content});
    assert.equal(r.report.complete, false);
    assert.ok(r.report.answers[0].answerVariants.some(v => v.observed.contentHtml === content));
    assert.ok(r.report.answers[0].notes.some(s => /正文/.test(s)));
  }
  checks.answerBodyVariantsPreserved = "PASS";
  r = await collect({collapsedGap: true});
  assert.equal(r.report.complete, false);
  assert.ok(r.report.answers[0].notes.some(s => /折叠/.test(s)));
  checks.emptyFoldedLayerNotCertified = "PASS";
  r = await collect({oneAnswer: true, finalCountChanged: true});
  assert.equal(r.report.complete, false);
  assert.equal(r.report.coverage.question.finalObservedDeclaredAnswers, 2);
  assert.ok(r.report.answerListNotes.some(s => /声明回答数/.test(s)));
  checks.changedFinalQuestionCountNotCertified = "PASS";
  r = await collect({oneAnswer: true, stopOnJson: true});
  assert.equal(r.report.globalStopCode, "CANCELLED");
  assert.equal(r.report.complete, false);
  checks.successfulJsonCannotOverrideStop = "PASS";
  r = await collect({oneAnswer: true, abortOnJson: true});
  assert.equal(r.report.globalStopCode, "TIMEOUT");
  assert.equal(r.report.complete, false);
  checks.successfulJsonCannotOverrideTimeout = "PASS";
  r = await collect({many: 63, latency: 19000});
  assert.equal(r.report.globalStopCode, "LIMIT");
  assert.equal(r.report.complete, false);
  assert.ok(r.starts.at(-1) < 1200000);
  checks.finalRequestCannotOverrideTotalBudget = "PASS";
  const worker = fs.readFileSync(path.join(__dirname, "worker.js"), "utf8");
  let clicked, injected;
  vm.runInNewContext(worker, {URL, console, importScripts: () => {}, aiOutpostReadOnlyExport: () => {},
    chrome: {action: {onClicked: {addListener: fn => {clicked = fn;}},setBadgeText: async () => {},setTitle: async () => {}},
      scripting: {executeScript: async value => {injected = value;}}}});
  await clicked({id: 1, url: `https://www.zhihu.com/question/${Q}`});
  assert.equal(injected.args[0].showMenu, true);
  assert.equal(injected.args[0].sampleCurrentAnswer, undefined);
  assert.equal(injected.args[0].expectedQuestionId, Q);
  assert.equal(injected.args[0].expectedAnswerId, null);
  await clicked({id: 1, url: `https://www.zhihu.com/question/${Q}/answer/888`});
  assert.equal(injected.args[0].expectedQuestionId, Q);
  assert.equal(injected.args[0].expectedAnswerId, "888");
  assert.equal(injected.args[0].showMenu, true);
  assert.equal(injected.args[0].sampleCurrentAnswer, undefined);
  checks.questionAndAnswerClicksOpenMenu = "PASS";
  for (const url of ["https://evil.example/question/123", "https://www.zhihu.com/people/me", "https://www.zhihu.com/question/123/answer/not-id"]) {
    injected = null; await clicked({id: 1, url}); assert.equal(injected, null);
  }
  checks.unrelatedPagesRejected = "PASS";
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal(manifest.host_permissions, undefined); assert.equal(manifest.content_scripts, undefined);
  checks.noAddedPermissions = "PASS";
  console.log(JSON.stringify({result: "PASS", version: manifest.version, cases: Object.keys(checks).length, checks,
    browser: "NOT_RUN", network: "NONE", fixtures: "SYNTHETIC_ONLY"}));
}
module.exports = {collect, Q, main};
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
