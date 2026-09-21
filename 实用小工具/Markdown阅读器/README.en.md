[中文](README.md)
<!-- README-SOURCE-SHA256: b4f2fef0caf0a0c6a8d4912892b7e89b1f5ead11c06ffb7e9021818726fc70c2 -->

# Markdown Reader

Double-click [index.html](index.html) to read Markdown in a browser. Select source files for both the manual and other project documents, then switch between them in the same library. No manual snapshot is bundled. Reading requires no application installation, login, or server.

## Getting Started

1. Double-click `index.html`. The first visit shows “暂无文档” (No documents) and an Open documents button. Remembered files restore the library on later visits. Once loaded, documents appear in the library on the left, with content in the center and an outline on the right. On narrow screens, use the toolbar buttons to open the library and outline. If the page is blank, check that `reader.js`, `reader.css`, and `vendor/` are kept alongside `index.html`, and record the browser and any error shown.
2. Select “打开文档” (Open documents) and choose the manual's original `.md` file or any other document. Expect a new or selected entry labeled as an original file or session import. The old bundled snapshot no longer appears; existing saved file references remain in use.
3. Continue opening Markdown from other locations. Each document has its own content and outline. Filter the library using its search field. Identical filenames receive sequence labels; removing an entry does not delete the file.

Drag document entries up or down to reorder the library. Dropping on the upper half of a target inserts before it; dropping on the lower half inserts after it, with a solid line on the matching edge. Remembered original files keep this order. Dragging changes only the reader list; it never moves or renames files on disk.

The toolbar has one Open documents control. It first requests access that allows rereading the source file. If the browser does not support or cannot provide that access, it automatically falls back to ordinary file selection, labeled “本次载入” (Session import). Canceling selection does not import a file or open another picker.

Every document entry has an X control. It removes only the library entry and saved file reference, without deleting or modifying the disk file. Removing the current document selects the first remaining document. Removing the last document shows No documents and clears the content and outline. Removed entries do not return on reopening; use Open documents to add them again.

Only explicitly selected files are accessed; the reader does not scan the computer or other projects. Supported extensions are `.md`, `.markdown`, and `.txt`, with UTF-8 encoding and an 8 MB limit per file. Invalid types, encoding, or sizes produce a message while other documents remain available.

## Reading, Navigation, and Copying

- The outline supports heading search, navigation, and current-section highlighting. Long outlines scroll to keep the active heading visible. Switching documents restores each document's reading position. Scroll positions for remembered original files are also saved; large document edits may require locating the section again.
- The toolbar magnifier opens a search field for the current document, including code, with controls for the previous and next results. Search highlights up to 1000 matches, does not match across separate text nodes created by formatting, and does not save queries. Closing search clears the highlights.
- The copy icon copies only the original fenced text, preserving indentation and line breaks with CRLF normalized to LF. Explanatory text outside the block is excluded. If clipboard access fails, a read-only text area opens with all text selected for the system copy command.
- The theme control switches light/dark mode and remembers the preference when browser storage permits. Browser printing omits toolbars and sidebars.
- Ordinary heading anchors and standalone empty `<a id="..."></a>` / `<a name="..."></a>` anchors are supported. Relative file links first list already loaded same-name candidates. After setting the current document's remote page URL, an unloaded target can be resolved as a relative URL and opened in a new remote tab. The remote address is used only after an explicit click; content is never fetched automatically, and leaving it unset preserves offline behavior. File selection does not reveal full paths, so filenames alone cannot establish project relationships.

## Synchronizing Markdown Changes

**Selected Markdown is parsed when read; editing it does not require generating HTML.**

First, save the Markdown in its original editor. You normally do not need to close or reopen the reader. Here, “refresh” means the circular-arrow button at the top right of the page, whose tooltip is “重新读取当前文件” (Reread current file). It does not mean the browser's Reload button or F5. Reloading the browser rebuilds the page; session imports are lost and must be selected again.

| Displayed state | Refresh behavior | After reopening |
| --- | --- | --- |
| Original file, remembered | Attempts to reread when selected, when returning to the reader's window or tab, or on refresh; requires valid read permission | Restores the saved library and the last successfully read content; attempts to read the last selected document if present, or the first entry otherwise. Other entries are read when selected |
| Original file, current authorization | Can reread in the current page | Requires selecting again |
| Session import | Refresh asks for the same-name original and updates the current entry. Check its directory: the tool cannot verify that a same-name file comes from the same location | Requires selecting the file again |

Persistence depends on the browser's file system access API. A saved handle is a reference the browser uses to access the source; it does not guarantee permanent permission. To avoid a blank page when permission is temporarily unavailable after reopening, the reader stores each original file's last successfully read content in the browser's local database. It does not upload, modify, or delete the source file. If permission is missing, the page still displays “重新授权 / 重试” (Authorize again / Retry), but shows the cached content when available and clearly states that it may not be current. Whether a reference remains valid after a file is moved depends on the browser and file system. The reader shows an empty document only when the source cannot be read and no cache exists.

Select an original-file entry in the library and press refresh to reread the latest disk content through that reference, without entering a path again. Ordinary selection only provides a file snapshot for the current session, without reusable path access, so it still requires selecting the same-name source again. A library filename alone cannot locate a disk file. Refresh is disabled when no document is open or a document switch is still loading.

This is not a background file watcher. When the reader stays in the foreground, press refresh after saving the original. The tool does not run while closed. It does not scan directories or discover new files automatically. New documents require explicit selection.

Expected result: saved text changes appear, and new headings are added to the outline. If rereading succeeds but the content has not changed, the read time is still updated. A manual refresh displays “已重新读取，内容没有变化” (Reread complete; content unchanged); an automatic reread shows no notification. If the expected content is missing, first check that the Markdown was saved and that the selected entry is the original file from the correct directory. Then record the loading status, browser, and error text. A read failure does not prevent switching to another document.

Storage is isolated by browser, profile, and entry address. Changing browsers, moving the reader, or clearing browser data may require selecting again; clearing browser data also removes cached content. Modern browsers on Windows/macOS can display content; persistence depends on browser support and permission. Browsers lacking the API, including applicable Safari/Firefox versions, use ordinary selection and cannot be assumed to match Chromium behavior.

## Content and Security Boundaries

The reader supports headings, paragraphs, lists, tables, links, and fenced code. It uses a Markdown parser and never executes document code, commands, or prompts. Raw HTML is text except for the narrowly specified empty anchors. Formulas, Mermaid, and attached image rendering are not supported. Images display alternative text without automatically reading local resources or fetching external images. External pages open only on explicit link clicks.

All interface assets ship locally: no CDN, document uploads, AI integration, or third-party analytics. Browser storage holds file references, names, scroll positions, the theme, and the last successfully read content for remembered source files; it does not store search terms. Browser extensions, system synchronization, and host privacy settings are outside this tool's control.

Reading permission does not authorize publication or sending. Do not embed private documents into a distribution package. Open documents through runtime file selection.

## Validation

Headless Chrome and Edge on Windows validated exact source agreement for 43 headings and 40 fenced blocks after importing the manual; navigation to scenarios 2F/2G and subsections; document switching and position restoration; duplicate headings, legacy anchors, cross-file candidate confirmation, text search and copying with highlights; session replacement without new entries; an initially empty library, removal controls for all entries, clearing the last document, removed entries staying removed after reopening, and source files remaining unchanged after entry removal; invalid encoding; inert scripts and no image requests; 1440-pixel desktop, 390-pixel narrow layouts, and light/dark themes. No page exceptions or external requests were found.

The successful clipboard path uses a test receiver to compare text. The rejected path checks complete text in the read-only area. Handle persistence, reopening, updates, deletion, and permission states use a local HTTP test page with browser-private fixture files or test doubles; this is not operating system picker acceptance.

**Still requires manual confirmation:** real permission persistence from the double-click `file:` entry, the system clipboard, and macOS/Safari/Firefox. Select an editable test Markdown, save a changed heading in the editor, then return to the reader and check its status and content. Close/reopen to confirm that content is restored; if permission is unavailable, confirm that cached content and the authorization prompt appear together. Paste a copied block into a local editor and compare its content. For failures, record the OS, browser, loading mode, error text, and target heading.

## Maintenance and Checks

Readers do not need Node.js. Maintainers run in this directory:

```sh
npm ci
npm run build
npm run check
```

The build copies pinned parser/icon assets and licenses into `vendor/`, resolving paths relative to its own location. It no longer reads or bundles the manual. All documents are read after the user selects them; editing Markdown does not require rebuilding the reader.

`npm run check` checks JavaScript syntax, the absence of the old snapshot file, the bilingual README hash and language links, asset existence, and common machine-specific paths in the tool files listed by the script. It is not a complete repository path audit or translation review. The Chinese README is the source; update its English translation whenever the Chinese text changes. Building updates the hash marker but does not translate the text.

With Playwright and Chrome available:

```sh
node browser-check.cjs /path/to/playwright
node browser-check.cjs /path/to/playwright msedge
```

Or run `npm run test:browser` when the `playwright` package resolves directly. Checks are headless and temporarily start a loopback-only test server, closed on completion. Screenshots go to the repository-ignored `.playwright-cli/` and are not runtime dependencies. Missing Playwright/Chrome causes dependency or launch errors, not a passing result.

`package-lock.json` pins dependencies and `vendor/` contains their licenses. Distribute the entry, `reader.js`, `reader.css`, and `vendor/` together. `node_modules/` is not required for readers. No remote publishing, global installation, or background service step is included.
