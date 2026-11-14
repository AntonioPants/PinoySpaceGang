"""Field vitals, flash-drought early warning and "field memory".

Flash drought = drought that develops in weeks rather than months.  Three signals are
combined, each labelled with where it came from:

  1. Root-zone wetness percentile (vs the same time of year in all other years) and how
     fast it is falling.  A drop from >= 40th to <= 20th percentile within 20 days is the
     flash-drought definition of Ford & Labosier (2017).
     Source: SMAP L4 when available, otherwise NASA POWER GWETROOT (modelled).
  2. Evaporative stress: ECOSTRESS ESI when available; otherwise a proxy ETa/ET0 from a
     running soil-water bucket driven by POWER rain and ET0 (modelled).
  3. Canopy-minus-air temperature: ECOSTRESS LST minus air temperature when available;
     otherwise POWER skin temperature minus 2 m air temperature (modelled, daily mean).

The level (normal / watch / warning / alert) is a transparent points system, not a forecast.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .climate import Weather
from .i18n import t
from .soil import SoilProfile

DOY_WINDOW = 15  # +/- days used for "same time of year"
FLASH_WINDOW_DAYS = 20
SERIES_DAYS = 120
HEAT_DAY_C = 35.0
LEVELS = ["normal", "watch", "warning", "alert"]
MIN_SMAP_YEARS = 5


def _doy_distance(doy: np.ndarray, target: int) -> np.ndarray:
    d = np.abs(doy - target)
    return np.minimum(d, 366 - d)


def percentile_series(values: pd.Series, days: int = SERIES_DAYS) -> pd.Series:
    """Percentile (0-100) of each of the last ``days`` values vs the same time of other years."""
    smooth = values.rolling(5, min_periods=3).mean().dropna()
    if smooth.empty:
        return pd.Series(dtype="float64")
    doy = smooth.index.day_of_year.to_numpy()
    year = smooth.index.year.to_numpy()
    data = smooth.to_numpy()
    out = {}
    for pos in range(max(0, len(smooth) - days), len(smooth)):
        mask = (_doy_distance(doy, doy[pos]) <= DOY_WINDOW) & (year != year[pos])
        sample = data[mask]
        if sample.size < 60:
            continue
        out[smooth.index[pos]] = 100.0 * float((sample < data[pos]).mean())
    return pd.Series(out, dtype="float64")


def stress_proxy(weather: Weather, soil: SoilProfile) -> pd.Series:
    """ETa/ET0 of a reference surface from a continuous 1 m soil-water bucket (1 = no stress)."""
    d = weather.daily
    rain = d["rain"].fillna(0.0).to_numpy()
    et0 = d["et0"].fillna(0.0).to_numpy()
    taw = soil.awc * 1000.0
    raw = 0.5 * taw
    dr = 0.5 * taw
    ratio = np.empty(len(d))
    for i in range(len(d)):
        dr = max(dr - rain[i], 0.0)
        ks = 1.0 if dr <= raw else max(taw - dr, 0.0) / (taw - raw)
        dr = min(dr + ks * et0[i], taw)
        ratio[i] = ks
    return pd.Series(ratio, index=d.index)


def _anomaly_z(series: pd.Series, at: pd.Timestamp) -> float | None:
    """z-score of the 7-day mean ending at ``at`` vs the same time of other years."""
    smooth = series.rolling(7, min_periods=4).mean().dropna()
    if at not in smooth.index:
        return None
    doy = smooth.index.day_of_year.to_numpy()
    year = smooth.index.year.to_numpy()
    mask = (_doy_distance(doy, at.day_of_year) <= DOY_WINDOW) & (year != at.year)
    sample = smooth.to_numpy()[mask]
    if sample.size < 60 or sample.std() == 0:
        return None
    return float((smooth.loc[at] - sample.mean()) / sample.std())


def root_zone_series(weather: Weather, smap: pd.DataFrame | None) -> tuple[pd.Series, dict]:
    """Root-zone wetness: SMAP L4 when there is enough of it, else POWER GWETROOT (labelled)."""
    if smap is not None and "smap_rootzone_wetness" in smap:
        series = smap["smap_rootzone_wetness"].dropna()
        if len(series) and (series.index[-1] - series.index[0]).days >= 365 * MIN_SMAP_YEARS:
            meta = dict(smap.attrs.get("meta", {}))
            return series, {
                "source": "smap_l4",
                "label": "SMAP L4 root-zone wetness",
                "kind": "observed",
                "resolution": meta.get("resolution", "9 km"),
                "fallback": False,
            }
    series = weather.daily["gwetroot"].dropna() if "gwetroot" in weather.daily else pd.Series(dtype="float64")
    return series, {
        "source": "power",
        "label": "NASA POWER root-zone wetness (GWETROOT)",
        "kind": "modelled",
        "resolution": "0.5 x 0.625 degrees",
        "fallback": True,
        "fallback_reason": "SMAP L4 not available (needs Earthdata credentials); POWER GWETROOT used instead",
    }


def _value(value, decimals: int = 2):
    return None if value is None or (isinstance(value, float) and np.isnan(value)) else round(float(value), decimals)


def vitals(weather: Weather, wetness: pd.Series, wet_meta: dict) -> dict:
    """Latest field conditions; every value carries its date and source."""
    d = weather.daily
    power_badge = {"source": "power", "kind": "modelled", "label": "NASA POWER"}
    temp = d["tmax"].dropna()
    rain = d["rain"].dropna()
    et0 = d["et0"].dropna()
    top = d["gwettop"].dropna() if "gwettop" in d else pd.Series(dtype="float64")
    out = {}
    if len(wetness):
        out["root_zone_wetness"] = {
            "value": _value(wetness.iloc[-1]),
            "unit": "0-1",
            "date": wetness.index[-1].date().isoformat(),
            "badge": {"source": wet_meta["source"], "kind": wet_meta["kind"], "label": wet_meta["label"]},
        }
    if len(top):
        out["surface_wetness"] = {
            "value": _value(top.iloc[-1]),
            "unit": "0-1",
            "date": top.index[-1].date().isoformat(),
            "badge": power_badge,
        }
    if len(temp):
        last7 = temp.iloc[-7:]
        out["tmax"] = {
            "value": _value(temp.iloc[-1], 1),
            "unit": "C",
            "date": temp.index[-1].date().isoformat(),
            "badge": power_badge,
        }
        out["tmax_7d_mean"] = {"value": _value(last7.mean(), 1), "unit": "C", "date": temp.index[-1].date().isoformat(), "badge": power_badge}
        out["heat_days_7d"] = {
            "value": int((last7 > HEAT_DAY_C).sum()),
            "unit": f"days > {HEAT_DAY_C:g} C",
            "date": temp.index[-1].date().isoformat(),
            "badge": power_badge,
        }
    if len(rain):
        out["rain_7d"] = {"value": _value(rain.iloc[-7:].sum(), 1), "unit": "mm", "date": rain.index[-1].date().isoformat(), "badge": power_badge}
        out["rain_30d"] = {"value": _value(rain.iloc[-30:].sum(), 1), "unit": "mm", "date": rain.index[-1].date().isoformat(), "badge": power_badge}
    if len(et0):
        out["et0_7d_mean"] = {"value": _value(et0.iloc[-7:].mean(), 1), "unit": "mm/day", "date": et0.index[-1].date().isoformat(), "badge": power_badge}
    return out


def flash_drought(
    weather: Weather,
    soil: SoilProfile,
    smap: pd.DataFrame | None = None,
    ecostress: pd.DataFrame | None = None,
    lang: str = "en",
) -> dict:
    wetness, wet_meta = root_zone_series(weather, smap)
    reasons: list[str] = []
    points = 0
    signals: dict = {}

    # 1. root-zone wetness percentile and its rate of change
    pct = percentile_series(wetness)
    flash = False
    if len(pct):
        now = float(pct.iloc[-1])
        window = pct.iloc[-(FLASH_WINDOW_DAYS + 1):]
        change = float(now - window.iloc[0]) if len(window) > 1 else 0.0
        flash = bool(window.max() >= 40.0 and now <= 20.0 and window.idxmax() < window.index[-1])
        signals["wetness_percentile"] = {
            "value": round(now, 0),
            "change_20d": round(change, 0),
            "date": pct.index[-1].date().isoformat(),
            "badge": {"source": wet_meta["source"], "kind": wet_meta["kind"], "label": wet_meta["label"]},
        }
        if now <= 20:
            points += 2
            reasons.append(t(lang, "drought.pct_low", pct=round(now), dry=round(100 - now)))
        elif now <= 30:
            points += 1
            reasons.append(t(lang, "drought.pct_lowish", pct=round(now)))
        if flash:
            points += 2
            reasons.append(t(lang, "drought.flash", start=round(float(window.max())), now=round(now), days=FLASH_WINDOW_DAYS))
        elif change <= -20:
            points += 1
            reasons.append(t(lang, "drought.falling", drop=round(-change), days=FLASH_WINDOW_DAYS))
    else:
        reasons.append(t(lang, "drought.no_wetness"))

    # 2. evaporative stress
    esi_series, esi_badge = None, None
    if ecostress is not None and "esi" in ecostress and ecostress["esi"].notna().sum() >= 5:
        recent = ecostress["esi"].dropna()
        if (weather.daily.index[-1] - recent.index[-1]).days <= 45:
            esi_series = recent
            esi_badge = {"source": "ecostress", "kind": "observed", "label": "ECOSTRESS ESI (70 m)"}
    if esi_series is None:
        esi_series = stress_proxy(weather, soil)
        esi_badge = {
            "source": "power",
            "kind": "modelled",
            "label": "Stress proxy ETa/ET0 from NASA POWER (ECOSTRESS unavailable)",
        }
        esi_now = float(esi_series.iloc[-14:].mean())
        esi_before = float(esi_series.iloc[-28:-14].mean())
    else:
        esi_now = float(esi_series.iloc[-3:].mean())
        esi_before = float(esi_series.iloc[-6:-3].mean()) if len(esi_series) >= 6 else esi_now
    esi_change = esi_now - esi_before
    signals["evaporative_stress"] = {
        "value": round(esi_now, 2),
        "change": round(esi_change, 2),
        "date": esi_series.index[-1].date().isoformat(),
        "badge": esi_badge,
    }
    if esi_now < 0.5:
        points += 1
        reasons.append(t(lang, "drought.esi_low", value=round(esi_now, 2)))
    if esi_change <= -0.15:
        points += 1
        reasons.append(t(lang, "drought.esi_falling", drop=round(-esi_change, 2)))

    # 3. canopy minus air temperature
    d = weather.daily
    diff_series, diff_badge = None, None
    if ecostress is not None and "lst_c" in ecostress and ecostress["lst_c"].notna().sum() >= 5:
        lst = ecostress["lst_c"].dropna()
        if (d.index[-1] - lst.index[-1]).days <= 45:
            air = d["tmax"].reindex(lst.index)
            diff_series = (lst - air).dropna()
            diff_badge = {"source": "ecostress", "kind": "observed", "label": "ECOSTRESS LST minus POWER air temperature"}
    if (diff_series is None or diff_series.empty) and "tskin" in d and d["tskin"].notna().any():
        diff_series = (d["tskin"] - d["tmean"]).dropna()
        diff_badge = {
            "source": "power",
            "kind": "modelled",
            "label": "POWER skin minus air temperature (ECOSTRESS unavailable)",
        }
    if diff_series is not None and len(diff_series):
        z = _anomaly_z(diff_series, diff_series.index[-1]) if diff_badge["source"] == "power" else None
        latest = float(diff_series.iloc[-7:].mean())
        signals["canopy_air_difference"] = {
            "value": round(latest, 1),
            "anomaly_z": _value(z, 1),
            "unit": "C",
            "date": diff_series.index[-1].date().isoformat(),
            "badge": diff_badge,
        }
        if z is not None and z >= 1.0:
            points += 1
            reasons.append(t(lang, "drought.canopy_hot", z=round(z, 1)))
        elif z is None and latest >= 5.0:
            points += 1
            reasons.append(t(lang, "drought.canopy_hot_abs", value=round(latest, 1)))

    level = LEVELS[0 if points == 0 else 1 if points <= 2 else 2 if points <= 4 else 3]
    if not reasons:
        reasons.append(t(lang, "drought.normal"))

    start = d.index[-1] - pd.Timedelta(days=SERIES_DAYS - 1)
    frame = pd.DataFrame(index=pd.date_range(start, d.index[-1], freq="D"))
    frame["wetness"] = wetness.reindex(frame.index)
    frame["percentile"] = pct.reindex(frame.index)
    frame["stress"] = esi_series.reindex(frame.index)
    frame["rain"] = d["rain"].reindex(frame.index)
    frame["tmax"] = d["tmax"].reindex(frame.index)
    series = [
        {
            "date": idx.date().isoformat(),
            "wetness": _value(row.wetness, 3),
            "percentile": _value(row.percentile, 0),
            "stress": _value(row.stress, 2),
            "rain": _value(row.rain, 1),
            "tmax": _value(row.tmax, 1),
        }
        for idx, row in frame.iterrows()
    ]
    return {
        "level": level,
        "points": points,
        "flash_drought_criterion_met": flash,
        "headline": t(lang, f"drought.level.{level}"),
        "reasons": reasons,
        "signals": signals,
        "vitals": vitals(weather, wetness, wet_meta),
        "series": series,
        "as_of": d.index[-1].date().isoformat(),
        "root_zone_source": wet_meta,
        "method": "points: wetness percentile <=20 (+2) / <=30 (+1); flash drop 40th->20th in 20 days (+2) "
        "or >=20-point fall (+1); stress index < 0.5 (+1); stress falling >= 0.15 (+1); canopy-air anomaly (+1). "
        "1-2 = watch, 3-4 = warning, 5+ = alert.",
    }


def field_memory(weather: Weather, smap: pd.DataFrame | None = None) -> dict:
    """Multi-year root-zone moisture history for the field."""
    wetness, meta = root_zone_series(weather, smap)
    if wetness.empty:
        return {"available": False, "source": meta, "monthly": [], "weekly": [], "yearly": []}
    monthly = wetness.groupby([wetness.index.year, wetness.index.month]).mean()
    monthly_rows = [
        {"year": int(y), "month": int(m), "wetness": round(float(v), 3)} for (y, m), v in monthly.items()
    ]
    week = np.minimum((wetness.index.day_of_year - 1) // 7 + 1, 52)
    this_year = wetness.index[-1].year
    past = wetness[wetness.index.year < this_year]
    past_week = week[wetness.index.year < this_year]
    current = wetness[wetness.index.year == this_year].groupby(week[wetness.index.year == this_year]).mean()
    weekly_rows = []
    grouped = past.groupby(past_week)
    for w in range(1, 53):
        if w not in grouped.groups:
            continue
        values = grouped.get_group(w).to_numpy()
        weekly_rows.append(
            {
                "week": int(w),
                "p10": round(float(np.percentile(values, 10)), 3),
                "p50": round(float(np.percentile(values, 50)), 3),
                "p90": round(float(np.percentile(values, 90)), 3),
                "current": round(float(current[w]), 3) if w in current.index else None,
            }
        )
    yearly = wetness.groupby(wetness.index.year).agg(["mean", "min", "count"])
    yearly_rows = [
        {"year": int(y), "mean": round(float(r["mean"]), 3), "min": round(float(r["min"]), 3)}
        for y, r in yearly.iterrows()
        if r["count"] >= 300
    ]
    driest = sorted(yearly_rows, key=lambda r: r["mean"])[:5]
    return {
        "available": True,
        "source": meta,
        "current_year": int(this_year),
        "monthly": monthly_rows,
        "weekly": weekly_rows,
        "yearly": yearly_rows,
        "driest_years": [r["year"] for r in driest],
        "record": {"start": wetness.index[0].date().isoformat(), "end": wetness.index[-1].date().isoformat()},
    }
