"""ISRIC SoilGrids v2.0 point query: machine-learning soil property maps at 250 m.

https://rest.isric.org/soilgrids/v2.0/docs  -  values are *modelled* estimates; the farmer
can override every one of them with a soil-test result.
"""
from __future__ import annotations

import httpx
import pandas as pd

from .base import Source, SourceUnavailable

BASE_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPERTIES = ["phh2o", "soc", "nitrogen", "clay", "sand", "silt", "bdod", "cec"]
DEPTHS = ["0-5cm", "5-15cm", "15-30cm"]
# layer thickness (cm) used for the 0-30 cm depth-weighted mean
THICKNESS = {"0-5cm": 5.0, "5-15cm": 10.0, "15-30cm": 15.0}
# our column name + unit after dividing the mapped integer by SoilGrids' d_factor
COLUMNS = {
    "phh2o": ("ph", "pH (water)"),
    "soc": ("soc_g_kg", "g/kg"),
    "nitrogen": ("nitrogen_g_kg", "g/kg"),
    "clay": ("clay_pct", "%"),
    "sand": ("sand_pct", "%"),
    "silt": ("silt_pct", "%"),
    "bdod": ("bulk_density", "kg/dm3"),
    "cec": ("cec_cmol_kg", "cmol(c)/kg"),
}


class SoilGridsSource(Source):
    name = "soilgrids"
    title = "ISRIC SoilGrids 2.0"
    provider = "ISRIC - World Soil Information"
    kind = "modelled"
    resolution = "250 m grid, 0-30 cm depth-weighted mean"
    url = BASE_URL
    max_age_hours = 24.0 * 365 * 5  # static maps: never refresh a cached point

    def __init__(self, cache=None, timeout: float = 60.0):
        super().__init__(cache)
        self.timeout = timeout

    def _download(self, lat, lon, cached):
        params = [("lon", f"{lon:.5f}"), ("lat", f"{lat:.5f}"), ("value", "mean")]
        params += [("property", p) for p in PROPERTIES] + [("depth", d) for d in DEPTHS]
        try:
            resp = httpx.get(BASE_URL, params=params, timeout=self.timeout)
        except httpx.HTTPError as exc:
            raise SourceUnavailable(f"SoilGrids request failed: {type(exc).__name__}: {exc}") from exc
        if resp.status_code != 200:
            raise SourceUnavailable(f"SoilGrids returned HTTP {resp.status_code}")
        return parse_soilgrids_json(resp.json())


def parse_soilgrids_json(payload: dict) -> tuple[pd.DataFrame, dict]:
    """Return a one-row frame (index = a nominal date) with 0-30 cm weighted means."""
    try:
        layers = payload["properties"]["layers"]
    except (KeyError, TypeError) as exc:
        raise SourceUnavailable("SoilGrids response had an unexpected shape") from exc
    row: dict[str, float] = {}
    for layer in layers:
        if layer.get("name") not in COLUMNS:
            continue
        column, _unit = COLUMNS[layer["name"]]
        d_factor = float(layer.get("unit_measure", {}).get("d_factor", 1) or 1)
        total, weight = 0.0, 0.0
        for depth in layer.get("depths", []):
            value = (depth.get("values") or {}).get("mean")
            thickness = THICKNESS.get(depth.get("label"))
            if value is None or thickness is None:
                continue
            total += float(value) / d_factor * thickness
            weight += thickness
        if weight > 0:
            row[column] = round(total / weight, 3)
    if not {"clay_pct", "sand_pct", "silt_pct"} <= row.keys():
        # Typical for water bodies, cities or glaciers: SoilGrids has no prediction there.
        raise SourceUnavailable("SoilGrids has no soil prediction at this point (water, urban or no data)")
    df = pd.DataFrame([row], index=pd.DatetimeIndex([pd.Timestamp("2020-01-01")], name="date"))
    return df, {"units": {c: u for c, u in COLUMNS.values()}, "depth": "0-30 cm"}
