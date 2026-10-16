"""Read checkpoint metadata only; the host must confirm candidate freshness."""
import json
import ntpath
import posixpath
import sqlite3
import sys
from pathlib import Path


def normalize_project(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("candidate project path is unknown")
    value = value.replace("\\", "/")
    if value.startswith("//?/UNC/"):
        value = "//" + value[8:]
    elif value.startswith("//?/"):
        value = value[4:]
    if ntpath.splitdrive(value)[0]:
        return ntpath.normpath(value).replace("\\", "/").rstrip("/").lower()
    if not value.startswith("/"):
        raise ValueError("absolute project path required")
    return posixpath.normpath(value).rstrip("/") or "/"


def find(options):
    target = Path(options["databasePath"]).resolve(strict=True)
    before = target.stat()
    with target.open("rb") as stream:
        header = stream.read(20)
    if not header.startswith(b"SQLite format 3\x00"):
        raise ValueError("unsupported metadata database")
    project = normalize_project(options["projectRoot"])
    # immutable avoids locks and companion-file writes, and deliberately ignores WAL.
    db = sqlite3.connect(target.as_uri() + "?mode=ro&immutable=1", uri=True)
    try:
        columns = {row[1] for row in db.execute("PRAGMA table_info(threads)")}
        if not {"id", "cwd", "archived", "title"}.issubset(columns):
            raise ValueError("unsupported metadata schema")
        db.create_function("matches_project", 1, lambda cwd: int(normalize_project(cwd) == project))
        short_title = "CASE WHEN length(title)<=200 AND instr(title,char(10))=0 AND instr(title,char(13))=0 THEN title END"
        display = ("CASE WHEN name IS NOT NULL AND trim(name)!='' THEN name ELSE "
                   + short_title + " END") if "name" in columns else short_title
        query = (f"SELECT id, {display}, cwd, archived FROM threads "
                 f"WHERE ({display})=? AND matches_project(cwd)=1")
        rows = db.execute(query, (options["name"],)).fetchall()
    finally:
        db.close()
    after = target.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError("metadata checkpoint changed during lookup")
    return {"rows": [{"id": row[0], "title": row[1], "cwd": row[2], "archived": row[3]} for row in rows],
            "checkpoint_only": True, "wal_not_read": header[18:20] == b"\x02\x02"}


if __name__ == "__main__":
    try:
        print(json.dumps(find(json.loads(sys.stdin.buffer.read().decode('utf-8'))), ensure_ascii=True))
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
