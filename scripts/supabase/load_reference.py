"""Load the click-anywhere reference data into the Supabase project.

Additive tooling for the `match-analog` edge function (see supabase/README.md). It uploads:

  assets              earth-vectors.json, the Mars tile table and unit-families.json, into `analog_assets`
  geology Moon|Mars   geologic-unit polygons, into `geology_units`
  gazetteer Moon|Mars IAU nomenclature centre points, into `gazetteer`

Everything goes through the temporary, token-guarded RPC `quest_upload`, which must exist in
the project while this runs. The project URL and the public anon key are read from web/.env;
the upload token is read from the environment variable QUEST_UPLOAD_TOKEN and is never stored.

Sources (downloaded by hand into data/raw/geology/, which is git-ignored):
  Mars  USGS SIM 3292 global geologic map, 1:20M: sim3292_database.zip
        (SIM3292_Shapefiles/SIM3292_Global_Geology.shp; fields Unit, UnitDesc; lon/lat degrees)
  Moon  USGS Unified Geologic Map of the Moon, 1:5M (2020): moon_gis.zip
        (Lunar_GIS/Shapefiles/GeoUnits.shp; fields FIRST_Unit, FIRST_Un_1, FIRST_Un_2;
        equirectangular metres on the 1,737,400 m sphere)
  IAU gazetteer centre points: MOON_/MARS_nomenclature_center_pts.zip

Usage (repo root):
  QUEST_UPLOAD_TOKEN=... .venv/Scripts/python -m scripts.supabase.load_reference assets
  QUEST_UPLOAD_TOKEN=... .venv/Scripts/python -m scripts.supabase.load_reference geology Mars
  QUEST_UPLOAD_TOKEN=... .venv/Scripts/python -m scripts.supabase.load_reference gazetteer Moon
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "geology"
SHARED = ROOT / "supabase" / "functions" / "_shared" / "analog"
MOON_RADIUS_M = 1_737_400.0
SIMPLIFY_DEG = 0.02
BATCH_BYTES = 150_000  # well under the 1 MB request guidance, and quick enough for the anon statement timeout

GEOLOGY = {
    "Mars": {"zip": "sim3292_database.zip", "member": "SIM3292_Shapefiles/SIM3292_Global_Geology", "unit": "Unit",
             "name": lambda row: row["UnitDesc"]},
    "Moon": {"zip": "moon_gis.zip", "member": "Lunar_GIS/Shapefiles/GeoUnits", "unit": "FIRST_Unit",
             "name": lambda row: f'{row["FIRST_Un_1"]} {row["FIRST_Un_2"]}'.strip()},
}
GAZETTEER = {"Moon": "moon_names.zip", "Mars": "mars_names.zip"}


def normalise_lon(lon: float) -> float:
    """East-positive longitude in [-180, 180)."""
    return (lon + 180.0) % 360.0 - 180.0


def wrap_geometry(geometry):
    """Bring a lon/lat geometry drawn anywhere in -180..540 into -180..180.

    Parts east of 180 are cut off and moved 360 degrees west, so a polygon that crosses the
    seam becomes two pieces that meet it from either side and point-in-polygon works everywhere.
    """
    from shapely import affinity
    from shapely.geometry import box
    from shapely.ops import unary_union

    west, _, east, _ = geometry.bounds
    if west >= -180.0 and east <= 180.0:
        return geometry
    pieces = []
    for shift in (-360.0, 0.0, 360.0):
        part = geometry.intersection(box(-180.0 - shift, -90.0, 180.0 - shift, 90.0))
        if not part.is_empty:
            pieces.append(affinity.translate(part, xoff=shift))
    return unary_union(pieces)


def metres_to_degrees(geometry, radius_m: float):
    """Equirectangular metres on a sphere (x = R lon, y = R lat) to lon/lat degrees."""
    from shapely import affinity

    scale = math.degrees(1.0 / radius_m)
    return affinity.scale(geometry, xfact=scale, yfact=scale, origin=(0, 0))


def read_env() -> tuple[str, str]:
    values = {}
    for line in (ROOT / "web" / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values["VITE_SUPABASE_URL"].rstrip("/"), values["VITE_SUPABASE_ANON_KEY"]


def post(kind: str, rows) -> int:
    token = os.environ.get("QUEST_UPLOAD_TOKEN")
    if not token:
        sys.exit("Set QUEST_UPLOAD_TOKEN (the temporary loader token; it is not stored in the repo).")
    url, key = read_env()
    body = json.dumps({"p_token": token, "p_kind": kind, "p_rows": rows}).encode("utf-8")
    request = urllib.request.Request(f"{url}/rest/v1/rpc/quest_upload", data=body, method="POST", headers={
        "Content-Type": "application/json", "apikey": key, "Authorization": f"Bearer {key}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return int(json.loads(response.read() or b"0"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:300]
            if error.code < 500 and error.code != 408 and "timeout" not in detail:
                sys.exit(f"Upload refused ({error.code}): {detail}")
            last = f"{error.code} {detail}"
        except (urllib.error.URLError, TimeoutError) as error:
            last = str(error)
        time.sleep(2 ** attempt)
    sys.exit(f"Upload failed after retries: {last}")


def upload_batches(kind: str, rows: list[dict]) -> int:
    sent, batch, size = 0, [], 0
    for row in rows:
        length = len(json.dumps(row))
        if batch and size + length > BATCH_BYTES:
            sent += post(kind, batch)
            batch, size = [], 0
        batch.append(row)
        size += length
    if batch:
        sent += post(kind, batch)
    return sent


def extract(archive: str, member: str) -> Path:
    """Unpack one shapefile (all its sidecar files) and return the .shp path."""
    target = RAW / "extracted"
    with zipfile.ZipFile(RAW / archive) as bundle:
        names = [n for n in bundle.namelist() if member in n and not n.endswith("/")]
        if not names:
            sys.exit(f"{member} not found in {archive}")
        for name in names:
            if not (target / name).exists():
                bundle.extract(name, target)
    return next(target / n for n in names if n.endswith(".shp"))


def mars_tiles() -> dict:
    text = (SHARED / "marsTiles.ts").read_text(encoding="utf-8")
    arrays = {}
    for key, label in (("offsets", "MARS_TILE_OFFSETS"), ("counts", "MARS_TILE_COUNTS")):
        match = re.search(label + r"[^=]*=\s*\[([^\]]*)\]", text)
        arrays[key] = [int(v) for v in match.group(1).split(",") if v.strip()]
    if len(arrays["offsets"]) != 4050 or len(arrays["counts"]) != 4050:
        sys.exit("The Mars tile table does not have 90 x 45 entries.")
    return arrays


def load_assets() -> None:
    vectors = json.loads((SHARED / "earth-vectors.json").read_text(encoding="utf-8"))
    print("earth-vectors:", post("asset", [{"name": "earth-vectors", "content": vectors}]), "row,", len(vectors["sites"]), "sites")
    print("mars-tiles:", post("asset", [{"name": "mars-tiles", "content": mars_tiles()}]), "row")
    families = json.loads((ROOT / "supabase/functions/_shared/analog/unit-families.json").read_text(encoding="utf-8"))
    print("unit-families:", post("asset", [{"name": "unit-families", "content": families}]), "row")


def load_geology(body: str) -> None:
    import geopandas as gpd
    import shapely

    spec = GEOLOGY[body]
    frame = gpd.read_file(extract(spec["zip"], spec["member"]))
    rows = []
    for _, row in frame.iterrows():
        geometry = row.geometry
        if geometry is None or geometry.is_empty:
            continue
        if body == "Moon":
            geometry = metres_to_degrees(geometry, MOON_RADIUS_M)
        geometry = wrap_geometry(shapely.make_valid(geometry))
        geometry = geometry.simplify(SIMPLIFY_DEG, preserve_topology=True)
        geometry = shapely.set_precision(geometry, 0.0001)
        if geometry.is_empty:
            continue
        rows.append({"body": body, "unit": str(row[spec["unit"]]).strip(), "unit_name": spec["name"](row),
                     "geometry": shapely.to_geojson(geometry)})
    print(body, "geology:", len(rows), "polygons,", sum(len(r["geometry"]) for r in rows) // 1024, "KB of GeoJSON,",
          len({r["unit"] for r in rows}), "units")
    post("clear_geology", {"body": body})
    print("loaded", upload_batches("geology", rows))


def load_gazetteer(body: str) -> None:
    import geopandas as gpd

    frame = gpd.read_file(extract(GAZETTEER[body], f"{body.upper()}_nomenclature_center_pts"))
    if "approval" in frame.columns:
        frame = frame[frame["approval"] == "Adopted by IAU"]
    rows = [{"body": body, "name": row["name"], "feature_type": str(row["type"]).split(",")[0].strip(),
             "lat": float(row["center_lat"]), "lon": round(normalise_lon(float(row["center_lon"])), 4),
             "diameter_km": float(row["diameter"] or 0)} for _, row in frame.iterrows()]
    post("clear_gazetteer", {"body": body})
    print(body, "gazetteer: loaded", upload_batches("gazetteer", rows), "of", len(rows))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("assets")
    for name in ("geology", "gazetteer"):
        commands.add_parser(name).add_argument("body", choices=["Moon", "Mars"])
    args = parser.parse_args()
    if args.command == "assets":
        load_assets()
    elif args.command == "geology":
        load_geology(args.body)
    else:
        load_gazetteer(args.body)


if __name__ == "__main__":
    main()
