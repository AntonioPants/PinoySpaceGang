"""NASA POWER daily point API (MERRA-2 / GEOS meteorology + CERES solar). No login required.

https://power.larc.nasa.gov/docs/services/api/temporal/daily/
"""
from __future__ import annotations

from datetime import date, timedelta

import httpx
import numpy as np
import pandas as pd

from .. import config
from .base import Source, SourceUnavailable, yesterday

PARAMETERS = [
    "T2M",  # mean air temperature at 2 m (deg C)
    "T2M_MAX",
    "T2M_MIN",
    "PRECTOTCORR",  # bias-corrected precipitation (mm/day)
    "GWETROOT",  # root-zone soil wetness (0-1, modelled)
    "GWETTOP",  # surface soil wetness (0-1, modelled)
    "ALLSKY_SFC_SW_DWN",  # incoming shortwave (MJ/m2/day in the AG community)
    "RH2M",  # relative humidity at 2 m (%)
    "WS2M",  # wind speed at 2 m (m/s)
    "TS",  # earth skin temperature (deg C) - used by the flash-drought fallback
]
BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"


class PowerSource(Source):
    name = "power"
    title = "NASA POWER daily meteorology"
    provider = "NASA Langley Research Center (POWER project; MERRA-2, GEOS-IT, CERES)"
    kind = "modelled"  # reanalysis + satellite-derived radiation, not a ground station
    resolution = "0.5 x 0.625 degrees (about 55 x 65 km), daily"
    url = BASE_URL
    max_age_hours = 24.0

    def __init__(self, cache=None, timeout: float = 120.0):
        super().__init__(cache)
        self.timeout = timeout

    def _request(self, lat: float, lon: float, start: date, end: date) -> tuple[pd.DataFrame, dict]:
        params = {
            "parameters": ",".join(PARAMETERS),
            "community": "AG",
            "latitude": f"{lat:.4f}",
            "longitude": f"{lon:.4f}",
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
            "format": "JSON",
        }
        try:
            resp = httpx.get(BASE_URL, params=params, timeout=self.timeout)
        except httpx.HTTPError as exc:
            raise SourceUnavailable(f"NASA POWER request failed: {type(exc).__name__}: {exc}") from exc
        if resp.status_code != 200:
            raise SourceUnavailable(f"NASA POWER returned HTTP {resp.status_code}: {resp.text[:200]}")
        return parse_power_json(resp.json())

    def _download(self, lat, lon, cached):
        end = yesterday()
        if cached is not None and len(cached[0]):
            # Incremental refresh: re-pull the last 60 days (near-real-time values get revised).
            old = cached[0]
            start = max(config.RECORD_START, old.index.max().date() - timedelta(days=60))
            new, extra = self._request(lat, lon, start, end)
            merged = pd.concat([old[old.index < pd.Timestamp(start)], new]).sort_index()
            merged = merged[~merged.index.duplicated(keep="last")]
            return merged, extra
        return self._request(lat, lon, config.RECORD_START, end)


def parse_power_json(payload: dict) -> tuple[pd.DataFrame, dict]:
    """Turn a POWER JSON response into a daily frame; the fill value becomes NaN."""
    try:
        block = payload["properties"]["parameter"]
    except (KeyError, TypeError) as exc:
        raise SourceUnavailable("NASA POWER response had an unexpected shape") from exc
    fill = float(payload.get("header", {}).get("fill_value", -999.0))
    df = pd.DataFrame({name: pd.Series(values, dtype="float64") for name, values in block.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df.index.name = "date"
    df = df.replace(fill, np.nan).sort_index()
    # Drop trailing days where nothing has been published yet.
    df = df.loc[: df.dropna(how="all").index.max()] if df.notna().any().any() else df.iloc[0:0]
    coords = payload.get("geometry", {}).get("coordinates", [None, None, None])
    extra = {
        "elevation_m": coords[2] if len(coords) > 2 else None,
        "units": {k: v.get("units") for k, v in payload.get("parameters", {}).items()},
        "api_version": payload.get("header", {}).get("api", {}).get("version"),
        "upstream_sources": payload.get("header", {}).get("sources"),
    }
    return df, extra
