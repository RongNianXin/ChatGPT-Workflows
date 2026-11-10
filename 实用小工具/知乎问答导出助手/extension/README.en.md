# Zhihu Read-Only Export 0.6.7

[简体中文](README.md) | English

See the [installation and usage guide](../README.en.md) first. Load this directory, which contains `manifest.json`, as an unpacked extension. The toolbar action and menu should show version 0.6.7. Reload the extension and refresh the Zhihu page after updating local files.

## Scope and permissions

Both question and answer pages open the same two-option menu. One option collects the current answer and its normally returned comments; the other collects normally returned answers and comments for the entire question. Opening or closing the menu makes no collection requests.

Only `activeTab` and `scripting` are requested. `worker.js` verifies the clicked tab's URL and injects `collector.js` into that page. The extension does not have a persistent content script, upload service, extra host permission, or cookie/storage permission.

Requests use the page's normal access to the same Zhihu origin. Authentication or access failures stop collection. There are no alternate-account, restriction-bypass, parallel acceleration, or automatic retry features.

## Cancellation, output, and completeness

The menu × closes without collecting. During collection, × abandons the run without automatically downloading its unfinished result. The separate stop-and-save action attempts to keep partial data. Previously downloaded files are not removed.

Raw HTML and author information can appear in exported JSON. Do not execute that HTML in a trusted page or publish private exports with the source.

`selectedAnswerComplete` describes the selected answer; top-level `complete` remains a strict whole-question result. Missing declared counts remain unknown. Finishing pagination is not proof that every answer or hidden reply was returned.

Images and videos are not downloaded, recognized, or transcribed. Media references can remain in the original HTML. An empty body remains unknown.

## Offline verification

From the tool's parent directory, using installed Python and Node:

```powershell
python -B verify-delivery.py
```

The verifier checks the fixed file list, hashes, version, permissions, two JavaScript syntax checks, and the portable, menu, and text-scope synthetic suites. Tests do not contact Zhihu or read real account data.

Current hashes are in [the delivery manifest](../delivery-manifest.json). Detailed data and request invariants are in [MAINTENANCE.md](MAINTENANCE.md).

Version 0.6.5 live results are historical evidence; version 0.6.7 does not have new live-site or cross-browser acceptance. Offline checks do not prove browser download completion, current site layout compatibility, or full content coverage.

## Sharing and maintenance

Share source code and general documentation only. Do not include exported JSON, account screenshots, captured fixtures, or private maintenance logs.

The source uses the repository's [MIT License](../LICENSE). It is a limited-maintenance, manually installed utility, not a store-reviewed extension or an official Zhihu product. No fixed support or update schedule is promised.

<!-- README-SOURCE-SHA256: 4de721170ee2731368c15f6e965bfd7d4f728cebcaec7004222ce23818982a92 -->
