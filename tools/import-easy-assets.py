"""Impor PNG Easy dan simpan alias, dimensi, serta SHA-256; tanpa duplikasi byte.
Usage: python tools/import-easy-assets.py "archive21.zip" "archive22.zip"
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import io
import json
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
assets = root / "assets"
out = assets / "easy"
out.mkdir(exist_ok=True)
existing = {hashlib.sha256(f.read_bytes()).hexdigest(): f for f in assets.rglob("*.png") if out not in f.parents}
seen, aliases = {}, []
for archive in map(Path, sys.argv[1:]):
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            if not entry.filename.lower().endswith(".png"):
                continue
            data = z.read(entry)
            sha = hashlib.sha256(data).hexdigest()
            im = Image.open(io.BytesIO(data))
            if sha not in seen:
                dest = existing.get(sha, out / ("asset-" + sha[:12] + ".png"))
                if not dest.exists():
                    dest.write_bytes(data)
                seen[sha] = dest
            aliases.append({"archive": archive.name, "entry": entry.filename,
                "path": seen[sha].relative_to(root).as_posix(), "sha256": sha,
                "width": im.width, "height": im.height})
(out / "sources.json").write_text(json.dumps(aliases, indent=2), encoding="utf-8")
unique = {a["sha256"]: a for a in aliases}
preview = Image.new("RGB", (800, ((len(unique)+3)//4)*170), "#ead6b0")
draw = ImageDraw.Draw(preview)
for i, a in enumerate(unique.values()):
    im = Image.open(root / a["path"]).convert("RGBA")
    im.thumbnail((185, 125))
    x, y = (i%4)*200, (i//4)*170
    preview.paste(im, (x+(200-im.width)//2,y), im)
    draw.text((x+5,y+127), Path(a["path"]).name[:25], fill="black")
    draw.text((x+5,y+143), f'{a["width"]}x{a["height"]}', fill="black")
preview_path = root / "test-results/easy-assets.jpg"
preview_path.parent.mkdir(exist_ok=True)
preview.save(preview_path)
print(f"{len(aliases)} entries -> {len(unique)} unique images; {len(list(out.glob('*.png')))} new PNG files")
print(json.dumps(list(unique.values()),indent=2))

# Normalisasi ruang transparan supaya empat pilihan tampil dengan tinggi seragam.
for character, source in {"koki":"Koki (1).png","puput":"neng-puput.png","pipit":"ceu-pipit.png","ucil":"mang-ucil.png"}.items():
    im=Image.open(assets/source).convert("RGBA")
    im=im.crop(im.getbbox())
    im=im.resize((round(im.width*256/im.height),256),Image.Resampling.NEAREST)
    im.save(out/f"chef-{character}.png")
atlas=Image.open(assets/"game-atlas.png")
atlas.crop((758,747,907,832)).save(out/"food-a.png")
atlas.crop((2,867,137,944)).save(out/"food-b.png")
manifest={}
for f in sorted(assets.rglob("*")):
    if f.suffix.lower() in (".png",".jpg",".jpeg",".webp"):
        with Image.open(f) as im:manifest[f.relative_to(assets).as_posix()]={"width":im.width,"height":im.height}
(assets/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
