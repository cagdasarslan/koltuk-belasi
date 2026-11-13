"""İstanbul'u kapsayan düşük bulutlu Sentinel-2 L2A sahnelerini Earth Search STAC'ten listeler."""
import json
import sys
import requests

BBOX = [27.9, 40.75, 30.0, 41.65]  # İstanbul ili + pay
URL = "https://earth-search.aws.element84.com/v1/search"

date_range = sys.argv[1] if len(sys.argv) > 1 else "2025-06-01T00:00:00Z/2025-09-30T23:59:59Z"
body = {
    "collections": ["sentinel-2-l2a"],
    "bbox": BBOX,
    "datetime": date_range,
    "query": {"eo:cloud_cover": {"lt": 3}},
    "limit": 200,
}
items = []
while True:
    r = requests.post(URL, json=body, timeout=60)
    r.raise_for_status()
    j = r.json()
    items += j["features"]
    nxt = [l for l in j.get("links", []) if l["rel"] == "next"]
    if not nxt:
        break
    body = nxt[0]["body"]

by_date = {}
for it in items:
    p = it["properties"]
    d = p["datetime"][:10]
    tile = f'{p["mgrs:utm_zone"]}{p["mgrs:latitude_band"]}{p["mgrs:grid_square"]}'
    by_date.setdefault(d, []).append((tile, round(p["eo:cloud_cover"], 2), it["id"]))

for d in sorted(by_date):
    tiles = sorted(by_date[d])
    print(d, len(tiles), " ".join(f"{t}:{c}" for t, c, _ in tiles))

json.dump(items, open(sys.argv[2] if len(sys.argv) > 2 else "data/scenes.json", "w"))
print("toplam", len(items))
