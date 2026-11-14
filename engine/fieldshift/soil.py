"""Soil profile: SoilGrids estimate + farmer overrides -> texture class and water-holding values.

Every field records where it came from ("modelled", "farmer-entered", "assumed", "unavailable")
so the UI can badge it.  The farmer's own soil-test values always win over the map.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

SOIL_FIELDS = [
    "ph",
    "soc_g_kg",
    "nitrogen_g_kg",
    "clay_pct",
    "sand_pct",
    "silt_pct",
    "bulk_density",
    "cec_cmol_kg",
]

# Plant-available water (field capacity - wilting point, m3/m3).  Mid-points of the ranges in
# FAO-56 Table 19; the three classes missing from that table are interpolated (TEAM estimate).
AVAILABLE_WATER = {
    "sand": 0.08,
    "loamy sand": 0.09,
    "sandy loam": 0.13,
    "loam": 0.155,
    "silt loam": 0.16,
    "silt": 0.18,
    "sandy clay loam": 0.13,  # interpolated
    "clay loam": 0.15,  # interpolated
    "silty clay loam": 0.155,
    "sandy clay": 0.12,  # interpolated
    "silty clay": 0.16,
    "clay": 0.16,
}

# Seepage + percolation loss from a ponded rice paddy (mm/day).  TEAM estimates within the
# 1-10 mm/day range commonly quoted for puddled soils: heavy soils hold water, light soils leak.
PADDY_PERCOLATION = {
    "sand": 10.0,
    "loamy sand": 8.0,
    "sandy loam": 6.0,
    "loam": 4.0,
    "silt loam": 3.5,
    "silt": 3.5,
    "sandy clay loam": 3.5,
    "clay loam": 2.5,
    "silty clay loam": 2.5,
    "sandy clay": 2.5,
    "silty clay": 2.0,
    "clay": 2.0,
}

DEFAULT_TEXTURE = "loam"
DEFAULT_BULK_DENSITY = 1.3


def texture_class(sand: float, silt: float, clay: float) -> str:
    """USDA soil texture triangle (percentages by weight)."""
    total = sand + silt + clay
    if total <= 0:
        raise ValueError("sand + silt + clay must be positive")
    sand, silt, clay = (100.0 * x / total for x in (sand, silt, clay))
    if silt + 1.5 * clay < 15:
        return "sand"
    if silt + 2 * clay < 30:
        return "loamy sand"
    if (7 <= clay < 20 and sand > 52) or (clay < 7 and silt < 50):
        return "sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "silt loam"
    if silt >= 80 and clay < 12:
        return "silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "sandy clay loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "silty clay loam"
    if clay >= 35 and sand > 45:
        return "sandy clay"
    if clay >= 40 and silt >= 40:
        return "silty clay"
    return "clay"


@dataclass
class SoilProfile:
    ph: float | None = None
    soc_g_kg: float | None = None
    nitrogen_g_kg: float | None = None
    clay_pct: float | None = None
    sand_pct: float | None = None
    silt_pct: float | None = None
    bulk_density: float | None = None
    cec_cmol_kg: float | None = None
    ec_ds_m: float | None = None  # salinity: not available from any map, farmer-entered only
    compaction_suspected: bool = False
    texture: str = DEFAULT_TEXTURE
    provenance: dict[str, str] = field(default_factory=dict)

    @property
    def awc(self) -> float:
        """Plant-available water capacity (m3 water per m3 soil)."""
        return AVAILABLE_WATER[self.texture]

    @property
    def paddy_percolation_mm_day(self) -> float:
        return PADDY_PERCOLATION[self.texture]

    @property
    def soc_stock_t_ha(self) -> float | None:
        """Organic carbon stock in the top 30 cm (t C/ha)."""
        if self.soc_g_kg is None:
            return None
        bd = self.bulk_density or DEFAULT_BULK_DENSITY
        return self.soc_g_kg / 1000.0 * bd * 0.30 * 10000.0

    def public(self) -> dict:
        values = {name: getattr(self, name) for name in SOIL_FIELDS}
        values.update(
            {
                "ec_ds_m": self.ec_ds_m,
                "compaction_suspected": self.compaction_suspected,
                "texture": self.texture,
                "available_water_mm_per_m": round(self.awc * 1000.0, 0),
                "soc_stock_t_ha": round(self.soc_stock_t_ha, 1) if self.soc_stock_t_ha is not None else None,
            }
        )
        return {"values": values, "provenance": dict(self.provenance)}


def build_profile(soilgrids: pd.DataFrame | None, overrides: dict | None = None) -> SoilProfile:
    """Merge the SoilGrids estimate (may be None) with the farmer's overrides."""
    overrides = {k: v for k, v in (overrides or {}).items() if v is not None and v != ""}
    profile = SoilProfile()
    prov: dict[str, str] = {}
    row = soilgrids.iloc[0].to_dict() if soilgrids is not None and len(soilgrids) else {}

    for name in SOIL_FIELDS:
        if name in overrides:
            setattr(profile, name, float(overrides[name]))
            prov[name] = "farmer-entered"
        elif name in row and pd.notna(row[name]):
            setattr(profile, name, float(row[name]))
            prov[name] = "modelled"
        else:
            prov[name] = "unavailable"

    if "ec_ds_m" in overrides:
        profile.ec_ds_m = float(overrides["ec_ds_m"])
        prov["ec_ds_m"] = "farmer-entered"
    else:
        prov["ec_ds_m"] = "unavailable"

    profile.compaction_suspected = bool(overrides.get("compaction_suspected", False))
    prov["compaction_suspected"] = "farmer-entered"

    texture_override = str(overrides.get("texture", "")).strip().lower()
    have_fractions = None not in (profile.sand_pct, profile.silt_pct, profile.clay_pct)
    fractions_entered = any(prov.get(k) == "farmer-entered" for k in ("sand_pct", "silt_pct", "clay_pct"))
    if texture_override in AVAILABLE_WATER and not fractions_entered:
        profile.texture = texture_override
        prov["texture"] = "farmer-entered"
    elif have_fractions:
        profile.texture = texture_class(profile.sand_pct, profile.silt_pct, profile.clay_pct)
        prov["texture"] = "farmer-entered" if fractions_entered else "modelled"
    else:
        # No map value and nothing entered: say so loudly instead of pretending to know.
        profile.texture = DEFAULT_TEXTURE
        prov["texture"] = "assumed"
    profile.provenance = prov
    return profile
