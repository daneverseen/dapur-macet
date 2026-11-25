"""Ekstrak sprite yang dipakai UI dari aset pengguna; tidak menghasilkan seni baru.
Jalankan dari root proyek. PNG hasilnya sudah disertakan, Pillow hanya diperlukan
jika ingin mengekstrak ulang. Referensi JPEG asli opsional (argumen pertama).
"""
from collections import deque
from pathlib import Path
import json
import sys
from PIL import Image

assets = Path(__file__).resolve().parents[1] / "assets"
out = assets / "medium"
out.mkdir(exist_ok=True)
atlas = Image.open(assets / "medium-atlas.png").convert("RGBA")

def crop(name, box):
    atlas.crop(box).save(out / name)

for name, box in {
    "food-2-1.png": (986, 500, 1098, 602),
    "food-2-2.png": (0, 633, 92, 703),
    "food-2-3.png": (1279, 500, 1382, 593),
    "chef-hijab.png": (260, 500, 334, 625),
    "chef-woman.png": (336, 500, 407, 621),
}.items():
    crop(name, box)

# Aset PNG belakang dan pelanggan sudah transparan dalam proyek sumber.
Image.open(assets / "Koki Tampak Belakang (1).png").save(out / "chef-man-back.png")
for i, source in enumerate(["Pelanggan.png", "Pelanggan (1).png", "Pelanggan.png"], 1):
    Image.open(assets / source).save(out / f"customer-{i}.png")

# Referensi layar berisi gambar makanan; ekstrak bagian dalam bubble saja.
reference = Image.open(assets / "match3/Medium 24.png")
for i, box in enumerate([(387, 135, 467, 210), (650, 151, 701, 218), (973, 145, 1027, 225)], 1):
    reference.crop(box).save(out / f"food-3-{i}.png")
Image.open(assets / "match2/Medium 14.png").resize((640, 360)).save(assets / "medium-preview.png")

if len(sys.argv) > 1:
    sheet = Image.open(sys.argv[1]).convert("RGBA")
    for name, box in {"chef-woman.png": (314, 198, 430, 381), "chef-hijab.png": (319, 380, 427, 558)}.items():
        im = sheet.crop(box)
        pixels = im.load()
        w, h = im.size
        q = deque([(x, y) for x in range(w) for y in (0, h-1)] + [(x, y) for y in range(h) for x in (0, w-1)])
        seen = set()
        while q:
            x, y = q.popleft()
            if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
                continue
            seen.add((x, y))
            r, g, b, a = pixels[x, y]
            if min(r, g, b) < 215 or max(r, g, b) - min(r, g, b) > 25:
                continue
            pixels[x, y] = (r, g, b, 0)
            q.extend([(x-1, y), (x+1, y), (x, y-1), (x, y+1)])
        im.crop(im.getbbox()).save(out / name)

manifest = {}
for path in sorted(assets.rglob("*")):
    if path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        with Image.open(path) as im:
            manifest[str(path.relative_to(assets)).replace("\\", "/")] = {"width": im.width, "height": im.height}
(assets / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print(f"{len(manifest)} aset diperiksa; sprite Medium diekstrak ke {out}")
