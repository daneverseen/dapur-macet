"""Audit path aset statis, ID DOM, dan inventaris gambar tanpa dependency."""
from pathlib import Path
from html.parser import HTMLParser
import json
import re

root = Path(__file__).resolve().parents[1]
missing = []
class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key == "id":
                self.ids.append(value)
            if key in ("src", "href") and value and not value.startswith(("http", "data:", "#")):
                if not (root / value).is_file():
                    missing.append(value)

doc = Document()
doc.feed((root / "index.html").read_text(encoding="utf-8"))
duplicate_ids = {value for value in doc.ids if doc.ids.count(value) > 1}
for path in (root / "css").glob("*.css"):
    for value in re.findall(r'''url\(["']?([^"')]+)''', path.read_text(encoding="utf-8")):
        if not value.startswith("data:") and not (path.parent / value).is_file():
            missing.append(value)
for path in (root / "js").glob("*.js"):
    for value in re.findall(r'''["'](assets/[^"'`$\n]+\.(?:png|webp|jpg|js|ttf))["']''', path.read_text(encoding="utf-8")):
        if not (root / value).is_file():
            missing.append(value)
manifest = json.loads((root / "assets/manifest.json").read_text())
for name, size in manifest.items():
    assert (root / "assets" / name).is_file(), name
    assert size["width"] > 0 and size["height"] > 0, name
assert not missing, f"Missing asset paths: {missing}"
assert not duplicate_ids, f"Duplicate DOM IDs: {duplicate_ids}"
print(f"Static asset paths valid; {len(doc.ids)} unique DOM IDs; {len(manifest)} images inventoried.")
