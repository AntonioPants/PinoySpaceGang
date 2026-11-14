"""Reference evapotranspiration (ET0).

Primary method: FAO-56 Penman-Monteith (Allen et al. 1998, eq. 6) on daily data.
Fallback when humidity, wind or radiation is missing: Hargreaves-Samani (FAO-56 eq. 52).
All functions are vectorised over numpy arrays.
"""
from __future__ import annotations

import numpy as np

SIGMA = 4.903e-9  # Stefan-Boltzmann constant, MJ K-4 m-2 day-1
GSC = 0.0820  # solar constant, MJ m-2 min-1
ALBEDO = 0.23  # hypothetical grass reference crop


def saturation_vapour_pressure(temp_c):
    """e0(T) in kPa (FAO-56 eq. 11)."""
    temp_c = np.asarray(temp_c, dtype="float64")
    return 0.6108 * np.exp(17.27 * temp_c / (temp_c + 237.3))


def extraterrestrial_radiation(lat_deg: float, doy):
    """Ra in MJ m-2 day-1 (FAO-56 eq. 21)."""
    doy = np.asarray(doy, dtype="float64")
    phi = np.radians(lat_deg)
    dr = 1.0 + 0.033 * np.cos(2.0 * np.pi * doy / 365.0)
    delta = 0.409 * np.sin(2.0 * np.pi * doy / 365.0 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1.0, 1.0))
    ra = (24.0 * 60.0 / np.pi) * GSC * dr * (
        ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws)
    )
    return np.maximum(ra, 0.0)


def hargreaves(tmax, tmin, ra):
    """ET0 in mm/day from temperature only (FAO-56 eq. 52)."""
    tmax, tmin, ra = (np.asarray(x, dtype="float64") for x in (tmax, tmin, ra))
    tmean = (tmax + tmin) / 2.0
    spread = np.sqrt(np.maximum(tmax - tmin, 0.0))
    return np.maximum(0.0023 * (tmean + 17.8) * spread * 0.408 * ra, 0.0)


def penman_monteith(tmax, tmin, rh_mean, wind_2m, rs, lat_deg: float, elevation_m: float, doy):
    """FAO-56 Penman-Monteith ET0 in mm/day.

    tmax, tmin   daily max / min air temperature at 2 m (deg C)
    rh_mean      daily mean relative humidity (%)
    wind_2m      wind speed at 2 m (m/s)
    rs           incoming shortwave radiation (MJ m-2 day-1)
    """
    tmax, tmin, rh_mean, wind_2m, rs = (
        np.asarray(x, dtype="float64") for x in (tmax, tmin, rh_mean, wind_2m, rs)
    )
    tmean = (tmax + tmin) / 2.0
    pressure = 101.3 * ((293.0 - 0.0065 * elevation_m) / 293.0) ** 5.26
    gamma = 0.000665 * pressure
    es = (saturation_vapour_pressure(tmax) + saturation_vapour_pressure(tmin)) / 2.0
    ea = np.clip(rh_mean, 0.0, 100.0) / 100.0 * es  # FAO-56 eq. 19 (mean RH)
    delta = 4098.0 * saturation_vapour_pressure(tmean) / (tmean + 237.3) ** 2

    ra = extraterrestrial_radiation(lat_deg, doy)
    rso = (0.75 + 2e-5 * elevation_m) * ra
    with np.errstate(divide="ignore", invalid="ignore"):
        rel = np.where(rso > 0, np.clip(rs / rso, 0.0, 1.0), 0.0)
    rns = (1.0 - ALBEDO) * rs
    rnl = (
        SIGMA
        * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4)
        / 2.0
        * (0.34 - 0.14 * np.sqrt(np.maximum(ea, 0.0)))
        * (1.35 * rel - 0.35)
    )
    rn = rns - rnl
    numerator = 0.408 * delta * rn + gamma * (900.0 / (tmean + 273.0)) * wind_2m * (es - ea)
    denominator = delta + gamma * (1.0 + 0.34 * wind_2m)
    return np.maximum(numerator / denominator, 0.0)


def daily_et0(df, lat_deg: float, elevation_m: float):
    """ET0 series for a POWER-style daily frame.

    Returns (et0 array, method array) where method is "pm", "hargreaves" or "" (not computable).
    Hargreaves is used only on days where humidity, wind or radiation is missing; the caller
    reports how many days that was.
    """
    doy = df.index.day_of_year.to_numpy()
    tmax = df["T2M_MAX"].to_numpy(dtype="float64")
    tmin = df["T2M_MIN"].to_numpy(dtype="float64")
    ra = extraterrestrial_radiation(lat_deg, doy)

    def col(name):
        return df[name].to_numpy(dtype="float64") if name in df else np.full(len(df), np.nan)

    rh, wind, rs = col("RH2M"), col("WS2M"), col("ALLSKY_SFC_SW_DWN")
    have_temp = ~np.isnan(tmax) & ~np.isnan(tmin)
    have_all = have_temp & ~np.isnan(rh) & ~np.isnan(wind) & ~np.isnan(rs)

    et0 = np.full(len(df), np.nan)
    method = np.full(len(df), "", dtype=object)
    if have_all.any():
        et0[have_all] = penman_monteith(
            tmax[have_all], tmin[have_all], rh[have_all], wind[have_all], rs[have_all],
            lat_deg, elevation_m, doy[have_all],
        )
        method[have_all] = "pm"
    fallback = have_temp & ~have_all
    if fallback.any():
        et0[fallback] = hargreaves(tmax[fallback], tmin[fallback], ra[fallback])
        method[fallback] = "hargreaves"
    return et0, method
