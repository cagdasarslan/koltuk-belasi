"""Sentinel-2 TCI sahnelerinden Web Mercator mozaik üretir.

Kullanım: python tools/mosaic.py <zoom> <cikti.npy>
Çıktı: uint8 (H, W, 3) numpy memmap + yanında .json (sınırlar, karo ofseti).
Kaynak: Copernicus Sentinel-2 L2A (Earth Search / AWS açık veri), değiştirilmiş.
"""
import json
import math
import os
import sys
import threading
import time

# GDAL ayarları ortam değişkeni olarak verilir ki iş parçacıklarının hepsi görsün.
os.environ.update({
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "AWS_NO_SIGN_REQUEST": "YES",
    "GDAL_HTTP_MULTIRANGE": "YES", "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "VSI_CACHE": "TRUE", "GDAL_CACHEMAX": "512", "GDAL_HTTP_MAX_RETRY": "5",
    "GDAL_HTTP_RETRY_DELAY": "2", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
})
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import transform_bounds
from rasterio.windows import Window

ZOOM = int(sys.argv[1])
OUT = sys.argv[2]
ASSET = sys.argv[3] if len(sys.argv) > 3 else "visual"
NB = 3 if ASSET == "visual" else 1
BASE = 10 if ASSET == "visual" else 20
RESAMP = Resampling.cubic if ASSET == "visual" else Resampling.nearest
BBOX = (27.9, 40.75, 30.0, 41.65)  # batı, güney, doğu, kuzey
TILES = ["35TPF", "35TQF", "35TNF", "35TPG", "35TQG", "35TNG"]
DATES = ["2025-07-22", "2025-07-27", "2025-07-25", "2025-07-07", "2025-07-05", "2025-07-09", "2025-06-27"]
R = 6378137.0
WORLD = 2 * math.pi * R


def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


x0, y0 = tile_xy(BBOX[0], BBOX[3], ZOOM)
x1, y1 = tile_xy(BBOX[2], BBOX[1], ZOOM)
tx0, ty0, tx1, ty1 = math.floor(x0), math.floor(y0), math.ceil(x1), math.ceil(y1)
W, H = (tx1 - tx0) * 256, (ty1 - ty0) * 256
res = WORLD / (2 ** ZOOM * 256)
left = -WORLD / 2 + tx0 * 256 * res
top = WORLD / 2 - ty0 * 256 * res
dst_transform = from_origin(left, top, res, res)
print(f"zoom {ZOOM}: {W}x{H} px, {res:.2f} m/px (mercator), karo x {tx0}-{tx1} y {ty0}-{ty1}", flush=True)

if os.path.exists(OUT) and "--devam" in sys.argv:
    mos = np.lib.format.open_memmap(OUT, mode="r+")  # yarım kalan indirmeyi sürdür
    assert mos.shape == (H, W, NB)
else:
    mos = np.lib.format.open_memmap(OUT, mode="w+", dtype=np.uint8, shape=(H, W, NB))
    mos[:] = 0

items = json.load(open("data/scenes.json"))
index = {}
for it in items:
    p = it["properties"]
    tile = f'{p["mgrs:utm_zone"]}{p["mgrs:latitude_band"]}{p["mgrs:grid_square"]}'
    index.setdefault((p["datetime"][:10], tile), it)

local = threading.local()
BLOCK = 1024


def get_vrt(href):
    cache = getattr(local, "cache", None)
    if cache is None:
        cache = local.cache = {}
    if href not in cache:
        # WarpedVRT kaynak küçültmelerini kendisi seçmez; uygun overview'u elle aç.
        ground = res * math.cos(math.radians((BBOX[1] + BBOX[3]) / 2))
        factors = [f for f in (2, 4, 8, 16) if BASE * f <= ground]
        src = rasterio.open(href, overview_level=len(factors) - 1) if factors else rasterio.open(href)
        cache[href] = WarpedVRT(
            src, crs="EPSG:3857", transform=dst_transform, width=W, height=H,
            resampling=RESAMP, src_nodata=0, nodata=0,
        )
    return cache[href]


def do_block(args):
    href, col, row, w, h = args
    dst = mos[row:row + h, col:col + w]
    hole = (dst == 0).all(axis=2)
    if not hole.any():
        return 0
    for attempt in range(6):
        try:
            data = get_vrt(href).read(window=Window(col, row, w, h))  # (NB, h, w)
            break
        except Exception as e:  # geçici ağ hatası: bağlantıyı yenile, tekrar dene
            local.cache.pop(href, None)
            if attempt == 5:
                raise
            print(f"  tekrar {attempt + 1}: blok {col},{row} ({type(e).__name__})", flush=True)
            time.sleep(3 * (attempt + 1))
    data = np.moveaxis(data[:NB], 0, 2)
    ok = hole & (data != 0).any(axis=2)
    dst[ok] = data[ok]
    return int(ok.sum())


with ThreadPoolExecutor(8) as pool:
    for date in DATES:
        for tile in TILES:
            it = index.get((date, tile))
            if it is None:
                continue
            total_holes = int((mos[::8, ::8] == 0).all(axis=2).sum())
            if total_holes == 0:
                break
            href = it["assets"][ASSET]["href"]
            with rasterio.open(href) as src:
                b = transform_bounds(src.crs, "EPSG:3857", *src.bounds, densify_pts=21)
            c0 = max(0, int((b[0] - left) / res)); c1 = min(W, int(math.ceil((b[2] - left) / res)))
            r0 = max(0, int((top - b[3]) / res)); r1 = min(H, int(math.ceil((top - b[1]) / res)))
            if c1 <= c0 or r1 <= r0:
                continue
            jobs = [(href, c, r, min(BLOCK, c1 - c), min(BLOCK, r1 - r))
                    for r in range(r0, r1, BLOCK) for c in range(c0, c1, BLOCK)]
            filled = sum(pool.map(do_block, jobs))
            print(f"{date} {tile}: {len(jobs)} blok, {filled / 1e6:.2f} MP dolduruldu", flush=True)

mos.flush()
left_px = float((mos[::4, ::4] == 0).all(axis=2).mean())
print(f"boş kalan oran: {left_px:.4%}")
json.dump({"zoom": ZOOM, "tx0": tx0, "ty0": ty0, "tx1": tx1, "ty1": ty1, "width": W, "height": H,
           "bbox": BBOX, "dates": DATES}, open(OUT + ".json", "w"))
