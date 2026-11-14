"""Crop knowledge base loader (crops.yaml -> typed Crop objects)."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

CROPS_FILE = Path(__file__).with_name("crops.yaml")
FALLOW = "fallow"


@dataclass(frozen=True)
class Crop:
    id: str
    name: dict
    family: str
    seasons: tuple[str, ...]
    duration_days: int
    t_base_c: float
    gdd_need: float
    t_mean_range_c: tuple[float, float]
    heat_limit_c: float
    frost_sensitive: bool
    water_need_mm: tuple[float, float]
    kc: tuple[float, float, float]
    stages: tuple[float, float, float, float]
    root_depth_m: float
    depletion_p: float
    ky: float
    paddy: bool
    salinity_threshold_ds_m: float
    ph_range: tuple[float, float]
    heat_tolerance: int
    drought_tolerance: int
    waterlogging_tolerance: int
    n_fixing: bool
    n_credit_kg_ha: float
    n_demand_kg_ha: float
    residue_cover: int
    residue_c_t_ha: float
    deep_taproot: bool
    rest_years: int
    income_band: int
    sources: dict = field(default_factory=dict, compare=False, hash=False)
    verify: tuple[str, ...] = ()

    def label(self, lang: str = "en") -> str:
        return self.name.get(lang) or self.name.get("en") or self.id

    def public(self) -> dict:
        """JSON-friendly view used by the API (/api/crops and the data page)."""
        return {
            "id": self.id,
            "name": self.name,
            "family": self.family,
            "seasons": list(self.seasons),
            "duration_days": self.duration_days,
            "t_base_c": self.t_base_c,
            "gdd_need": self.gdd_need,
            "t_mean_range_c": list(self.t_mean_range_c),
            "heat_limit_c": self.heat_limit_c,
            "water_need_mm": list(self.water_need_mm),
            "kc": list(self.kc),
            "root_depth_m": self.root_depth_m,
            "depletion_p": self.depletion_p,
            "ky": self.ky,
            "paddy": self.paddy,
            "salinity_threshold_ds_m": self.salinity_threshold_ds_m,
            "ph_range": list(self.ph_range),
            "heat_tolerance": self.heat_tolerance,
            "drought_tolerance": self.drought_tolerance,
            "waterlogging_tolerance": self.waterlogging_tolerance,
            "n_fixing": self.n_fixing,
            "n_credit_kg_ha": self.n_credit_kg_ha,
            "n_demand_kg_ha": self.n_demand_kg_ha,
            "residue_cover": self.residue_cover,
            "residue_c_t_ha": self.residue_c_t_ha,
            "deep_taproot": self.deep_taproot,
            "rest_years": self.rest_years,
            "income_band": self.income_band,
            "sources": self.sources,
            "verify": list(self.verify),
        }


def _build(raw: dict) -> Crop:
    stages = tuple(float(x) for x in raw["stages"])
    if abs(sum(stages) - 1.0) > 0.02:
        raise ValueError(f"crop {raw['id']}: stage fractions must sum to 1 (got {sum(stages):.2f})")
    return Crop(
        id=raw["id"],
        name=dict(raw["name"]),
        family=raw["family"],
        seasons=tuple(raw["seasons"]),
        duration_days=int(raw["duration_days"]),
        t_base_c=float(raw["t_base_c"]),
        gdd_need=float(raw["gdd_need"]),
        t_mean_range_c=tuple(float(x) for x in raw["t_mean_range_c"]),
        heat_limit_c=float(raw["heat_limit_c"]),
        frost_sensitive=bool(raw["frost_sensitive"]),
        water_need_mm=tuple(float(x) for x in raw["water_need_mm"]),
        kc=tuple(float(x) for x in raw["kc"]),
        stages=stages,
        root_depth_m=float(raw["root_depth_m"]),
        depletion_p=float(raw["depletion_p"]),
        ky=float(raw["ky"]),
        paddy=bool(raw.get("paddy", False)),
        salinity_threshold_ds_m=float(raw["salinity_threshold_ds_m"]),
        ph_range=tuple(float(x) for x in raw["ph_range"]),
        heat_tolerance=int(raw["heat_tolerance"]),
        drought_tolerance=int(raw["drought_tolerance"]),
        waterlogging_tolerance=int(raw["waterlogging_tolerance"]),
        n_fixing=bool(raw["n_fixing"]),
        n_credit_kg_ha=float(raw["n_credit_kg_ha"]),
        n_demand_kg_ha=float(raw["n_demand_kg_ha"]),
        residue_cover=int(raw["residue_cover"]),
        residue_c_t_ha=float(raw["residue_c_t_ha"]),
        deep_taproot=bool(raw["deep_taproot"]),
        rest_years=int(raw["rest_years"]),
        income_band=int(raw["income_band"]),
        sources=dict(raw.get("sources", {})),
        verify=tuple(raw.get("verify", [])),
    )


@lru_cache(maxsize=4)
def _load(path: str) -> tuple[dict, dict, dict]:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    crops = {c["id"]: _build(c) for c in raw["crops"]}
    return crops, raw.get("references", {}), raw.get("meta", {})


def load_crops(path: Path | str | None = None) -> dict[str, Crop]:
    return dict(_load(str(path or CROPS_FILE))[0])


def references(path: Path | str | None = None) -> dict:
    return dict(_load(str(path or CROPS_FILE))[1])


def kb_meta(path: Path | str | None = None) -> dict:
    return dict(_load(str(path or CROPS_FILE))[2])
