# Zhihu Q&A Export Helper

[Download this tool and check release status](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/%E7%9F%A5%E4%B9%8E%E9%97%AE%E7%AD%94%E5%AF%BC%E5%87%BA%E5%8A%A9%E6%89%8B/DOWNLOAD.en.md)

[简体中文](README.md) | English

Version: 0.6.7. A free, locally loaded browser extension included in ChatGPT Workflows. It is not listed in a browser extension store and does not guarantee complete coverage.

## What it does

Choose either the current answer or the entire question. The extension exports the question text, normally returned answers, comments, and nested replies to a local JSON file. JSON is structured text, not a formatted article. There is no built-in AI summary.

- Start from either a question page or an answer page.
- Choose between two scopes without selecting from an incomplete list of preloaded answers.
- Follow normal pagination, deduplicate IDs, and check counts and reply relationships.
- Distinguish verified data, remaining gaps, and early stops.
- Keep the result on your device. The extension does not upload it or post, like, or follow anything.

## Install and update

Node and Python are not required for normal use.

1. Get the ZIP from this tool's download page above and extract it to a stable folder. No repository clone is required. Existing checkouts still work. Do not load files directly from the ZIP.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge and enable Developer mode.
3. Select **Load unpacked** and choose `实用小工具/知乎问答导出助手/extension` inside the package, the folder that directly contains `manifest.json`.
4. Confirm version 0.6.7 and optionally pin the extension to the toolbar.

Other Manifest V3 browsers may work, but compatibility has not been verified across browsers. For an update, obtain the new files first, reload the extension, and refresh any open Zhihu tab. Reloading reads your local folder; it does not download updates from the maintainer. After disabling or removing the extension, refresh tabs where it was already injected.

## Use

1. Open a normal Zhihu question or answer page.
2. Click the extension. Opening the menu sends no collection requests.
3. Choose the current answer or all normally returned answers for that question.
4. Wait for the progress panel. Do not refresh, close, or navigate the target tab; interrupted work cannot be resumed.
5. When collection ends, the extension attempts one JSON download. Check the browser's download list. If necessary, use the panel's local save button.

The current-answer option requires a uniquely identifiable answer on the page. It does not silently pick the first answer on a question page. Whole-question collection is not limited to the answers preloaded in the visible page.

| Action or status | Meaning |
| --- | --- |
| Verified within the selected scope | Program checks passed for the returned data; hidden or deleted content may still exist |
| Finished with gaps | The returned data is saved, but some counts, text, or relationships remain unresolved |
| Stopped early | An error or protection stopped collection; the extension attempts to save the partial result |
| Menu × | Close without collecting or downloading |
| Running × | Abandon collection, cancel active work, and close without automatically saving the unfinished result |
| Stop and save | Stop intentionally and attempt to download the data collected so far |
| Finished × | Close the panel without deleting or downloading files again |

Previously saved files are never deleted by these controls. A download being initiated does not prove the browser wrote it to disk.

## Limits and evidence

The extension processes text and normally returned comments and replies. It does not download image or video files, transcribe video, or recover hidden, deleted, restricted, or otherwise unavailable content. Raw HTML may contain media references. An empty body is not automatically classified as a video.

Requests are sequential, with at least 1.5 seconds between starts, a 1,000-request limit, a 20-minute budget, and a maximum 20-second timeout per request. Background tab suspension may delay timers. Login, permission, rate-limit, network, and format failures stop collection without automatic retries or bypasses.

A historical version 0.6.5 sample returned 49 comments and replies for one answer, and 87 of 90 declared answers with 391 comments and replies for the question. The missing three answers and their causes remain unknown. These results do not guarantee a minimum coverage rate on other questions. Version 0.6.7 adds checks for unknown question text and changing comment counters, plus synthetic reply-pagination regressions. Its verification is offline; there is no new live-site acceptance test.

## Privacy, license, and maintenance

Only `activeTab` and `scripting` are requested. No extra host, cookie, storage, or upload permissions are included.

Exported JSON can contain author names, links, and raw HTML. It is not anonymous. Do not publish it with the source code or execute its raw HTML in a trusted page. For bug reports, provide the version, selected scope, final status, and a screenshot with account information removed. Do not send cookies, headers, or full network captures.

The source code uses the repository's [MIT License](LICENSE). This license does not grant rights to third-party Zhihu content. Use only content you are authorized to access, and respect the site's rules.

This is a limited-maintenance utility, with no promised response time, release schedule, or continuing site compatibility. Contributions are welcome; the project can pause maintenance. It is not affiliated with Zhihu.

## Development files

- [Extension instructions](extension/README.en.md): permissions, developer checks, and technical boundaries.
- `研发与维护记录.md`: design decisions, history, known gaps, and verification scope.
- `接管验收.md`: portable acceptance and future maintenance handoff.
- `evidence/`: sanitized historical receipts, not current live-site acceptance.
- `delivery-manifest.json`: fixed delivery files and SHA-256 integrity checks. The two generated DOWNLOAD pages are checked separately by the parent distribution checker and are excluded from packages.
- `verify-delivery.py`: verifies the file set and runs offline tests using installed Python and Node.

<!-- README-SOURCE-SHA256: 0ccb5e634cdbc5354f56f7ccc7a0141fcec720cd4fec3b886a65d5fa2c7c9a4f -->
