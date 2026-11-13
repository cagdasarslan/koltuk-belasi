"""Her mahallenin karakterini uydu verisinden çıkarır ve mahalleler.geojson'a yazar.

tip: yogun (yoğun kent) | konut | sanayi | orman | kirsal;  kiyi: deniz/göl kenarı mı;  pop: tahmini nüfus
Kaynak: Sentinel-2 sahne sınıflandırması (bitki/yapılaşma/su) ve gerçek renk görüntüsü (parlak çatı oranı).
"""
import json
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

scl = np.load("data/scl_z13.npy", mmap_mode="r")
sm = json.load(open("data/scl_z13.npy.json"))
mos = np.load("data/mosaic_z14.npy", mmap_mode="r")
mm = json.load(open("data/mosaic_z14.npy.json"))
N = 2 ** 13 * 256
OX, OY = sm["tx0"] * 256, sm["ty0"] * 256
MX, MY = mm["tx0"] * 256 - 2 * OX, mm["ty0"] * 256 - 2 * OY  # z14 mozaiğinin z13 ızgarasına göre kayması (z14 px)


def px(lon, lat):
    x = (lon + 180) / 360 * N - OX
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * N - OY
    return x, y


geo = json.load(open("app/data/mahalleler.geojson", encoding="utf-8"))
ilce = {f["properties"]["id"]: f["properties"] for f in json.load(open("app/data/ilceler.geojson", encoding="utf-8"))["features"]}
ilce_yogunluk = {k: int(v.get("population") or 300000) / max(1.0, v["area"]) for k, v in ilce.items()}  # kişi/km²
PAD = 26  # ~370 m
rows = []
for f in geo["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    pts = [[px(x, y) for x, y in poly[0]] for poly in polys]
    xs = [p[0] for ring in pts for p in ring]; ys = [p[1] for ring in pts for p in ring]
    x0, y0 = int(min(xs)) - PAD, int(min(ys)) - PAD
    x1, y1 = int(max(xs)) + PAD + 1, int(max(ys)) + PAD + 1
    x0, y0 = max(0, x0), max(0, y0)
    im = Image.new("L", (x1 - x0, y1 - y0), 0)
    d = ImageDraw.Draw(im)
    for ring in pts:
        d.polygon([(x - x0, y - y0) for x, y in ring], fill=1)
    m = np.asarray(im, bool)
    s = np.asarray(scl[y0:y1, x0:x1, 0])
    m = m[: s.shape[0], : s.shape[1]]
    n = max(1, m.sum())
    veg = ((s == 4) & m).sum() / n
    built = ((s == 5) & m).sum() / n
    big = ndimage.binary_dilation(m, iterations=PAD - 2)
    shore = ((s == 6) & big).sum() / max(1, big.sum())
    # parlak, renksiz çatılar (depo/fabrika): z14 mozaiğinden yarı çözünürlükte
    a = np.asarray(mos[max(0, 2 * y0 - MY):2 * y1 - MY:2, max(0, 2 * x0 - MX):2 * x1 - MX:2]).astype(np.int16)
    hh, ww = min(a.shape[0], m.shape[0]), min(a.shape[1], m.shape[1])
    a, mk = a[:hh, :ww], m[:hh, :ww]
    bright = ((a.mean(2) > 150) & ((a.max(2) - a.min(2)) < 40) & mk).sum() / max(1, mk.sum())
    p = f["properties"]
    area = p["area"]
    if bright > 0.2 and veg < 0.45:
        tip = "sanayi"
    elif veg > 0.6:
        tip = "orman"
    elif area > 4 and ilce_yogunluk[p["ilce"]] < 2500:
        tip = "kirsal"  # geniş mahalle + seyrek ilçe: köy/tarım alanı (kalabalık ilçedeki geniş mahalle konut sayılır)
    elif area <= 1.0 and veg < 0.25:
        tip = "yogun"
    else:
        tip = "konut"
    dens = {"yogun": 1.7, "konut": 1.0, "sanayi": 0.35, "orman": 0.1, "kirsal": 0.18}[tip]
    p.update(tip=tip, kiyi=bool(shore > 0.07), _w=dens * min(max(area, 0.12), 4.0))
    rows.append((p["name"], ilce[p["ilce"]]["name"], tip, p["kiyi"], round(area, 2), round(veg, 2), round(built, 2), round(bright, 2), round(shore, 2)))

# ilçe nüfusunu mahallelere ağırlıkla dağıt
tot = {}
for f in geo["features"]:
    p = f["properties"]; tot[p["ilce"]] = tot.get(p["ilce"], 0) + p["_w"]
for f in geo["features"]:
    p = f["properties"]
    p["pop"] = int(round((int(ilce[p["ilce"]].get("population") or 300000)) * p["_w"] / tot[p["ilce"]] / 100) * 100)
    del p["_w"]
json.dump(geo, open("app/data/mahalleler.geojson", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

from collections import Counter
print(Counter(r[2] for r in rows), "kıyı:", sum(r[3] for r in rows))
want = ["Balat", "Caferağa", "Fenerbahçe", "Dudullu OSB", "İkitelli OSB", "Levent", "Tarabya", "Polonezköy", "Hadımköy", "Yalıköy", "Burgazada", "Bebek", "Kumkapı", "Organize Sanayi Bölgesi", "Maslak", "Riva", "Ağva Merkez", "Esenkent", "Güzeltepe", "Cankurtaran"]
for r in rows:
    if r[0] in want:
        print(r)
