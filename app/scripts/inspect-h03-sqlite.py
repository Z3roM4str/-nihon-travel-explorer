"""Independent filesystem reader: no Nihon, browser, fixtures or seeding."""
import hashlib
import json
import pathlib
import sqlite3
import sys
import shutil
import tempfile

root = pathlib.Path(sys.argv[1]).resolve()
results = []
# WPE uses localstorage.sqlite3; the independent macOS port retains origin-named
# *.localstorage SQLite files. Their WAL/SHM companions are copied identically.
paths = sorted(set(root.rglob("localstorage.sqlite3")) | set(root.rglob("*.localstorage")))
for path in paths:
    record = {"path": str(path.relative_to(root)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    try:
        # Even SQLite's shared-memory bookkeeping stays off the preserved file.
        temporary = tempfile.TemporaryDirectory()
        copy = pathlib.Path(temporary.name) / path.name
        for suffix in ["", "-wal", "-shm"]:
            original = pathlib.Path(str(path) + suffix)
            if original.exists():
                shutil.copy2(original, pathlib.Path(str(copy) + suffix))
        db = sqlite3.connect(copy.as_uri() + "?mode=ro", uri=True)
        db.execute("PRAGMA query_only=ON")
        rows = []
        for key, value in db.execute("SELECT key,value FROM ItemTable"):
            decode = lambda data: data.decode("utf-16-le" if b"\x00" in data else "utf-8") if isinstance(data, bytes) else data
            if decode(key) == "nihon.travellers.v1":
                raw = decode(value)
                rows.append({"raw": raw, "hex": value.hex() if isinstance(value, bytes) else None,
                             "travellerIds": [p["id"] for p in json.loads(raw)["travellers"]],
                             "interests": [p["placeId"] for p in json.loads(raw)["interests"]]})
        db.close()
        temporary.cleanup()
        record["rows"] = rows
    except Exception as error:
        record["error"] = str(error)
    results.append(record)
required = "--require-localstorage" in sys.argv[2:]
missing = required and not paths
print(json.dumps({"reader": "independent Python SQLite mode=ro query_only", "root": str(root),
                  "requireLocalStorage": required, "missingRequiredDatabases": missing, "results": results}, indent=2))
sys.exit(1 if missing or any("error" in result for result in results) else 0)
