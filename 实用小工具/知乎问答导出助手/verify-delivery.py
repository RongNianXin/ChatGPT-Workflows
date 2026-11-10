"""Verify this versioned source distribution using only local Python and Node."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
if not __debug__:
    raise SystemExit("Run verification without -O or PYTHONOPTIMIZE; assertions must remain enabled.")
manifest = json.loads((root / "delivery-manifest.json").read_text(encoding="utf-8"))
expected = {row["path"] for row in manifest["files"]}
actual = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}
assert actual == expected | {"delivery-manifest.json"}, "Unexpected or missing baseline files"
assert len(expected) == len(manifest["files"]), "Duplicate manifest path"
for row in manifest["files"]:
    p = (root / row["path"]).resolve()
    assert p.is_relative_to(root), "Manifest path escapes delivery"
    raw = p.read_bytes()
    assert len(raw) == row["bytes"]
    assert hashlib.sha256(raw).hexdigest() == row["sha256"], row["path"]
extension = root / "extension"
product = json.loads((extension / "manifest.json").read_text(encoding="utf-8"))
assert product["version"] == manifest["applicationVersion"] == "0.6.7"
assert product["permissions"] == ["activeTab", "scripting"]
assert not any(k in product for k in ["host_permissions", "optional_permissions", "content_scripts"])
assert hashlib.sha256((extension / "collector.js").read_bytes()).hexdigest() == manifest["collectorSha256"]
for name in ["collector.js", "worker.js"]:
    subprocess.run(["node", "--check", name], cwd=extension, check=True)
results = []
test_env = os.environ.copy()
test_env.pop("COLLECTOR_SOURCE", None)
for name, count in [("test-portable.cjs", 40), ("test-menu.cjs", 15), ("test-text-scope.cjs", 8)]:
    run = subprocess.run(["node", name], cwd=extension, env=test_env, check=True, capture_output=True, text=True, encoding="utf-8")
    j = json.loads(run.stdout)
    assert j["result"] == "PASS" and j["cases"] == count
    results.append({"suite": name, "cases": count, "result": "PASS"})
print(json.dumps({"result": "PASS", "filesVerified": len(expected), "tests": results,
                  "total": sum(r["cases"] for r in results), "network": "NONE", "browser": "NOT_RUN"}))
