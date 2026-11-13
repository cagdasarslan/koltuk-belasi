"""Mozaiği oyun görünümüne çevirir ve XYZ karo piramidi üretir.

Adımlar: kara renk düzeltmesi -> su yüzeyini (uydu şeritleri yerine) derinlik tonlu
tek renkle boyama -> z14'ten z8'e WebP karolar.
Kullanım: python tools/build_tiles.py data/mosaic_z14.npy data/scl_z13.npy app/tiles [--onizleme dosya.jpg]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

MOS, SCL, OUT = sys.argv[1:4]
PREVIEW = sys.argv[sys.argv.index("--onizleme") + 1] if "--onizleme" in sys.argv else None
MIN_ZOOM = 8
STRIP = 1024
PAD = 24
DEEP = np.array([14, 38, 64], np.float32)      # açık deniz
SHALLOW = np.array([38, 104, 122], np.float32)  # kıyı sığlığı
VOID = (9, 13, 20)                              # veri dışı alan

m = json.load(open(MOS + ".json"))
sm = json.load(open(SCL + ".json"))
Z, W, H = m["zoom"], m["width"], m["height"]
mos = np.load(MOS, mmap_mode="r")
scl = np.load(SCL, mmap_mode="r")

# --- su maskesini mozaik ızgarasına hizala (SCL sınıf 6 = su) ---
f = 2 ** (Z - sm["zoom"])  # 2: büyüt, 1: aynı, <1: küçült
ox = int(m["tx0"] * 256 / f - sm["tx0"] * 256)
oy = int(m["ty0"] * 256 / f - sm["ty0"] * 256)
if f >= 1:
    f = int(f)
    part = np.asarray(scl[oy:oy + H // f + 1, ox:ox + W // f + 1, 0]) == 6
    water = np.repeat(np.repeat(part, f, 0), f, 1)[:H, :W]
else:
    step = int(1 / f)
    part = np.zeros((H, W), bool)
    got = np.asarray(scl[max(0, oy):oy + H * step:step, max(0, ox):ox + W * step:step, 0]) == 6
    y_off, x_off = max(0, -oy) // step, max(0, -ox) // step
    part[y_off:y_off + got.shape[0], x_off:x_off + got.shape[1]] = got[:H - y_off, :W - x_off]
    water = part
assert water.shape == (H, W), (water.shape, H, W)

# kıyı sığlığı: kara maskesinin geniş bulanığı (~1 km), düşük çözünürlükte hesaplanır
LOW = max(1, 2 ** (Z - 10))
land_low = Image.fromarray(((~water[::LOW, ::LOW]) * 255).astype(np.uint8))
glow_low = land_low.filter(ImageFilter.GaussianBlur(9))
rng = np.random.default_rng(7)


def grade(rgb):
    """Kara: orta tonları aç, kontrast ve doygunluğu hafif artır."""
    x = rgb.astype(np.float32) / 255.0
    x = np.clip((x - 0.03) / 0.92, 0, 1) ** 0.82
    x = x * x * (3 - 2 * x) * 0.35 + x * 0.65
    lum = (x * np.array([0.299, 0.587, 0.114], np.float32)).sum(2, keepdims=True)
    x = lum + (x - lum) * 1.12
    return np.clip(x * 255, 0, 255)


def strip(r0, r1):
    a0, a1 = max(0, r0 - PAD), min(H, r1 + PAD)
    land = grade(np.asarray(mos[a0:a1]))
    wm = Image.fromarray((water[a0:a1] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    alpha = (np.asarray(wm, np.float32) / 255.0)[..., None]
    l0, l1 = a0 // LOW, -(-a1 // LOW)
    g = glow_low.crop((0, l0, glow_low.width, l1)).resize((glow_low.width * LOW, (l1 - l0) * LOW), Image.BICUBIC)
    g = np.asarray(g, np.float32)[a0 - l0 * LOW:a0 - l0 * LOW + (a1 - a0), :W] / 255.0
    t = np.clip(g * 1.9, 0, 1)[..., None] ** 1.6
    sea = DEEP + (SHALLOW - DEEP) * t
    sea += rng.normal(0, 1.1, sea.shape[:2] + (1,)).astype(np.float32)
    out = land * (1 - alpha) + sea * alpha
    return np.clip(out, 0, 255).astype(np.uint8)[r0 - a0:r0 - a0 + (r1 - r0)]


graded_path = MOS.replace(".npy", "_graded.npy")
graded = np.lib.format.open_memmap(graded_path, mode="w+", dtype=np.uint8, shape=(H, W, 3))
for r in range(0, H, STRIP):
    graded[r:min(H, r + STRIP)] = strip(r, min(H, r + STRIP))
graded.flush()
print("renk düzeltme tamam", flush=True)

if PREVIEW:
    k = max(1, W // 1800)
    Image.fromarray(np.asarray(graded[::k, ::k])).save(PREVIEW, quality=90)


def write_tiles(arr, z, tx0, ty0):
    n = 0
    h, w = arr.shape[:2]
    for ty in range(h // 256):
        row = np.asarray(arr[ty * 256:(ty + 1) * 256])
        for tx in range(w // 256):
            tile = row[:, tx * 256:(tx + 1) * 256]
            if (tile == VOID).all():
                continue
            d = f"{OUT}/{z}/{tx0 + tx}"
            os.makedirs(d, exist_ok=True)
            Image.fromarray(tile).save(f"{d}/{ty0 + ty}.webp", quality=82, method=4)
            n += 1
    return n


def halve(arr, tx0, ty0, path):
    """Bir üst seviyeye in: karo ızgarasına oturması için gerekirse kenarlara dolgu ekle."""
    h, w = arr.shape[:2]
    pl, pt = (tx0 % 2) * 256, (ty0 % 2) * 256
    pw = w + pl + ((w + pl) // 256 % 2) * 256
    ph = h + pt + ((h + pt) // 256 % 2) * 256
    out = np.lib.format.open_memmap(path, mode="w+", dtype=np.uint8, shape=(ph // 2, pw // 2, 3))
    for r in range(0, ph, 512):
        buf = np.empty((512, pw, 3), np.float32)
        buf[:] = VOID
        s0, s1 = max(0, r - pt), min(h, r + 512 - pt)
        if s1 > s0:
            buf[s0 + pt - r:s1 + pt - r, pl:pl + w] = arr[s0:s1]
        out[r // 2:r // 2 + 256] = buf.reshape(256, 2, pw // 2, 2, 3).mean((1, 3)).round().astype(np.uint8)
    out.flush()
    return out, tx0 // 2, ty0 // 2


arr, tx0, ty0 = graded, m["tx0"], m["ty0"]
levels = {}
for z in range(Z, MIN_ZOOM - 1, -1):
    n = write_tiles(arr, z, tx0, ty0)
    levels[z] = n
    print(f"z{z}: {n} karo", flush=True)
    if z > MIN_ZOOM:
        arr, tx0, ty0 = halve(arr, tx0, ty0, MOS.replace(".npy", f"_lvl{z - 1}.npy"))

json.dump({"minZoom": MIN_ZOOM, "maxZoom": Z, "bbox": m["bbox"], "tiles": levels,
           "attribution": "Contains modified Copernicus Sentinel data 2025"},
          open(f"{OUT}/meta.json", "w"))
