"""Crop-season simulation: FAO-56 soil water balance + simple weather-damage rules.

For one crop in one season the model runs day by day through every year of the record at
once (numpy arrays with one element per year).  It produces a 0-100 *season outcome* which
is a RELATIVE index of how well the season suited the crop - not a yield prediction.

    outcome = 100 x f_water x f_heat x f_waterlogging x f_extreme x f_thermal_time x f_frost

f_water          FAO-33: 1 - Ky x (1 - ETa/ETc), with ETa from the FAO-56 dual-threshold
                 root-zone balance (Kc curve, growing roots, depletion fraction p, Ks).
f_heat           days with Tmax above the crop's limit during mid-season (flowering/filling).
f_waterlogging   days when the root zone is at field capacity and still receives >= 10 mm.
f_extreme        days with >= 100 mm rain or daily-mean wind >= 8 m/s (typhoon proxy).
f_thermal_time   growing-degree days available in the season window vs the crop's need.
f_frost          any frost on a frost-sensitive crop.

The damage coefficients below are TEAM assumptions chosen to be explainable, and are listed
in the README under "agronomy values to double-check".
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .climate.weather import SeasonWeather
from .crops import Crop
from .soil import SoilProfile

# ---- tunable assumptions (all flagged in the README) -----------------------------------------
SPINUP_PROFILE_M = 1.0  # soil depth tracked before sowing
SPINUP_KC = 0.5  # stubble / weedy fallow evaporating before the crop
PADDY_POND_MM = 100.0  # water a bunded paddy can hold above saturation
PADDY_REFILL_MM = 50.0  # irrigation re-floods a paddy to this depth
WATERLOG_EXCESS_MM = 10.0  # surplus on a day with a full root zone that counts as waterlogging
WATERLOG_FULL_EFFECT_DAYS = 25.0  # waterlogged days at which the full penalty applies
WATERLOG_SENSITIVITY = {1: 0.8, 2: 0.6, 3: 0.4, 4: 0.2, 5: 0.0}  # by tolerance class
DRAINAGE_FACTOR = {"poor": 1.0, "moderate": 0.6, "good": 0.25}
EXTREME_RAIN_MM = 100.0  # grid-cell daily rain that marks a destructive storm
EXTREME_WIND_MS = 8.0  # grid-cell daily mean 2 m wind that marks a destructive storm
EXTREME_LOSS_PER_DAY = 0.12
EXTREME_LOSS_PER_DAY_PADDY = 0.06
EXTREME_FLOOR = 0.5
EXTREME_FLOOR_PADDY = 0.7
HEAT_LOSS_PER_DAY = 0.02
HEAT_FLOOR = 0.4
FROST_FACTOR = 0.1
SALINITY_SLOPE_PER_DS_M = 0.12  # generic yield loss per dS/m above the crop threshold
SUPPLEMENTAL_CAP_MM = 150.0  # water a small pond / shallow tube well can add per season
IRRIGATION_EFFICIENCY = 0.6  # net -> gross irrigation (surface irrigation)
GDD_CAP_C = 30.0

GOOD_OUTCOME = 70.0  # season outcome at or above this = "good"
FAILED_OUTCOME = 40.0  # below this = "failed"

WATER_SOURCES = ("rainfed", "supplemental", "irrigated")


@dataclass
class SimSettings:
    water_source: str = "rainfed"  # rainfed | supplemental | irrigated
    drainage: str = "moderate"  # poor | moderate | good
    rain_scale: float = 1.0  # what-if multiplier on daily rainfall
    supplemental_cap_mm: float = SUPPLEMENTAL_CAP_MM


@dataclass
class SeasonResult:
    crop_id: str
    season: str
    outcome: np.ndarray  # (Y,) 0-100
    water_satisfaction: np.ndarray  # (Y,) ETa / ETc, 0-1
    factors: dict  # name -> (Y,) multiplicative factor
    etc_mm: np.ndarray
    eta_mm: np.ndarray
    rain_mm: np.ndarray
    irrigation_mm: np.ndarray
    heat_days: np.ndarray
    waterlog_days: np.ndarray
    extreme_days: np.ndarray
    truncated: bool  # crop duration did not fit the season window


def default_drainage(soil: SoilProfile) -> str:
    """Guess drainage from texture when the farmer has not said (labelled as assumed)."""
    if soil.texture in {"clay", "silty clay", "sandy clay", "silty clay loam", "clay loam"}:
        return "poor"
    if soil.texture in {"sand", "loamy sand", "sandy loam"}:
        return "good"
    return "moderate"


def kc_curve(crop: Crop, days: int) -> np.ndarray:
    """Daily crop coefficient from the four FAO-56 growth stages."""
    ini, dev, mid, _late = crop.stages
    n_ini = max(1, int(round(ini * days)))
    n_dev = max(1, int(round(dev * days)))
    n_mid = max(1, int(round(mid * days)))
    n_late = max(1, days - n_ini - n_dev - n_mid)
    kc_ini, kc_mid, kc_end = crop.kc
    curve = np.concatenate(
        [
            np.full(n_ini, kc_ini),
            np.linspace(kc_ini, kc_mid, n_dev, endpoint=False),
            np.full(n_mid, kc_mid),
            np.linspace(kc_mid, kc_end, n_late),
        ]
    )
    return curve[:days] if len(curve) >= days else np.pad(curve, (0, days - len(curve)), constant_values=kc_end)


def stage_bounds(crop: Crop, days: int) -> tuple[int, int, int]:
    """Day indices where the development, mid-season and late stages start."""
    ini, dev, mid, _ = crop.stages
    a = max(1, int(round(ini * days)))
    b = a + max(1, int(round(dev * days)))
    c = min(days, b + max(1, int(round(mid * days))))
    return a, b, c


def root_curve(crop: Crop, days: int) -> np.ndarray:
    """Root depth grows linearly from a seedling depth to the maximum by mid-season."""
    _, mid_start, _ = stage_bounds(crop, days)
    z_min = min(0.25, crop.root_depth_m)
    growth = np.linspace(z_min, crop.root_depth_m, max(mid_start, 1))
    return np.concatenate([growth, np.full(max(days - len(growth), 0), crop.root_depth_m)])[:days]


def spinup_depletion(sw: SeasonWeather, soil: SoilProfile, rain_scale: float = 1.0) -> np.ndarray:
    """Fraction of available water already used at sowing, from a pre-season bucket model.

    Runs the ``sw.pre`` days before sowing over a 1 m profile under stubble (Kc 0.5),
    starting half full.  Returns values in 0..1 (0 = profile at field capacity).
    """
    taw = soil.awc * 1000.0 * SPINUP_PROFILE_M
    rain = np.nan_to_num(sw.data["rain"][:, : sw.pre], nan=0.0) * rain_scale
    et0 = np.nan_to_num(sw.data["et0"][:, : sw.pre], nan=0.0)
    dr = np.full(rain.shape[0], 0.5 * taw)
    for day in range(sw.pre):
        dr = np.maximum(dr - rain[:, day], 0.0)
        ks = np.where(dr <= 0.5 * taw, 1.0, np.maximum(taw - dr, 0.0) / (0.5 * taw))
        dr = np.minimum(dr + ks * SPINUP_KC * et0[:, day], taw)
    return dr / taw


def salinity_factor(crop: Crop, ec_ds_m: float | None) -> float:
    if ec_ds_m is None:
        return 1.0
    return float(np.clip(1.0 - SALINITY_SLOPE_PER_DS_M * max(ec_ds_m - crop.salinity_threshold_ds_m, 0.0), 0.0, 1.0))


def simulate(
    crop: Crop,
    sw: SeasonWeather,
    soil: SoilProfile,
    settings: SimSettings | None = None,
    initial_depletion: np.ndarray | None = None,
) -> SeasonResult:
    """Run one crop through every year of one season. All outputs have one value per year."""
    settings = settings or SimSettings()
    days = min(crop.duration_days, sw.length)
    truncated = crop.duration_days > sw.length
    n_years = len(sw.years)

    rain = np.nan_to_num(sw.after_sowing("rain")[:, :days], nan=0.0) * settings.rain_scale
    et0 = np.nan_to_num(sw.after_sowing("et0")[:, :days], nan=0.0)
    tmax = sw.after_sowing("tmax")[:, :days]
    tmin = sw.after_sowing("tmin")[:, :days]
    wind = sw.after_sowing("wind")[:, :days]

    kc = kc_curve(crop, days)
    zr = root_curve(crop, days)
    taw_day = soil.awc * 1000.0 * zr
    f0 = spinup_depletion(sw, soil, settings.rain_scale) if initial_depletion is None else initial_depletion

    irrigated = settings.water_source in ("supplemental", "irrigated")
    cap = settings.supplemental_cap_mm if settings.water_source == "supplemental" else np.inf
    perc = soil.paddy_percolation_mm_day

    dr = f0 * taw_day[0]
    eta_sum = np.zeros(n_years)
    etc_sum = np.zeros(n_years)
    irrigation = np.zeros(n_years)
    waterlog_days = np.zeros(n_years)

    for day in range(days):
        taw = taw_day[day]
        if day > 0 and taw > taw_day[day - 1]:
            # roots reach deeper soil that is as dry as the profile was at sowing
            dr = dr + (taw - taw_day[day - 1]) * f0
        etc = kc[day] * et0[:, day]
        p = np.clip(crop.depletion_p + 0.04 * (5.0 - etc), 0.1, 0.8)  # FAO-56 adjustment
        raw = p * taw

        dr = dr - rain[:, day]
        if crop.paddy:
            dr = np.maximum(dr, -PADDY_POND_MM)  # bund overflow
            ponded = np.maximum(-dr, 0.0)
            dr = dr + np.minimum(ponded, perc)  # seepage + percolation out of the pond
        else:
            excess = np.maximum(-dr, 0.0)
            waterlog_days += excess >= WATERLOG_EXCESS_MM
            dr = np.maximum(dr, 0.0)

        if irrigated:
            if crop.paddy:
                need = np.where(dr > 0.0, dr + PADDY_REFILL_MM, 0.0)
            else:
                need = np.where(dr > raw, dr, 0.0)
            applied = np.minimum(need, np.maximum(cap - irrigation, 0.0))
            irrigation += applied
            dr = dr - applied

        depleted = np.maximum(dr, 0.0)
        ks = np.where(depleted <= raw, 1.0, np.maximum(taw - depleted, 0.0) / np.maximum((1.0 - p) * taw, 1e-6))
        ks = np.clip(ks, 0.0, 1.0)
        eta = ks * etc
        dr = np.minimum(dr + eta, taw)
        eta_sum += eta
        etc_sum += etc

    satisfaction = np.where(etc_sum > 0, eta_sum / np.maximum(etc_sum, 1e-9), 1.0)
    f_water = np.clip(1.0 - crop.ky * (1.0 - satisfaction), 0.0, 1.0)

    # heat during mid-season (flowering / grain or fruit filling)
    _, mid_start, late_start = stage_bounds(crop, days)
    heat_days = np.nansum(tmax[:, mid_start:late_start] >= crop.heat_limit_c, axis=1).astype(float)
    f_heat = np.maximum(1.0 - HEAT_LOSS_PER_DAY * heat_days, HEAT_FLOOR)

    # waterlogging (never for paddy rice)
    sensitivity = WATERLOG_SENSITIVITY[crop.waterlogging_tolerance] * DRAINAGE_FACTOR[settings.drainage]
    f_wet = 1.0 - sensitivity * np.minimum(waterlog_days / WATERLOG_FULL_EFFECT_DAYS, 1.0)
    if crop.paddy:
        f_wet = np.ones(n_years)

    # destructive storms after establishment
    established = slice(min(10, days), days)
    storm = (rain[:, established] >= EXTREME_RAIN_MM) | (np.nan_to_num(wind[:, established], nan=0.0) >= EXTREME_WIND_MS)
    extreme_days = storm.sum(axis=1).astype(float)
    if crop.paddy:
        f_extreme = np.maximum(1.0 - EXTREME_LOSS_PER_DAY_PADDY * extreme_days, EXTREME_FLOOR_PADDY)
    else:
        f_extreme = np.maximum(1.0 - EXTREME_LOSS_PER_DAY * extreme_days, EXTREME_FLOOR)

    # thermal time available until the end of the season window
    tmean_window = sw.after_sowing("tmean")
    gdd = np.nansum(np.maximum(np.minimum(tmean_window, GDD_CAP_C) - crop.t_base_c, 0.0), axis=1)
    f_gdd = np.clip(gdd / crop.gdd_need, 0.0, 1.0) ** 2

    frost = np.nanmin(tmin, axis=1) < 0.0
    f_frost = np.where(frost & crop.frost_sensitive, FROST_FACTOR, 1.0)

    f_salt = salinity_factor(crop, soil.ec_ds_m)
    outcome = 100.0 * f_water * f_heat * f_wet * f_extreme * f_gdd * f_frost * f_salt
    return SeasonResult(
        crop_id=crop.id,
        season=sw.season,
        outcome=np.clip(outcome, 0.0, 100.0),
        water_satisfaction=np.clip(satisfaction, 0.0, 1.0),
        factors={
            "water": f_water,
            "heat": f_heat,
            "waterlogging": f_wet,
            "extreme_weather": f_extreme,
            "thermal_time": f_gdd,
            "frost": f_frost,
            "salinity": np.full(n_years, f_salt),
        },
        etc_mm=etc_sum,
        eta_mm=eta_sum,
        rain_mm=rain.sum(axis=1),
        irrigation_mm=irrigation,
        heat_days=heat_days,
        waterlog_days=waterlog_days,
        extreme_days=extreme_days,
        truncated=truncated,
    )


def classify(outcome: float) -> str:
    if outcome >= GOOD_OUTCOME:
        return "good"
    if outcome >= FAILED_OUTCOME:
        return "stressed"
    return "failed"
