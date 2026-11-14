"""SMAP Level-4 root-zone soil moisture (SPL4SMGP, 9 km) via AppEEARS.

Optional: needs Earthdata credentials.  When unavailable the engine falls back to NASA POWER
GWETROOT and labels it "modelled" (see ``sources.registry.root_zone_wetness``).
"""
from __future__ import annotations

from datetime import date

import pandas as pd

from .appeears import AppeearsClient, find_column
from .base import Source, SourceUnavailable, cache_key, yesterday

PRODUCT = "SPL4SMGP.008"
LAYERS = ["Geophysical_Data_sm_rootzone_wetness", "Geophysical_Data_sm_rootzone"]
MISSION_START = date(2015, 3, 31)


class SmapSource(Source):
    name = "smap_l4"
    title = "SMAP L4 root-zone soil moisture (SPL4SMGP v8)"
    provider = "NASA NSIDC DAAC via AppEEARS"
    # L4 = SMAP L-band observations assimilated into a land-surface model
    kind = "observed"
    resolution = "9 km grid, aggregated to daily means"
    url = "https://appeears.earthdatacloud.nasa.gov/"
    needs_credentials = True
    max_age_hours = 24.0 * 7

    def credentials_configured(self) -> bool:
        return AppeearsClient.configured()

    def _download(self, lat, lon, cached):
        client = AppeearsClient()
        layers = [{"product": PRODUCT, "layer": layer} for layer in LAYERS]
        table = client.point_series(cache_key(self.name, lat, lon), lat, lon, layers, MISSION_START, yesterday())
        return parse_smap_table(table), {"product": PRODUCT}


def parse_smap_table(table: pd.DataFrame) -> pd.DataFrame:
    wet_col = find_column(table, "sm_rootzone_wetness")
    vol_col = find_column(table, "sm_rootzone")
    if "Date" not in table.columns or wet_col is None:
        raise SourceUnavailable("SMAP results table had an unexpected shape")
    out = pd.DataFrame({"date": pd.to_datetime(table["Date"], utc=True, errors="coerce").dt.tz_localize(None)})
    out["smap_rootzone_wetness"] = pd.to_numeric(table[wet_col], errors="coerce").values
    if vol_col is not None:
        out["smap_rootzone_m3m3"] = pd.to_numeric(table[vol_col], errors="coerce").values
    out = out.dropna(subset=["date"])
    out = out[out["smap_rootzone_wetness"].between(0, 1)]  # drops fill values (-9999)
    daily = out.set_index("date").resample("1D").mean().dropna(how="all")
    daily.index.name = "date"
    return daily
