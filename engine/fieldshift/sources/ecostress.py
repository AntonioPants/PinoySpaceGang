"""ECOSTRESS land-surface temperature and Evaporative Stress Index (70 m) via AppEEARS.

Optional: needs Earthdata credentials.  When unavailable the flash-drought module derives a
stress index from NASA POWER instead and labels it as modelled.
"""
from __future__ import annotations

from datetime import date

import pandas as pd

from .appeears import AppeearsClient, find_column
from .base import Source, SourceUnavailable, cache_key, yesterday

LAYERS = [
    {"product": "ECO_L2T_LSTE.002", "layer": "LST"},
    {"product": "ECO_L4T_ESI.002", "layer": "ESI"},
]
MISSION_START = date(2018, 7, 9)


class EcostressSource(Source):
    name = "ecostress"
    title = "ECOSTRESS land-surface temperature and Evaporative Stress Index"
    provider = "NASA LP DAAC via AppEEARS (instrument on the International Space Station)"
    kind = "observed"
    resolution = "70 m, irregular overpasses (every 1-5 days, varying time of day)"
    url = "https://appeears.earthdatacloud.nasa.gov/"
    needs_credentials = True
    max_age_hours = 24.0 * 3

    def credentials_configured(self) -> bool:
        return AppeearsClient.configured()

    def _download(self, lat, lon, cached):
        client = AppeearsClient()
        table = client.point_series(cache_key(self.name, lat, lon), lat, lon, LAYERS, MISSION_START, yesterday())
        return parse_ecostress_table(table, lon), {"products": [layer["product"] for layer in LAYERS]}


def parse_ecostress_table(table: pd.DataFrame, lon: float) -> pd.DataFrame:
    """Daily daytime LST (deg C) and ESI from the AppEEARS results table."""
    lst_col = find_column(table, "_LST")
    esi_col = find_column(table, "_ESI")
    if "Date" not in table.columns or (lst_col is None and esi_col is None):
        raise SourceUnavailable("ECOSTRESS results table had an unexpected shape")
    when = pd.to_datetime(table["Date"], utc=True, errors="coerce").dt.tz_localize(None)
    out = pd.DataFrame({"when": when})
    # local solar time decides whether an overpass is a daytime (canopy-heating) observation
    out["solar_hour"] = (when.dt.hour + when.dt.minute / 60.0 + lon / 15.0) % 24
    if lst_col is not None:
        kelvin = pd.to_numeric(table[lst_col], errors="coerce")
        out["lst_c"] = (kelvin.where(kelvin.between(230, 350)) - 273.15).values
    if esi_col is not None:
        esi = pd.to_numeric(table[esi_col], errors="coerce")
        out["esi"] = esi.where(esi.between(0, 1.5)).values
    for cloud_col in [c for c in table.columns if c.endswith("_cloud")]:
        cloudy = (pd.to_numeric(table[cloud_col], errors="coerce") == 1).values
        target = "lst_c" if "LSTE" in cloud_col else "esi"
        if target in out:
            out.loc[cloudy, target] = float("nan")
    out = out.dropna(subset=["when"])
    day = out[out["solar_hour"].between(9, 16)]
    cols = [c for c in ("lst_c", "esi") if c in day]
    daily = day.set_index("when")[cols].resample("1D").mean().dropna(how="all")
    daily.index.name = "date"
    return daily
