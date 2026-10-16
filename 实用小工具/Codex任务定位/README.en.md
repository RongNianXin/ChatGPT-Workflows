<!-- README-SOURCE-SHA256: 937fe09b964ba78f85b184b83af14b61bb45378dd3963c58e1f65d781feaf28c -->
# Find a Codex task by name

[中文](README.md)

When the host's recent task list omits a known project conversation, this fallback searches an explicitly authorized local metadata database by exact project path and display name. It returns candidates only; confirm each candidate with the host `read_thread` API. It does not create, wake, message, or modify tasks.

Entry: [Find-CodexThread.mjs](../../.github/scripts/Find-CodexThread.mjs). Requires Node and an existing Python 3 standard library. Missing runtimes block only this fallback; do not install dependencies automatically or infer that the task does not exist.

From the repository root, with parameters filled by the agent:

```powershell
node .github/scripts/Find-CodexThread.mjs --project-root "<PROJECT_ROOT>" --name "Specialist A"
```

The default database is `state_5.sqlite` under `CODEX_HOME`, or the user's standard `.codex` directory. Use `--state-db` only for an explicitly authorized database. The tool never scans directories or reads conversation content, initial messages, models, accounts, or credentials. A nonempty `name` takes precedence over `title`; long initial prompts are not display names.

The [Python reader](../../.github/scripts/Find-CodexThread.py) uses `mode=ro&immutable=1` to inspect the main database checkpoint without reading WAL updates or creating database locks or companion files. A checkpoint can be stale. Observable changes during lookup or read errors discard the result.

`CANDIDATE` means one unarchived checkpoint match, `AMBIGUOUS` requires disambiguation, and `NOT_FOUND` means no checkpoint match. Missing data, unsupported schemas, or unknown states return `INPUT_REQUIRED`. None of these results attest live completeness or task identity. Verify the current name, project root, and observable state through the host before using a candidate. Keep real identifiers out of public documents and logs.

Run [Test-Find-CodexThread.mjs](../../.github/scripts/Test-Find-CodexThread.mjs) for name precedence, path prefixes, Unicode, archive and ambiguity handling, WAL staleness, and database/companion-file preservation. Synthetic tests do not attest host list coverage or a live task's identity.
