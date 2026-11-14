"""Pre-fetch a data snapshot so the demo runs fully offline.

Usage (from the engine/ folder):
    python -m scripts.fetch_snapshot                 # pilot farm
    python -m scripts.fetch_snapshot 14.6 121.0      # any other point
    python -m scripts.fetch_snapshot --skip-modis    # skip the slow MODIS download

Downloads NASA POWER, SoilGrids and MODIS NDVI for the point and writes them to
data/snapshot/ (committed to the repo).  SMAP / ECOSTRESS are included only when Earthdata
credentials are configured and the AppEEARS job has finished.
"""
from __future__ import annotations

import sys
import time

from fieldshift import config
from fieldshift.sources import DiskCache, SourceUnavailable, all_sources, cache_key


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    skip_modis = "--skip-modis" in argv
    lat = float(args[0]) if len(args) >= 2 else config.PILOT["lat"]
    lon = float(args[1]) if len(args) >= 2 else config.PILOT["lon"]
    cache = DiskCache()
    print(f"Snapshot for lat={lat}, lon={lon} -> {config.SNAPSHOT_DIR}")
    failures = 0
    for name, source in all_sources(cache).items():
        if skip_modis and name == "modis_ndvi":
            print(f"  {name:11s} skipped")
            continue
        started = time.time()
        try:
            df = source.fetch(lat, lon)
        except SourceUnavailable as exc:
            print(f"  {name:11s} UNAVAILABLE: {exc}")
            failures += 0 if source.needs_credentials else 1
            continue
        meta = dict(df.attrs["meta"])
        meta.pop("origin", None)
        meta.pop("stale", None)
        cache.write(cache_key(name, lat, lon), df, meta, snapshot=True)
        print(
            f"  {name:11s} ok  {len(df):6d} rows  {meta.get('date_start')} .. {meta.get('date_end')}"
            f"  ({time.time() - started:.0f}s)"
        )
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
