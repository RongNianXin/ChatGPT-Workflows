// Production function, synthetic DOM/fetch/clock. No real site or captured data.
const assert = require("node:assert/strict");
const {collect, Q} = require("./test-portable.cjs");
const checks = {};
async function main() {
  const menu = {showMenu: true, expectedQuestionId: Q, expectedAnswerId: null};
  let r = await collect({options: menu, menuAction: "close"});
  assert.equal(r.report, null);
  assert.ok(!r.elements.some(e => e.tag === "select" || e.tag === "option"));
  assert.deepEqual(r.elements.filter(e => /^[12]\. /.test(e.textContent || "")).map(e => e.textContent), [
    "1. 检索这个帖子的原文以及当前的这一篇回答", "2. 检索这个帖子的原文以及所有的回答"]);
  checks.exactlyTwoScopeActionsWithoutDropdown = "PASS";
  checks.menuCloseWithoutRequestOrDownload = "PASS";
  r = await collect({options: menu, menuAction: "close", repeatClick: true});
  assert.equal(r.report, null);
  checks.repeatClickWhileMenuOpenDoesNotDuplicate = "PASS";
  r = await collect({options: menu, menuAction: "single", invalidSelection: true});
  assert.equal(r.report, null);
  assert.ok(r.elements.some(e => (e.textContent || "").includes("不能唯一确定")));
  checks.totalPageDoesNotGuessCurrentAnswer = "PASS";
  r = await collect({options: menu, menuAction: "single", invalidSelection: true, thenWhole: true});
  assert.equal(r.report.complete, true);
  assert.equal(r.report.answers.length, 2);
  checks.ambiguousCurrentAnswerDoesNotBlockWholeChoice = "PASS";
  const pathname = `/question/${Q}/answer/101`;
  const answerMenu = {...menu, expectedAnswerId: "101"};
  const single = await collect({pathname, detailOnly: true, options: answerMenu, menuAction: "single"});
  assert.equal(single.report.runStatus, "single_finished");
  assert.equal(single.report.selectedAnswerComplete, true);
  assert.equal(single.report.complete, false);
  assert.equal(single.report.collectionScope.answerId, "101");
  assert.equal(single.report.answers.length, 1);
  assert.equal(single.paths.length, 1);
  assert.ok(!single.paths.some(p => p.endsWith("/feeds")));
  assert.deepEqual(single.report.question, {title: "Synthetic", detailHtml: "<p>Synthetic original question</p>",
    declaredAnswerCount: 2, textComplete: true, notes: []});
  checks.currentAnswerAndQuestionOriginalPreserved = "PASS";
  r = await collect({pathname, missingCurrentAnswer: true, options: answerMenu, menuAction: "single", invalidSelection: true});
  assert.equal(r.report, null);
  checks.missingCurrentEntityDoesNotGuessAnotherAnswer = "PASS";
  const total = await collect({options: menu});
  const detail = await collect({pathname, detailOnly: true, options: answerMenu});
  assert.equal(detail.paths[0], `/question/${Q}`);
  assert.equal(detail.report.requests[0].responseKind, "question_page_initial_data");
  assert.equal(detail.report.diagnostics.run.bootstrap, "canonical_question_page");
  assert.deepEqual(detail.report.answers, total.report.answers);
  assert.equal(detail.report.complete, true);
  assert.equal(detail.report.answers.length, 2, "detail isDrained must not truncate whole question");
  assert.deepEqual(detail.report.question, single.report.question);
  assert.deepEqual(total.report.question, single.report.question);
  assert.equal(detail.maxActive, 1);
  assert.ok(detail.starts.slice(1).every((t, i) => t - detail.starts[i] >= 1500));
  checks.answerAndTotalPageWholeQuestionEqualAndBootstrapPaced = "PASS";
  r = await collect({pathname, detailOnly: true, omitCanonicalCurrent: true, options: answerMenu});
  assert.equal(r.report.answers.length, 2);
  assert.equal(r.report.complete, true);
  assert.ok(r.report.answers.some(a => a.id === "101"));
  checks.currentVisibleAnswerRetainedWhenCanonicalListOmitsIt = "PASS";
  r = await collect({options: menu, menuNavigate: true});
  assert.equal(r.paths.length, 0);
  assert.equal(r.report.globalStopCode, "PAGE_CHANGED");
  checks.navigationWhileChoosingStopsWithoutRequests = "PASS";
  r = await collect({pathname, options: answerMenu, menuNavigateSameQuestion: true});
  assert.equal(r.paths.length, 0);
  assert.equal(r.report.globalStopCode, "PAGE_CHANGED");
  checks.sameQuestionAnswerNavigationWhileChoosingStops = "PASS";
  for (const config of [{html: "<p>Login SECRET_PAGE_BODY</p>"},
    {html: '<script id="js-initialData">SECRET_PAGE_BODY</script>'},
    {html: '<script id="js-initialData">{}</script><script id="js-initialData">{}</script>'},
    {html: '<script data-id="js-initialData">{}</script>'},
    {html: '<!-- <script id="js-initialData">{}</script> -->'},
    {bootstrapWrongQuestion: true}, {bootstrapError: true}, {http: 403}, {bootstrapCancel: true}]) {
    r = await collect({pathname, detailOnly: true, options: answerMenu, ...config});
    assert.equal(r.paths.length, 1);
    assert.equal(r.report.runStatus, "stopped");
    assert.equal(r.report.complete, false);
    assert.doesNotMatch(JSON.stringify(r.report), /SECRET_PAGE_BODY/);
  }
  checks.bootstrapFailuresStopWithoutLeakOrFallback = "PASS";
  r = await collect({options: {mode: "single", selectedAnswerId: "999"}});
  assert.equal(r.paths.length, 0);
  assert.equal(r.report.globalStopCode, "SAMPLE_UNAVAILABLE");
  checks.unknownSingleAnswerDoesNotGuessOrFetch = "PASS";
  assert.equal(single.report.diagnostics.run.requestLimit, 1000);
  assert.equal(single.report.diagnostics.run.mode, "single_full");
  checks.singleIsFullModeNot30RequestDiagnostic = "PASS";
  r = await collect({pathname, options: answerMenu, menuAction: "single", rootPages: 35});
  assert.equal(r.paths.length, 35);
  assert.equal(r.report.answers[0].comments.length, 35);
  assert.equal(r.report.selectedAnswerComplete, true);
  checks.singleActuallyContinuesBeyond30Requests = "PASS";
  console.log(JSON.stringify({result: "PASS", cases: Object.keys(checks).length, checks,
    network: "NONE", browser: "NOT_RUN", fixtures: "SYNTHETIC_ONLY"}));
}
if (require.main === module) main().catch(e => {console.error(e); process.exitCode = 1;});
module.exports = {main};
