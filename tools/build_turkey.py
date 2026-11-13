"""İl seçim ekranı için kabartma Türkiye haritası, il sınır yolları ve 81 ilin oyun verisini üretir.

Girdi (data/tr): dem_z8.npy (AWS Terrain Tiles), adm1.geojson (geoBoundaries, OSM kaynaklı, CC BY-SA 2.0),
wikidata_pop.json (Wikidata, CC0). Çıktı: app/img/turkiye.webp, app/img/ahsap.webp, app/data/iller.json
"""
import json
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from shapely.geometry import shape

meta = json.load(open("data/tr/dem_z8.json"))
dem = np.load("data/tr/dem_z8.npy")
Z = meta["z"]
N = 2 ** Z * 256


def px(lon, lat):
    x = (lon + 180) / 360 * N - meta["x0"] * 256
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * N - meta["y0"] * 256
    return x, y


# kırpma: Türkiye + pay
cx0, cy0 = (int(v) for v in px(25.0, 42.75))
cx1, cy1 = (int(v) for v in px(45.5, 35.2))
dem = dem[cy0:cy1, cx0:cx1]
H, W = dem.shape
geo = json.load(open("data/tr/adm1.geojson", encoding="utf-8"))

# ---- il maskesi ve SVG yolları ----
mask_img = Image.new("L", (W, H), 0)
draw = ImageDraw.Draw(mask_img)
paths = {}
for f in geo["features"]:
    g = shape(f["geometry"]).simplify(0.004, preserve_topology=True)
    polys = list(g.geoms) if g.geom_type == "MultiPolygon" else [g]
    d = []
    for p in polys:
        for i, ring in enumerate([p.exterior, *p.interiors]):
            pts = [(px(x, y)[0] - cx0, px(x, y)[1] - cy0) for x, y in ring.coords]
            if i == 0:
                draw.polygon(pts, fill=255)
            if len(pts) > 3:
                d.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts[:-1]) + "Z")
    big = max(polys, key=lambda p: p.area)
    c = big.centroid if big.contains(big.centroid) else big.representative_point()
    lx, ly = px(c.x, c.y)
    b = g.bounds
    x_a, y_a = px(b[0], b[3]); x_b, y_b = px(b[2], b[1])
    paths[f["properties"]["shapeName"]] = {
        "d": "".join(d), "c": [round(lx - cx0, 1), round(ly - cy0, 1)],
        "box": [round(x_a - cx0), round(y_a - cy0), round(x_b - cx0), round(y_b - cy0)],
        "km2": round(g.area * 111.2 * 111.2 * math.cos(math.radians(c.y))),
    }
tr = np.asarray(mask_img, np.float32) / 255.0

# ---- kabartma ----
land = dem > 0.5
flat = ndimage.binary_opening((np.abs(np.gradient(dem)[0]) + np.abs(np.gradient(dem)[1])) < 0.01, iterations=1) & land
lab, n = ndimage.label(flat)
sizes = ndimage.sum(flat, lab, range(1, n + 1))
lake = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 220])
lake = ndimage.binary_dilation(lake, iterations=1)
water = ~land | lake

cell = 40075016.7 / N * math.cos(math.radians(39))
sm = ndimage.gaussian_filter(dem, 0.8)
gy, gx = np.gradient(sm, cell)
EX = 7.0
az, alt = math.radians(315), math.radians(42)
slope = np.arctan(EX * np.hypot(gx, gy))
aspect = np.arctan2(gy, -gx)
shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - math.pi / 2 - aspect)
shade = np.clip(shade, 0, 1)
local = np.tanh((sm - ndimage.gaussian_filter(sm, 14)) / 420.0)  # vadiler koyu, sırtlar açık

stops = [(0, (118, 158, 98)), (300, (150, 172, 104)), (800, (196, 190, 128)), (1300, (206, 172, 116)),
         (1900, (182, 140, 100)), (2600, (160, 124, 100)), (3300, (226, 222, 216))]
e = np.clip(sm, 0, 3300)
col = np.zeros((H, W, 3), np.float32)
for i in range(3):
    col[..., i] = np.interp(e, [s[0] for s in stops], [s[1][i] for s in stops])
relief = col * (0.52 + 0.78 * shade[..., None]) * (1 + 0.16 * local[..., None])

parch = np.array([214, 198, 164], np.float32) * (0.9 + 0.16 * shade[..., None])  # komşu ülkeler: düz parşömen
depth = np.clip(-dem / 2500.0, 0, 1)[..., None]
sea = np.array([112, 160, 190], np.float32) * (1 - depth) + np.array([70, 118, 160], np.float32) * depth

img = parch * (1 - tr[..., None]) + relief * tr[..., None]
wm = ndimage.gaussian_filter(water.astype(np.float32), 0.7)[..., None]
img = img * (1 - wm) + sea * wm

# yükseltilmiş harita hissi: Türkiye'nin dışına gölge, kuzeybatı kenarına ışık
sh = ndimage.gaussian_filter(np.roll(np.roll(tr, 9, 0), 7, 1), 5)
img *= 1 - 0.42 * np.clip(sh - tr, 0, 1)[..., None]
hl = np.clip(tr - ndimage.gaussian_filter(np.roll(np.roll(tr, 3, 0), 3, 1), 1.5), 0, 1)
img += 46 * hl[..., None]

# kâğıt dokusu ve kenar kararması
rng = np.random.default_rng(3)
img += ndimage.gaussian_filter(rng.normal(0, 9, (H, W)), 1.1)[..., None]
yy, xx = np.mgrid[0:H, 0:W]
vig = 1 - 0.2 * np.clip(np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)) - 0.72, 0, 1) ** 1.5
img = np.clip(img * vig[..., None], 0, 255).astype(np.uint8)
Image.fromarray(img).save("app/img/turkiye.webp", quality=86, method=5)
print("harita", W, H)

# ---- ahşap masa dokusu (kodla üretildi) ----
S = 1024
r2 = np.random.default_rng(11)
grain = ndimage.gaussian_filter(r2.normal(0, 1, (S, S)), (1.2, 60), mode="wrap")
grain = grain / grain.std()
fine = ndimage.gaussian_filter(r2.normal(0, 1, (S, S)), (0.6, 14), mode="wrap")
plank_h = S // 4
tone = np.repeat(r2.uniform(0.86, 1.1, 4), plank_h)[:, None]
seam = np.minimum(np.arange(S) % plank_h, plank_h - np.arange(S) % plank_h)[:, None]
v = (0.5 + 0.13 * grain + 0.05 * fine / fine.std()) * tone * (0.55 + 0.45 * np.clip(seam / 3.0, 0, 1))
wood = np.clip(np.stack([v * 150 + 22, v * 96 + 12, v * 58 + 6], -1), 0, 255).astype(np.uint8)
Image.fromarray(wood).save("app/img/ahsap.webp", quality=80)

# ---- 81 ilin oyun verisi ----
REGIONS = {
    "Marmara": "İstanbul Edirne Kırklareli Tekirdağ Kocaeli Yalova Sakarya Bilecik Bursa Balıkesir Çanakkale",
    "Ege": "İzmir Manisa Aydın Denizli Muğla Uşak Kütahya Afyonkarahisar",
    "Akdeniz": "Antalya Isparta Burdur Mersin Adana Osmaniye Hatay Kahramanmaraş",
    "İç Anadolu": "Ankara Konya Eskişehir Kayseri Sivas Yozgat Kırıkkale Kırşehir Nevşehir Niğde Aksaray Karaman Çankırı",
    "Karadeniz": "Bolu Düzce Zonguldak Bartın Karabük Kastamonu Sinop Çorum Amasya Samsun Tokat Ordu Giresun Trabzon Rize Artvin Gümüşhane Bayburt",
    "Doğu Anadolu": "Erzurum Erzincan Kars Ardahan Iğdır Ağrı Van Hakkâri Muş Bitlis Bingöl Tunceli Elazığ Malatya",
    "Güneydoğu Anadolu": "Gaziantep Kilis Şanlıurfa Adıyaman Diyarbakır Mardin Batman Siirt Şırnak",
}
# Oyun dengesi için sadeleştirilmiş bölgesel riskler (resmî afet haritası değildir). 3 = yüksek, 2 = orta
RISK = {
    "Marmara": {"Deprem": 3, "Sel": 2}, "Ege": {"Deprem": 3, "Orman yangını": 3},
    "Akdeniz": {"Orman yangını": 3, "Sel": 2, "Deprem": 2}, "İç Anadolu": {"Kuraklık": 3, "Deprem": 2},
    "Karadeniz": {"Sel ve heyelan": 3, "Deprem": 2}, "Doğu Anadolu": {"Deprem": 3, "Çığ": 3},
    "Güneydoğu Anadolu": {"Kuraklık": 3, "Deprem": 2},
}
OVERRIDE = {
    **{k: {"Deprem": 3} for k in ("Hatay", "Kahramanmaraş", "Osmaniye", "Adıyaman", "Bolu", "Düzce")},
    **{k: {"Çığ": 2} for k in ("Rize", "Artvin", "Trabzon", "Gümüşhane", "Bayburt")},
    "Edirne": {"Sel": 3},
}
norm = lambda s: s.replace("â", "a").replace("î", "i").casefold()
pop = {norm(r["name"].replace(" ili", "")): r for r in json.load(open("data/tr/wikidata_pop.json", encoding="utf-8"))}
region_of = {name: reg for reg, names in REGIONS.items() for name in names.split()}
assert len(region_of) == 81, len(region_of)
iller = []
for name, p in paths.items():
    w = pop[norm(name)]
    reg = region_of[name]
    risks = {**RISK[reg], **OVERRIDE.get(name, {})}
    seed = np.random.default_rng(int(w["plaka"]))
    high = sum(1 for v in risks.values() if v == 3)
    score = high + (w["pop"] > 2_000_000) + (w["pop"] > 5_000_000)
    iller.append({
        "plaka": w["plaka"], "ad": name, "bolge": reg, "nufus": w["pop"], "km2": p["km2"],
        "butce": max(60, round(w["pop"] * 224 / 1e6 / 5) * 5),  # milyon ₺
        "direnc": int(seed.integers(28, 62)), "riskler": risks,
        "zorluk": "Zor" if score >= 3 else "Orta" if score == 2 else "Kolay",
        "hazir": name == "İstanbul", "d": p["d"], "c": p["c"], "box": p["box"],
    })
iller.sort(key=lambda i: i["plaka"])
json.dump({"w": W, "h": H, "iller": iller}, open("app/data/iller.json", "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print(len(iller), "il;", {z: sum(1 for i in iller if i["zorluk"] == z) for z in ("Kolay", "Orta", "Zor")})
