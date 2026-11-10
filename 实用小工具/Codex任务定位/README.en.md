<!-- README-SOURCE-SHA256: 6c335c5e7fe02ff4635451582e4aafa2214f38743d245b64f07a0fd29142d023 -->
# Find a Codex task by name

[Download this tool and check release status](https://github.com/RongNianXin/ChatGPT-Workflows/blob/main/%E5%AE%9E%E7%94%A8%E5%B0%8F%E5%B7%A5%E5%85%B7/Codex%E4%BB%BB%E5%8A%A1%E5%AE%9A%E4%BD%8D/DOWNLOAD.en.md)

[中文](README.md)

When the host's recent task list omits a known project conversation, this fallback searches an explicitly authorized local metadata database by exact project path and display name. It returns candidates only; confirm each candidate with the host `read_thread` API. It does not create, wake, message, or modify tasks.

## Download and run

Entry: [Find-CodexThread.mjs](../../.github/scripts/Find-CodexThread.mjs). Requires Node and an existing Python 3 standard library. Missing runtimes block only this fallback; do not install dependencies automatically or infer that the task does not exist.

Get the standalone ZIP from this tool's download page above and extract it completely; no repository clone is required. Retain the relative `.github/` and `实用小工具/` layout. Version 0.1.0 is the initial distribution version. Use requires existing local Codex metadata and a host capability that can confirm candidate conversations.

From either the repository root or the extracted package root, with parameters filled by the agent:

```powershell
node .github/scripts/Find-CodexThread.mjs --project-root "<PROJECT_ROOT>" --name "Specialist A"
```

The default database is `state_5.sqlite` under `CODEX_HOME`, or the user's standard `.codex` directory. Use `--state-db` only for an explicitly authorized database. The tool never scans directories or reads conversation content, initial messages, models, accounts, or credentials. A nonempty `name` takes precedence over `title`; long initial prompts are not display names.

The [Python reader](../../.github/scripts/Find-CodexThread.py) uses `mode=ro&immutable=1` to inspect the main database checkpoint without reading WAL updates or creating database locks or companion files. A checkpoint can be stale. Observable changes during lookup or read errors discard the result.

`CANDIDATE` means one unarchived checkpoint match, `AMBIGUOUS` requires disambiguation, and `NOT_FOUND` means no checkpoint match. Missing data, unsupported schemas, or unknown states return `INPUT_REQUIRED`. None of these results attest live completeness or task identity. Verify the current name, project root, and observable state through the host before using a candidate. Keep real identifiers out of public documents and logs.

Run [Test-Find-CodexThread.mjs](../../.github/scripts/Test-Find-CodexThread.mjs) for name precedence, path prefixes, Unicode, archive and ambiguity handling, WAL staleness, and database/companion-file preservation. Synthetic tests do not attest host list coverage or a live task's identity.

## Updates and errors

Extract the new ZIP into a separate folder and use its matching scripts together. The tool keeps no task list and only reads authorized metadata, so no database migration is needed. Expect one of the candidate states described above; no match does not prove a conversation is absent. For errors, report the package, Node and Python versions, status and redacted error text. Do not send the database, real task identifiers, conversation content or credentials.
