"""MODIS/Terra vegetation index (MOD13Q1, 250 m, 16-day) through the ORNL DAAC subset API.

https://modis.ornl.gov/data/modis_webservice.html  -  no login required.

Used for (a) an honest backtest of the engine's water-stress estimate against observed
greenness and (b) a cropping-intensity hint (how many green-up cycles per year).

The service is slow (tens of seconds per request, 10 composites per request), so the full
record is downloaded once in parallel chunks and cached.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

import httpx
import numpy as np
import pandas as pd

from .base import Source, SourceUnavailable, cache_key

BASE_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
BAND = "250m_16_days_NDVI"
CHUNK = 10  # ORNL limit: at most 10 composites per request for MOD13Q1
FIRST_YEAR = 2001  # first complete calendar year of Terra MODIS
HEADERS = {"Accept": "application/json"}

# download progress per cache key: {"done": chunks, "total": chunks}
PROGRESS: dict[str, dict] = {}


class ModisNdviSource(Source):
    name = "modis_ndvi"
    title = "MODIS Terra NDVI (MOD13Q1 v6.1)"
    provider = "NASA LP DAAC, served by the ORNL DAAC MODIS subset API"
    kind = "observed"
    resolution = "250 m pixels, 16-day composites; median of a ~2 km box around the pin"
    url = BASE_URL
    max_age_hours = 24.0 * 45

    def __init__(self, cache=None, timeout: float = 180.0, workers: int = 5, window_km: int = 1):
        super().__init__(cache)
        self.timeout = timeout
        self.workers = workers
        self.window_km = window_km

    # -- HTTP helpers -----------------------------------------------------------------------
    def _get(self, path: str, params: dict, retries: int = 2) -> dict:
        last: Exception | None = None
        for attempt in range(retries + 1):
            try:
                resp = httpx.get(f"{BASE_URL}/{path}", params=params, headers=HEADERS, timeout=self.timeout)
                if resp.status_code == 200:
                    return resp.json()
                last = SourceUnavailable(f"ORNL DAAC returned HTTP {resp.status_code}")
            except (httpx.HTTPError, ValueError) as exc:
                last = exc
            time.sleep(2.0 * (attempt + 1))
        raise SourceUnavailable(f"MODIS subset request failed: {type(last).__name__}: {last}")

    def _dates(self, lat: float, lon: float) -> list[tuple[str, str]]:
        payload = self._get("dates", {"latitude": lat, "longitude": lon})
        return [(d["modis_date"], d["calendar_date"]) for d in payload.get("dates", [])]

    def _chunk(self, lat: float, lon: float, start: str, end: str) -> list[dict]:
        payload = self._get(
            "subset",
            {
                "latitude": lat,
                "longitude": lon,
                "band": BAND,
                "startDate": start,
                "endDate": end,
                "kmAboveBelow": self.window_km,
                "kmLeftRight": self.window_km,
            },
        )
        return parse_subset(payload)

    # -- Source implementation --------------------------------------------------------------
    def _download(self, lat, lon, cached):
        key = cache_key(self.name, lat, lon)
        all_dates = [(m, c) for m, c in self._dates(lat, lon) if int(c[:4]) >= FIRST_YEAR]
        if not all_dates:
            raise SourceUnavailable("ORNL DAAC lists no MOD13Q1 composites for this location")
        have: set[str] = set()
        old = None
        if cached is not None and len(cached[0]):
            old = cached[0]
            have = {d.date().isoformat() for d in old.index}
        todo = [(m, c) for m, c in all_dates if c not in have]
        chunks = [todo[i : i + CHUNK] for i in range(0, len(todo), CHUNK)]
        PROGRESS[key] = {"done": 0, "total": len(chunks)}
        rows: list[dict] = []
        failed = 0
        if chunks:
            with ThreadPoolExecutor(max_workers=self.workers) as pool:
                futures = {pool.submit(self._chunk, lat, lon, ch[0][0], ch[-1][0]): ch for ch in chunks}
                for fut in as_completed(futures):
                    try:
                        rows.extend(fut.result())
                    except SourceUnavailable:
                        failed += 1
                    PROGRESS[key]["done"] += 1
        if chunks and failed > 0.25 * len(chunks):
            raise SourceUnavailable(
                f"MODIS download incomplete: {failed} of {len(chunks)} requests to ORNL DAAC failed"
            )
        new = pd.DataFrame(rows)
        if len(new):
            new["date"] = pd.to_datetime(new["date"])
            new = new.set_index("date").sort_index()
        frames = [f for f in (old, new if len(new) else None) if f is not None]
        if not frames:
            raise SourceUnavailable("MODIS download returned no composites")
        df = pd.concat(frames).sort_index()
        df = df[~df.index.duplicated(keep="last")]
        extra = {
            "band": BAND,
            "window": f"{2 * self.window_km + 0.25:.2f} km box",
            "failed_requests": failed,
            "notes": "16-day maximum-value composites; fill values removed; no per-pixel QA band applied",
        }
        return df, extra


def parse_subset(payload: dict) -> list[dict]:
    """Convert an ORNL subset response into per-composite NDVI statistics."""
    scale = float(payload.get("scale") or 0.0001)
    out: list[dict] = []
    for item in payload.get("subset", []):
        raw = np.asarray(item.get("data", []), dtype="float64")
        if raw.size == 0:
            continue
        valid = raw[(raw >= -2000) & (raw <= 10000)]  # -3000 is the fill value
        centre = raw[raw.size // 2]
        out.append(
            {
                "date": item["calendar_date"],
                "ndvi": round(float(np.median(valid)) * scale, 4) if valid.size else np.nan,
                "ndvi_centre": round(float(centre) * scale, 4) if -2000 <= centre <= 10000 else np.nan,
                "valid_frac": round(valid.size / raw.size, 3),
            }
        )
    return out


def progress(lat: float, lon: float) -> dict | None:
    return PROGRESS.get(cache_key(ModisNdviSource.name, lat, lon))


def first_year_start() -> date:
    return date(FIRST_YEAR, 1, 1)
