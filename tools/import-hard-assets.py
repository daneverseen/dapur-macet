"""Impor referensi Hard dari ZIP 23, deduplikasi SHA-256, dan perbarui dimensi."""
from pathlib import Path
from PIL import Image, ImageDraw
import zipfile, hashlib, json, io, sys
root=Path(__file__).resolve().parents[1]
assets=root/"assets"
out=assets/"hard"
out.mkdir(exist_ok=True)
existing={hashlib.sha256(f.read_bytes()).hexdigest():f for f in assets.rglob("*.png") if out not in f.parents}
sources=[]
with zipfile.ZipFile(sys.argv[1]) as z:
    for e in z.infolist():
        if not e.filename.lower().endswith(".png"):continue
        data=z.read(e);sha=hashlib.sha256(data).hexdigest();im=Image.open(io.BytesIO(data))
        dest=existing.get(sha,out/Path(e.filename).name)
        if not dest.exists():dest.write_bytes(data)
        sources.append({"entry":e.filename,"path":dest.relative_to(root).as_posix(),"sha256":sha,"width":im.width,"height":im.height})
(out/"sources.json").write_text(json.dumps(sources,indent=2),encoding="utf-8")
manifest={}
for f in sorted(assets.rglob("*")):
    if f.suffix.lower() in (".png",".jpg",".jpeg",".webp"):
        with Image.open(f) as im:manifest[f.relative_to(assets).as_posix()]={"width":im.width,"height":im.height}
(assets/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
sheet=Image.new("RGB",(960,410),"#e8d1ad");d=ImageDraw.Draw(sheet)
for i,s in enumerate(sources):
    im=Image.open(root/s["path"]).convert("RGB");im.thumbnail((320,180));x,y=(i%3)*320,(i//3)*205
    sheet.paste(im,(x,y));d.text((x+8,y+183),s["entry"],fill="black")
(root/"test-results").mkdir(exist_ok=True)
sheet.save(root/"test-results/hard-assets.jpg")
print(json.dumps(sources,indent=2))
