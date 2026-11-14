"""Daily weather preparation and the season calendar.

* ``prepare_weather`` turns a NASA POWER frame into a continuous daily table with ET0 and
  records every gap it had to bridge (nothing is filled silently).
* ``detect_season_plan`` splits the year into a main and an off season from the climate
  itself, so the engine works for any latitude/longitude.
* ``season_matrix`` cuts the record into one row per year, aligned on the sowing date - the
  shape the vectorised water balance and the historical replay work on.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np
import pandas as pd

from .et0 import daily_et0

MAX_GAP_DAYS = 5  # gaps up to this long are bridged by linear interpolation (and counted)
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

COLUMN_MAP = {
    "PRECTOTCORR": "rain",
    "T2M_MAX": "tmax",
    "T2M_MIN": "tmin",
    "T2M": "tmean",
    "GWETROOT": "gwetroot",
    "GWETTOP": "gwettop",
    "RH2M": "rh",
    "WS2M": "wind",
    "ALLSKY_SFC_SW_DWN": "rs",
    "TS": "tskin",
}
REQUIRED = ["rain", "tmax", "tmin"]


@dataclass
class Weather:
    daily: pd.DataFrame  # continuous daily index; columns from COLUMN_MAP plus "et0"
    lat: float
    lon: float
    elevation_m: float
    quality: dict = field(default_factory=dict)
    meta: dict = field(default_factory=dict)

    @property
    def start(self) -> date:
        return self.daily.index[0].date()

    @property
    def end(self) -> date:
        return self.daily.index[-1].date()


def bridge_short_gaps(series: pd.Series, max_gap: int = MAX_GAP_DAYS) -> pd.Series:
    """Linearly interpolate interior gaps of at most ``max_gap`` days; longer gaps stay NaN.

    (pandas' ``interpolate(limit=n)`` would fill the first n days of a long gap too.)
    """
    missing = series.isna()
    if not missing.any():
        return series
    run_id = (missing != missing.shift()).cumsum()
    run_length = missing.groupby(run_id).transform("sum")
    filled = series.interpolate(limit_area="inside")
    return filled.where(~missing | (run_length <= max_gap))


def prepare_weather(power: pd.DataFrame, lat: float, lon: float) -> Weather:
    meta = dict(power.attrs.get("meta", {}))
    elevation = meta.get("elevation_m")
    elevation_known = elevation is not None and not pd.isna(elevation)
    elevation = float(elevation) if elevation_known else 0.0

    full_index = pd.date_range(power.index.min(), power.index.max(), freq="D")
    raw = power.reindex(full_index)
    missing_before = {COLUMN_MAP[c]: int(raw[c].isna().sum()) for c in COLUMN_MAP if c in raw}

    # ET0 from the untouched values first, so we know which days needed the fallback method.
    et0, method = daily_et0(raw, lat, elevation)

    daily = pd.DataFrame(index=full_index)
    for src, dst in COLUMN_MAP.items():
        if src in raw:
            daily[dst] = bridge_short_gaps(raw[src])
    if "tmean" not in daily and {"tmax", "tmin"} <= set(daily):
        daily["tmean"] = (daily["tmax"] + daily["tmin"]) / 2.0
    daily["et0"] = bridge_short_gaps(pd.Series(et0, index=full_index))
    daily.index.name = "date"

    filled = {
        name: missing_before.get(name, 0) - int(daily[name].isna().sum())
        for name in daily.columns
        if name in missing_before
    }
    quality = {
        "days": int(len(daily)),
        "gap_filled_values": {k: v for k, v in filled.items() if v > 0},
        "still_missing_values": {
            k: int(daily[k].isna().sum()) for k in daily.columns if int(daily[k].isna().sum()) > 0
        },
        "et0_penman_monteith_days": int((method == "pm").sum()),
        "et0_hargreaves_days": int((method == "hargreaves").sum()),
        "elevation_known": elevation_known,
        "gap_rule": f"gaps of up to {MAX_GAP_DAYS} days are linearly interpolated and counted here; "
        "seasons with longer gaps are excluded from the replay",
    }
    return Weather(daily=daily, lat=lat, lon=lon, elevation_m=elevation, quality=quality, meta=meta)


# ----------------------------------------------------------------------------------------------
# Season calendar
# ----------------------------------------------------------------------------------------------
@dataclass(frozen=True)
class SeasonPlan:
    """Two six-month seasons per rotation year.

    regime "rainfall": main = the wettest six months (wet season), off = dry season.
    regime "thermal":  main = the warmest six months (warm season), off = cool season.
    Crop season tags map wet -> main and dry -> off in both regimes; the feasibility filter
    then removes crops whose temperature envelope does not fit.
    """

    regime: str
    main_start_month: int
    sow_offset_main: int
    sow_offset_off: int

    SEASONS = ("main", "off")

    @property
    def off_start_month(self) -> int:
        return (self.main_start_month + 6 - 1) % 12 + 1

    def crop_tag(self, season: str) -> str:
        return "wet" if season == "main" else "dry"

    def kind(self, season: str) -> str:
        if self.regime == "rainfall":
            return "wet" if season == "main" else "dry"
        return "warm" if season == "main" else "cool"

    def start_date(self, season: str, year: int) -> date:
        """First day of the season window that belongs to rotation year ``year``."""
        if season == "main":
            return date(year, self.main_start_month, 1)
        month = self.off_start_month
        return date(year if month > self.main_start_month else year + 1, month, 1)

    def sow_offset(self, season: str) -> int:
        return self.sow_offset_main if season == "main" else self.sow_offset_off

    def sow_date(self, season: str, year: int) -> date:
        return self.start_date(season, year) + timedelta(days=self.sow_offset(season))

    def length_days(self, season: str) -> int:
        """Days from sowing to the end of the season window (non-leap reference year)."""
        start = self.start_date(season, 2001)
        end = self.start_date("off" if season == "main" else "main", 2001 if season == "main" else 2002)
        return (end - start).days - self.sow_offset(season)

    def months(self, season: str) -> list[int]:
        first = self.main_start_month if season == "main" else self.off_start_month
        return [(first - 1 + i) % 12 + 1 for i in range(6)]

    def public(self) -> dict:
        out = {"regime": self.regime}
        for season in self.SEASONS:
            months = self.months(season)
            sow = self.sow_date(season, 2001)
            out[season] = {
                "kind": self.kind(season),
                "months": months,
                "label": f"{MONTH_NAMES[months[0] - 1]}-{MONTH_NAMES[months[-1] - 1]}",
                "sow_month": sow.month,
                "sow_day": sow.day,
                "sow_label": f"{sow.day} {MONTH_NAMES[sow.month - 1]}",
                "length_days": self.length_days(season),
            }
        return out


def monthly_climatology(weather: Weather) -> pd.DataFrame:
    d = weather.daily
    by_month = d.groupby([d.index.year, d.index.month])
    monthly = pd.DataFrame(
        {
            "rain": by_month["rain"].sum(min_count=20),
            "et0": by_month["et0"].sum(min_count=20),
            "tmean": by_month["tmean"].mean(),
            "tmax": by_month["tmax"].mean(),
            "tmin": by_month["tmin"].mean(),
        }
    )
    clim = monthly.groupby(level=1).mean()
    return clim.reindex(range(1, 13))


def detect_season_plan(weather: Weather) -> SeasonPlan:
    clim = monthly_climatology(weather)
    temp_range = float(clim["tmean"].max() - clim["tmean"].min())
    # Strong temperature seasonality (mid/high latitudes): temperature decides the calendar.
    thermal = temp_range >= 10.0
    series = (clim["tmean"] if thermal else clim["rain"]).to_numpy(dtype="float64")
    series = np.nan_to_num(series, nan=0.0)
    totals = [sum(series[(m + i) % 12] for i in range(6)) for m in range(12)]
    main_start = int(np.argmax(totals)) + 1
    if thermal:
        return SeasonPlan("thermal", main_start, sow_offset_main=20, sow_offset_off=10)
    # Rain-fed logic: sow a month into the rainy window, once the soil profile has wetted up;
    # sow the off-season crop right after the rains to use the stored soil moisture.
    return SeasonPlan("rainfall", main_start, sow_offset_main=30, sow_offset_off=10)


# ----------------------------------------------------------------------------------------------
# Year x day matrices
# ----------------------------------------------------------------------------------------------
@dataclass
class SeasonWeather:
    season: str
    years: np.ndarray  # rotation-year labels, shape (Y,)
    sow_dates: list  # date per year
    pre: int  # days before sowing included in the arrays
    length: int  # days from sowing included in the arrays
    data: dict  # variable -> array (Y, pre + length)
    valid: np.ndarray  # (Y,) True when the whole window has rain + temperature + ET0

    def after_sowing(self, name: str) -> np.ndarray:
        return self.data[name][:, self.pre :]

    def before_sowing(self, name: str, days: int) -> np.ndarray:
        return self.data[name][:, self.pre - days : self.pre]


def window_matrix(weather: Weather, starts: list, pre: int, length: int, columns: list[str]) -> dict:
    """Stack ``columns`` into (len(starts), pre + length) arrays; NaN outside the record."""
    d = weather.daily
    first = d.index[0]
    n = len(d)
    offsets = np.array([(pd.Timestamp(s) - first).days for s in starts])[:, None] + np.arange(-pre, length)[None, :]
    inside = (offsets >= 0) & (offsets < n)
    safe = np.clip(offsets, 0, n - 1)
    out = {}
    for name in columns:
        if name not in d:
            out[name] = np.full(offsets.shape, np.nan)
            continue
        values = d[name].to_numpy(dtype="float64")
        out[name] = np.where(inside, values[safe], np.nan)
    return out


SEASON_COLUMNS = ["rain", "et0", "tmax", "tmin", "tmean", "gwetroot", "gwettop", "wind", "tskin"]


def season_matrix(weather: Weather, plan: SeasonPlan, season: str, pre: int = 120) -> SeasonWeather:
    length = plan.length_days(season)
    years = np.arange(weather.start.year, weather.end.year + 1)
    sow_dates = [plan.sow_date(season, int(y)) for y in years]
    data = window_matrix(weather, sow_dates, pre, length, SEASON_COLUMNS)
    valid = np.ones(len(years), dtype=bool)
    for name in REQUIRED + ["et0"]:
        valid &= ~np.isnan(data[name]).any(axis=1)
    return SeasonWeather(season, years, sow_dates, pre, length, data, valid)
