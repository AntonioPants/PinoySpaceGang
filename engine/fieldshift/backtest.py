"""Honest backtest: does the engine's water-stress estimate agree with observed greenness?

For each season and each year since 2001 the engine's *water satisfaction* for a generic
rain-fed reference crop (how much of crop water demand rain + stored soil water met) is
compared with the MODIS NDVI anomaly of the same season (mean NDVI from sowing to 110 days
after, minus that season's long-term mean).

If the water balance captures real moisture stress, drier-than-usual model seasons should
line up with browner-than-usual satellite seasons (a positive correlation).  The result is
reported exactly as it comes out - sample size, correlation, p-value and caveats - whether
or not it flatters the engine.

The module also gives a cropping-intensity hint (green-up cycles per year) from the NDVI
curve.  It does NOT claim to know which crop was grown.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import signal, stats

from .climate import SeasonPlan, Weather, season_matrix
from .crops import Crop
from .i18n import t
from .soil import SoilProfile
from .waterbalance import SimSettings, simulate

REFERENCE_DAYS = 110
MIN_COMPOSITES = 4
MIN_YEARS = 8

REFERENCE_CROP = Crop(
    id="reference",
    name={"en": "Generic rain-fed field crop"},
    family="Reference",
    seasons=("wet", "dry"),
    duration_days=REFERENCE_DAYS,
    t_base_c=10.0,
    gdd_need=1.0,
    t_mean_range_c=(0.0, 50.0),
    heat_limit_c=60.0,
    frost_sensitive=False,
    water_need_mm=(0.0, 0.0),
    kc=(0.4, 1.0, 0.6),
    stages=(0.2, 0.3, 0.3, 0.2),
    root_depth_m=0.8,
    depletion_p=0.5,
    ky=1.0,
    paddy=False,
    salinity_threshold_ds_m=99.0,
    ph_range=(0.0, 14.0),
    heat_tolerance=3,
    drought_tolerance=3,
    waterlogging_tolerance=5,
    n_fixing=False,
    n_credit_kg_ha=0.0,
    n_demand_kg_ha=0.0,
    residue_cover=3,
    residue_c_t_ha=0.0,
    deep_taproot=False,
    rest_years=0,
    income_band=0,
)


def _strength(r: float, p: float) -> str:
    if p >= 0.05:
        return "none"
    a = abs(r)
    return "strong" if a >= 0.6 else "moderate" if a >= 0.4 else "weak"


def season_ndvi(ndvi: pd.Series, sow_dates: list, days: int = REFERENCE_DAYS) -> np.ndarray:
    """Mean NDVI between each sowing date and ``days`` later; NaN when too few composites."""
    out = np.full(len(sow_dates), np.nan)
    for i, sow in enumerate(sow_dates):
        start = pd.Timestamp(sow)
        window = ndvi[(ndvi.index >= start) & (ndvi.index < start + pd.Timedelta(days=days))].dropna()
        if len(window) >= MIN_COMPOSITES:
            out[i] = float(window.mean())
    return out


def cropping_intensity(ndvi: pd.Series, lang: str = "en") -> dict:
    """Green-up cycles per year from the smoothed NDVI curve (a hint, not a crop map)."""
    clean = ndvi.dropna()
    if len(clean) < 46:
        return {"available": False}
    smooth = clean.rolling(3, center=True, min_periods=1).mean()
    peaks, _ = signal.find_peaks(smooth.to_numpy(), prominence=0.10, distance=4)
    years = smooth.index[peaks].year
    full_years = [y for y, n in clean.groupby(clean.index.year).size().items() if n >= 20]
    counts = [int((years == y).sum()) for y in full_years]
    if not counts:
        return {"available": False}
    median = float(np.median(counts))
    return {
        "available": True,
        "median_cycles_per_year": median,
        "share_of_years_with_two_or_more": round(float(np.mean(np.array(counts) >= 2)), 2),
        "years": len(counts),
        "per_year": [{"year": int(y), "cycles": c} for y, c in zip(full_years, counts)],
        "text": t(lang, "backtest.intensity", cycles=f"{median:g}", share=round(100 * float(np.mean(np.array(counts) >= 2))), years=len(counts)),
    }


def run_backtest(weather: Weather, plan: SeasonPlan, soil: SoilProfile, modis: pd.DataFrame | None, lang: str = "en") -> dict:
    caveats = [t(lang, f"backtest.caveat.{i}") for i in range(1, 6)]
    if modis is None or "ndvi" not in modis or modis["ndvi"].notna().sum() < 46:
        return {
            "available": False,
            "reason": t(lang, "backtest.unavailable"),
            "caveats": caveats,
            "seasons": {},
            "cropping_intensity": {"available": False},
        }
    ndvi = modis["ndvi"].dropna()
    settings = SimSettings(water_source="rainfed", drainage="good")
    seasons = {}
    for season in plan.SEASONS:
        sw = season_matrix(weather, plan, season)
        result = simulate(REFERENCE_CROP, sw, soil, settings)
        greenness = season_ndvi(ndvi, sw.sow_dates)
        ok = sw.valid & ~np.isnan(greenness)
        n = int(ok.sum())
        entry = {"kind": plan.kind(season), "n_years": n}
        if n < MIN_YEARS:
            entry.update({"available": False, "reason": t(lang, "backtest.too_few", n=n, need=MIN_YEARS)})
            seasons[season] = entry
            continue
        satisfaction = result.water_satisfaction[ok]
        anomaly = greenness[ok] - greenness[ok].mean()
        rain = result.rain_mm[ok]
        if np.allclose(satisfaction, satisfaction[0]):
            entry.update({"available": False, "reason": t(lang, "backtest.no_variation", season=t(lang, f"season.{plan.kind(season)}"))})
            seasons[season] = entry
            continue
        pearson = stats.pearsonr(satisfaction, anomaly)
        spearman = stats.spearmanr(satisfaction, anomaly)
        rain_r = stats.pearsonr(rain, anomaly)
        r, p = float(pearson.statistic), float(pearson.pvalue)
        strength = _strength(r, p)
        entry.update(
            {
                "available": True,
                "pearson_r": round(r, 2),
                "pearson_p": round(p, 3),
                "spearman_rho": round(float(spearman.statistic), 2),
                "spearman_p": round(float(spearman.pvalue), 3),
                "rain_vs_ndvi_r": round(float(rain_r.statistic), 2),
                "strength": strength,
                "direction_as_expected": bool(r > 0),
                "points": [
                    {
                        "year": int(y),
                        "water_satisfaction": round(float(s), 3),
                        "ndvi": round(float(g), 3),
                        "ndvi_anomaly": round(float(a), 3),
                    }
                    for y, s, g, a in zip(sw.years[ok], satisfaction, greenness[ok], anomaly)
                ],
                "text": t(
                    lang,
                    f"backtest.result.{strength}" if r > 0 or strength == "none" else "backtest.result.wrong_sign",
                    season=t(lang, f"season.{plan.kind(season)}"),
                    r=round(r, 2),
                    p=round(p, 3),
                    n=n,
                ),
            }
        )
        seasons[season] = entry
    meta = dict(modis.attrs.get("meta", {}))
    return {
        "available": True,
        "method": t(lang, "backtest.method", days=REFERENCE_DAYS),
        "seasons": seasons,
        "caveats": caveats,
        "cropping_intensity": cropping_intensity(ndvi, lang),
        "ndvi_record": {"start": ndvi.index[0].date().isoformat(), "end": ndvi.index[-1].date().isoformat(), "composites": int(len(ndvi))},
        "source": meta,
    }
