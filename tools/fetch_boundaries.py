"""OSM'den İstanbul ilçe (admin_level=6) ve mahalle (admin_level=8) sınırlarını çekip
sadeleştirilmiş GeoJSON üretir. Veri: © OpenStreetMap katkıcıları (ODbL)."""
import json
import sys
import time

import requests
from shapely.geometry import LineString, MultiPolygon, Polygon, mapping
from shapely.ops import polygonize, unary_union

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
PROVINCE = "İstanbul"


def overpass(q):
    last = None
    for attempt in range(3):
        for url in ENDPOINTS:
            try:
                r = requests.post(url, data={"data": q}, timeout=400,
                                  headers={"User-Agent": "city-game-prototype/0.1"})
                if r.status_code == 200 and r.text.lstrip().startswith("{"):
                    return r.json()
                last = f"{url} -> {r.status_code}"
            except Exception as e:  # ağ hatası: sıradaki sunucu
                last = f"{url} -> {e}"
            print("tekrar:", last, flush=True)
        time.sleep(10)
    raise SystemExit(f"Overpass başarısız: {last}")


def rel_to_geom(rel):
    outers, inners = [], []
    for m in rel.get("members", []):
        if m["type"] != "way" or "geometry" not in m:
            continue
        line = LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
        (inners if m.get("role") == "inner" else outers).append(line)
    polys = list(polygonize(unary_union(outers))) if outers else []
    if not polys:
        return None
    geom = unary_union(polys)
    holes = list(polygonize(unary_union(inners))) if inners else []
    if holes:
        geom = geom.difference(unary_union(holes))
    return geom


def build(level, tol, min_area=0.0):
    q = f"""[out:json][timeout:300];
area["name"="{PROVINCE}"]["admin_level"="4"]["boundary"="administrative"]->.a;
relation(area.a)["boundary"="administrative"]["admin_level"="{level}"];
out geom;"""
    data = overpass(q)
    feats = []
    for rel in data["elements"]:
        g = rel_to_geom(rel)
        if g is None or g.is_empty:
            continue
        g = g.simplify(tol, preserve_topology=True)
        if isinstance(g, MultiPolygon):
            parts = [p for p in g.geoms if p.area >= min_area] or [max(g.geoms, key=lambda p: p.area)]
            g = MultiPolygon(parts) if len(parts) > 1 else parts[0]
        c = g.representative_point()
        t = rel.get("tags", {})
        feats.append({
            "type": "Feature",
            "properties": {"id": rel["id"], "name": t.get("name", "?"),
                           "population": t.get("population"),
                           "label": [round(c.x, 5), round(c.y, 5)]},
            "geometry": json.loads(json.dumps(mapping(g), default=float)),
        })
    return feats


def rnd(o, n=5):
    if isinstance(o, (list, tuple)):
        return [rnd(x, n) for x in o]
    return round(o, n) if isinstance(o, float) else o


if __name__ == "__main__":
    out_dir = sys.argv[1]
    for name, level, tol in (("ilceler", 6, 0.0004), ("mahalleler", 8, 0.00015)):
        feats = build(level, tol)
        for f in feats:
            f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
        path = f"{out_dir}/{name}.geojson"
        json.dump({"type": "FeatureCollection", "features": feats}, open(path, "w", encoding="utf-8"),
                  ensure_ascii=False, separators=(",", ":"))
        print(name, len(feats), "birim ->", path, flush=True)
