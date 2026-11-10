// Synthetic integration checks of the production collector; no browser or network.
const assert = require("node:assert/strict");
const {collect} = require("./test-portable.cjs");
async function main() {
  const checks = {};
  const first = '<p>Same words</p><img src="https://picx.zhimg.com/example.jpg?source=1def8aca" data-original="https://pic1.zhimg.com/example.jpg?source=1def8aca">';
  const second = first.replaceAll("picx.", "pica.").replaceAll("1def8aca", "2c26e567");
  let r = await collect({answerOverrides: {content: first}, variantContent: second});
  assert.equal(r.report.complete, true);
  assert.equal(r.report.answers[0].answerVariants[0].kind, "image_url_representation");
  assert.equal(r.report.answers[0].answerVariants[0].previous.contentHtml, first);
  assert.equal(r.report.answers[0].answerVariants[0].observed.contentHtml, second);
  checks.imageRepresentationPreservedWithoutFalseBodyConflict = "PASS";
  for (const changed of [second.replace("Same words", "Changed words"), second.replace("example.jpg", "other.jpg"),
    second.replace("2c26e567", "2c26e567&size=small"), second.replace("pica.zhimg.com", "evil.example"),
    second.replace("https://", "http://"), second.replace("data-original", "href"),
    second.replace("example.jpg", "a/../example.jpg"),
    second.replace("pica.zhimg.com", "pic.zhimg.com").replaceAll("2c26e567", "representation")]) {
    r = await collect({answerOverrides: {content: first}, variantContent: changed});
    assert.equal(r.report.complete, false);
    assert.equal(r.report.answers[0].answerVariants[0].kind, "body_or_truncation_change");
  }
  checks.textPathParameterHostAndStructureChangesRemainGaps = "PASS";
  for (const wrapper of [s => `<script>${s}</script>`, s => `<!--${s}-->`, s => `<textarea>${s}</textarea>`, s => `<noscript>${s}</noscript>`]) {
    r = await collect({answerOverrides: {content: wrapper(first)}, variantContent: wrapper(second)});
    assert.equal(r.report.complete, false);
  }
  checks.rawTextAndCommentsNotNormalized = "PASS";
  r = await collect({answerOverrides: {content: `<noscript>${first.slice(first.indexOf("<img"))}</noscript>`},
    variantContent: `<noscript>${second.slice(second.indexOf("<img"))}</noscript>`});
  assert.equal(r.report.complete, true);
  checks.singleImageNoscriptFallbackSupported = "PASS";
  r = await collect({oneAnswer: true, answerOverrides: {content: ""}});
  assert.equal(r.report.complete, false);
  assert.equal(r.report.answers[0].bodyStatus, "empty_unknown");
  assert.equal(r.report.coverage.unresolved[0].bodyStatus, "empty_unknown");
  assert.ok(r.report.answers[0].warnings.some(s => s.includes("视频")));
  checks.emptyBodyNotAssumedVideo = "PASS";
  r = await collect({oneAnswer: true, answerOverrides: {content: "", answerType: "video", video: {id: "123"}}});
  assert.equal(r.report.complete, false);
  assert.equal(r.report.answers[0].bodyStatus, "empty_unknown");
  checks.unverifiedVideoFieldsNotTrusted = "PASS";
  r = await collect({answerOverrides: {content: first}, variantContent: second, commentMismatch: true});
  assert.equal(r.report.complete, false);
  assert.ok(r.report.coverage.comments.answersWithGaps > 0);
  checks.imageNormalizationCannotEraseCommentGaps = "PASS";
  assert.equal(r.report.mediaPolicy.video, "not_collected_or_transcribed");
  assert.equal(r.report.mediaPolicy.imageBytes, "not_downloaded");
  checks.explicitMediaPolicy = "PASS";
  console.log(JSON.stringify({result: "PASS", cases: Object.keys(checks).length, checks,
    network: "NONE", browser: "NOT_RUN", fixtures: "SYNTHETIC_ONLY"}));
}
if (require.main === module) main().catch(e => {console.error(e); process.exitCode = 1;});
module.exports = {main};
