"""Independent filesystem reader: no Nihon, browser, fixtures or seeding."""
import hashlib
import json
import pathlib
import sqlite3
import sys

root = pathlib.Path(sys.argv[1]).resolve()
results = []
for path in sorted(root.rglob("localstorage.sqlite3")):
    record = {"path": str(path.relative_to(root)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    try:
        db = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
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
        record["rows"] = rows
    except Exception as error:
        record["error"] = str(error)
    results.append(record)
print(json.dumps({"reader": "independent Python SQLite mode=ro query_only", "root": str(root), "results": results}, indent=2))
sys.exit(1 if any("error" in result for result in results) else 0)
