"""Per-season climate indicators and their trends over the record.

Indicators (per season, per year): rainfall total, ET0 total, water balance (rain - ET0),
growing-degree days, longest dry spell, heat days (Tmax > 35 C), frost days, mean temperature.
Trends use the Theil-Sen slope (robust to outliers) with a Kendall-tau significance test.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from scipy import stats

from .weather import MONTH_NAMES, SeasonPlan, Weather, monthly_climatology, window_matrix

HEAT_THRESHOLD_C = 35.0
DRY_DAY_MM = 1.0
GDD_BASE_C = 10.0
GDD_CAP_C = 30.0
SEASON_WINDOW_DAYS = 181
INDICATORS = [
    "rain_mm",
    "et0_mm",
    "water_balance_mm",
    "gdd",
    "dry_spell_days",
    "heat_days",
    "frost_days",
    "tmean_c",
    "root_wetness",
]


def longest_run(mask: np.ndarray) -> np.ndarray:
    """Longest run of True along axis 1 for a (Y, D) boolean array."""
    best = np.zeros(mask.shape[0], dtype=int)
    current = np.zeros(mask.shape[0], dtype=int)
    for day in range(mask.shape[1]):
        current = np.where(mask[:, day], current + 1, 0)
        best = np.maximum(best, current)
    return best


def growing_degree_days(tmean: np.ndarray, base: float = GDD_BASE_C, cap: float = GDD_CAP_C) -> np.ndarray:
    return np.maximum(np.minimum(tmean, cap) - base, 0.0)


def trend(years: np.ndarray, values: np.ndarray) -> dict | None:
    """Theil-Sen slope per decade + Kendall tau p-value. None when there is too little data."""
    ok = ~np.isnan(values)
    if ok.sum() < 10:
        return None
    x, y = years[ok].astype(float), values[ok].astype(float)
    if np.allclose(y, y[0]):
        return {"slope_per_decade": 0.0, "p_value": 1.0, "significant": False, "n_years": int(ok.sum())}
    slope = stats.theilslopes(y, x)[0]
    tau = stats.kendalltau(x, y)
    p = float(tau.pvalue) if not np.isnan(tau.pvalue) else 1.0
    return {
        "slope_per_decade": round(float(slope) * 10.0, 3),
        "p_value": round(p, 4),
        "significant": bool(p < 0.05),
        "n_years": int(ok.sum()),
    }


def season_indicators(weather: Weather, plan: SeasonPlan, season: str) -> pd.DataFrame:
    """One row per rotation year with the indicators of the full six-month season window."""
    years = np.arange(weather.start.year, weather.end.year + 1)
    starts = [plan.start_date(season, int(y)) for y in years]
    m = window_matrix(
        weather, starts, 0, SEASON_WINDOW_DAYS, ["rain", "et0", "tmax", "tmin", "tmean", "gwetroot"]
    )
    complete = ~(
        np.isnan(m["rain"]).any(axis=1) | np.isnan(m["tmax"]).any(axis=1) | np.isnan(m["et0"]).any(axis=1)
    )
    rain = m["rain"].sum(axis=1)
    et0 = m["et0"].sum(axis=1)
    out = pd.DataFrame(
        {
            "year": years,
            "start": [s.isoformat() for s in starts],
            "rain_mm": rain,
            "et0_mm": et0,
            "water_balance_mm": rain - et0,
            "gdd": growing_degree_days(m["tmean"]).sum(axis=1),
            "dry_spell_days": longest_run(m["rain"] < DRY_DAY_MM).astype(float),
            "heat_days": (m["tmax"] > HEAT_THRESHOLD_C).sum(axis=1).astype(float),
            "frost_days": (m["tmin"] < 0.0).sum(axis=1).astype(float),
            "tmean_c": m["tmean"].mean(axis=1),
            "root_wetness": np.nanmean(m["gwetroot"], axis=1) if not np.isnan(m["gwetroot"]).all() else np.nan,
        }
    )
    return out[complete].reset_index(drop=True)


def frost_summary(weather: Weather) -> dict:
    """Frost statistics; in frost-free climates every field reports that plainly."""
    d = weather.daily
    frost = d["tmin"] < 0.0
    per_year = frost.groupby(d.index.year).sum()
    if int(frost.sum()) == 0:
        return {
            "frost_free": True,
            "frost_days_per_year": 0.0,
            "last_spring_frost": None,
            "first_autumn_frost": None,
        }
    north = weather.lat >= 0
    last_spring, first_autumn = [], []
    for year, group in d.groupby(d.index.year):
        days = group.index[group["tmin"] < 0.0]
        if not len(days):
            continue
        doy = days.day_of_year.to_numpy()
        # cold season straddles new year in the north, mid-year in the south
        first_half = doy[doy <= 182] if north else doy[doy > 182]
        second_half = doy[doy > 182] if north else doy[doy <= 182]
        if len(first_half):
            last_spring.append(int(first_half.max()))
        if len(second_half):
            first_autumn.append(int(second_half.min()))

    def as_label(doys: list[int]) -> str | None:
        if not doys:
            return None
        day = date(2001, 1, 1) + timedelta(days=int(np.median(doys)) - 1)
        return f"{day.day} {MONTH_NAMES[day.month - 1]}"

    return {
        "frost_free": False,
        "frost_days_per_year": round(float(per_year.mean()), 1),
        "last_spring_frost": as_label(last_spring),
        "first_autumn_frost": as_label(first_autumn),
    }


def _records(frame: pd.DataFrame, digits: int = 1) -> list[dict]:
    out = []
    for row in frame.to_dict(orient="records"):
        clean = {}
        for key, value in row.items():
            if isinstance(value, (float, np.floating)):
                clean[key] = None if np.isnan(value) else round(float(value), 3 if key == "root_wetness" else digits)
            elif isinstance(value, (np.integer,)):
                clean[key] = int(value)
            else:
                clean[key] = value
        out.append(clean)
    return out


def climate_summary(weather: Weather, plan: SeasonPlan) -> dict:
    """Everything /api/climate returns: season calendar, indicators, yearly series, trends."""
    clim = monthly_climatology(weather)
    seasons = {}
    for season in plan.SEASONS:
        table = season_indicators(weather, plan, season)
        years = table["year"].to_numpy()
        means, trends = {}, {}
        for name in INDICATORS:
            values = table[name].to_numpy(dtype="float64")
            if np.isnan(values).all():
                means[name] = None
                trends[name] = None
                continue
            means[name] = round(float(np.nanmean(values)), 3 if name == "root_wetness" else 1)
            trends[name] = trend(years, values)
        seasons[season] = {"yearly": _records(table), "mean": means, "trend": trends}

    d = weather.daily
    grouped = d.groupby(d.index.year)
    counts = grouped["rain"].count()
    annual = pd.DataFrame(
        {
            "rain_mm": grouped["rain"].sum(),
            "et0_mm": grouped["et0"].sum(),
            "tmean_c": grouped["tmean"].mean(),
            "tmax_c": grouped["tmax"].mean(),
            "heat_days": grouped["tmax"].apply(lambda s: float((s > HEAT_THRESHOLD_C).sum())),
        }
    )
    annual = annual[counts >= 360]  # complete calendar years only
    annual_years = annual.index.to_numpy()
    annual_trends = {c: trend(annual_years, annual[c].to_numpy(dtype="float64")) for c in annual.columns}
    annual = annual.reset_index().rename(columns={"index": "year", "date": "year"})
    annual.columns = ["year"] + list(annual.columns[1:])

    monthly = [
        {
            "month": int(m),
            "label": MONTH_NAMES[int(m) - 1],
            "rain_mm": None if pd.isna(r.rain) else round(float(r.rain), 1),
            "et0_mm": None if pd.isna(r.et0) else round(float(r.et0), 1),
            "tmean_c": None if pd.isna(r.tmean) else round(float(r.tmean), 1),
            "tmax_c": None if pd.isna(r.tmax) else round(float(r.tmax), 1),
            "tmin_c": None if pd.isna(r.tmin) else round(float(r.tmin), 1),
        }
        for m, r in clim.iterrows()
    ]
    return {
        "season_plan": plan.public(),
        "record": {
            "start": weather.start.isoformat(),
            "end": weather.end.isoformat(),
            "complete_years": int(len(annual)),
        },
        "thresholds": {
            "heat_day_tmax_c": HEAT_THRESHOLD_C,
            "dry_day_mm": DRY_DAY_MM,
            "gdd_base_c": GDD_BASE_C,
            "gdd_cap_c": GDD_CAP_C,
            "et0_method": "FAO-56 Penman-Monteith (Hargreaves on days with missing inputs)",
        },
        "monthly_climatology": monthly,
        "seasons": seasons,
        "annual": _records(annual),
        "annual_trend": annual_trends,
        "frost": frost_summary(weather),
        "quality": weather.quality,
    }
