"""ET0, season calendar, climate indicators, soil texture and the data-source layer."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from fieldshift import config
from fieldshift.climate import (
    climate_summary,
    detect_season_plan,
    extraterrestrial_radiation,
    hargreaves,
    longest_run,
    penman_monteith,
    prepare_weather,
    season_matrix,
    trend,
)
from fieldshift.soil import build_profile, texture_class
from fieldshift.sources import DiskCache, PowerSource, SoilGridsSource, SourceUnavailable, cache_key, try_fetch
from fieldshift.sources.modis import parse_subset
from fieldshift.sources.power import parse_power_json
from fieldshift.sources.soilgrids import parse_soilgrids_json

from .conftest import LAT, LON, synthetic_power


# ---- ET0 ---------------------------------------------------------------------------------------
def test_extraterrestrial_radiation_matches_fao56_example():
    # FAO-56 example 8: 20 deg S on 3 September (day 246) -> Ra = 32.2 MJ/m2/day
    assert extraterrestrial_radiation(-20.0, 246) == pytest.approx(32.2, abs=0.2)


def test_penman_monteith_close_to_fao56_example_18():
    # Brussels, 6 July: Tmax 21.5, Tmin 12.3, RH 84/63 %, u2 2.078 m/s, Rs 22.07 -> ET0 = 3.9 mm/day
    et0 = penman_monteith(21.5, 12.3, 73.5, 2.078, 22.07, 50.8, 100.0, 187)
    assert float(et0) == pytest.approx(3.9, abs=0.3)


def test_hargreaves_is_positive_and_grows_with_temperature():
    ra = extraterrestrial_radiation(15.0, 100)
    cool, hot = hargreaves(25.0, 15.0, ra), hargreaves(38.0, 24.0, ra)
    assert 0 < float(cool) < float(hot)


def test_et0_falls_back_to_hargreaves_only_where_inputs_are_missing():
    frame = synthetic_power(end="1991-03-31")
    frame.iloc[10:13, frame.columns.get_loc("RH2M")] = np.nan
    weather = prepare_weather(frame, LAT, LON)
    assert weather.quality["et0_hargreaves_days"] == 3
    assert weather.quality["et0_penman_monteith_days"] == len(frame) - 3
    assert weather.daily["et0"].notna().all()


def test_gap_filling_is_counted_not_silent():
    frame = synthetic_power(end="1991-03-31")
    frame.iloc[20:22, frame.columns.get_loc("PRECTOTCORR")] = np.nan  # short gap: bridged and counted
    frame.iloc[40:60, frame.columns.get_loc("T2M_MAX")] = np.nan  # long gap: left missing
    weather = prepare_weather(frame, LAT, LON)
    assert weather.quality["gap_filled_values"]["rain"] == 2
    assert weather.quality["still_missing_values"]["tmax"] == 20


# ---- season calendar and indicators ------------------------------------------------------------
def test_season_plan_finds_the_wet_season(weather):
    plan = detect_season_plan(weather)
    assert plan.regime == "rainfall"
    assert plan.main_start_month == 5
    assert plan.months("main") == [5, 6, 7, 8, 9, 10]
    assert plan.months("off") == [11, 12, 1, 2, 3, 4]
    assert plan.kind("main") == "wet" and plan.kind("off") == "dry"
    assert plan.length_days("main") + plan.sow_offset("main") == 184


def test_thermal_regime_for_a_temperate_climate():
    frame = synthetic_power(end="1996-12-31")
    doy = frame.index.day_of_year.to_numpy()
    seasonal = 10.0 + 12.0 * np.sin(2 * np.pi * (doy - 110) / 365.0)
    for column in ("T2M", "T2M_MAX", "T2M_MIN", "TS"):
        frame[column] = seasonal + (5 if column == "T2M_MAX" else -5 if column == "T2M_MIN" else 0)
    plan = detect_season_plan(prepare_weather(frame, 45.0, 10.0))
    assert plan.regime == "thermal"
    assert plan.kind("main") == "warm"


def test_season_matrix_excludes_incomplete_years(weather):
    plan = detect_season_plan(weather)
    main, off = season_matrix(weather, plan, "main"), season_matrix(weather, plan, "off")
    assert main.valid.all()
    assert not off.valid[-1]  # the last off-season runs past the end of the record
    assert main.data["rain"].shape == (len(main.years), main.pre + main.length)


def test_longest_run_and_trend():
    mask = np.array([[True, True, False, True, True, True], [False, False, False, False, False, False]])
    assert longest_run(mask).tolist() == [3, 0]
    years = np.arange(1991, 2021)
    rising = trend(years, 20.0 + 0.05 * (years - 1991))
    assert rising["significant"] and rising["slope_per_decade"] == pytest.approx(0.5, abs=0.01)
    noise = trend(years, np.random.default_rng(1).normal(0, 1, len(years)))
    assert not noise["significant"]
    assert trend(years[:5], np.arange(5.0)) is None


def test_climate_summary_contents(weather):
    out = climate_summary(weather, detect_season_plan(weather))
    wet, dry = out["seasons"]["main"], out["seasons"]["off"]
    assert wet["mean"]["rain_mm"] > 5 * dry["mean"]["rain_mm"]
    assert dry["mean"]["dry_spell_days"] > wet["mean"]["dry_spell_days"]
    assert out["frost"]["frost_free"] is True
    assert len(out["monthly_climatology"]) == 12
    assert {"rain_mm", "gdd", "heat_days", "water_balance_mm"} <= set(wet["trend"])
    dry_year = next(r for r in dry["yearly"] if r["year"] == 1994)
    normal = next(r for r in dry["yearly"] if r["year"] == 1995)
    assert dry_year["rain_mm"] < normal["rain_mm"]


# ---- soil --------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    "sand,silt,clay,expected",
    [
        (92, 5, 3, "sand"),
        (65, 25, 10, "sandy loam"),
        (40, 40, 20, "loam"),
        (20, 65, 15, "silt loam"),
        (15.5, 43.4, 41.2, "silty clay"),
        (30, 35, 35, "clay loam"),
        (20, 20, 60, "clay"),
        (60, 12, 28, "sandy clay loam"),
    ],
)
def test_texture_triangle(sand, silt, clay, expected):
    assert texture_class(sand, silt, clay) == expected


def test_farmer_values_override_the_map_and_are_labelled():
    grid = pd.DataFrame([{"ph": 6.4, "soc_g_kg": 14.0, "clay_pct": 41.0, "sand_pct": 15.0, "silt_pct": 44.0}])
    profile = build_profile(grid, {"ph": 5.5, "ec_ds_m": 3.0})
    assert profile.ph == 5.5 and profile.provenance["ph"] == "farmer-entered"
    assert profile.soc_g_kg == 14.0 and profile.provenance["soc_g_kg"] == "modelled"
    assert profile.texture == "silty clay" and profile.provenance["texture"] == "modelled"
    assert profile.provenance["nitrogen_g_kg"] == "unavailable"
    assert profile.ec_ds_m == 3.0


def test_missing_soil_is_flagged_as_assumed_not_invented():
    profile = build_profile(None, {})
    assert profile.provenance["texture"] == "assumed"
    assert profile.soc_g_kg is None and profile.soc_stock_t_ha is None


# ---- sources -----------------------------------------------------------------------------------
def test_power_parser_turns_fill_values_into_nan():
    payload = {
        "geometry": {"coordinates": [121.0, 15.0, 42.0]},
        "header": {"fill_value": -999.0},
        "parameters": {"T2M": {"units": "C"}},
        "properties": {"parameter": {"T2M": {"20240101": 25.0, "20240102": -999.0, "20240103": 26.0, "20240104": -999.0}}},
    }
    frame, extra = parse_power_json(payload)
    assert extra["elevation_m"] == 42.0
    assert len(frame) == 3  # the trailing unpublished day is dropped
    assert np.isnan(frame["T2M"].iloc[1])


def test_soilgrids_parser_depth_weights_and_converts_units():
    def layer(name, d_factor, values):
        depths = [{"label": lbl, "values": {"mean": v}} for lbl, v in zip(("0-5cm", "5-15cm", "15-30cm"), values)]
        return {"name": name, "unit_measure": {"d_factor": d_factor}, "depths": depths}

    payload = {"properties": {"layers": [
        layer("phh2o", 10, (63, 64, 65)), layer("clay", 10, (300, 300, 300)),
        layer("sand", 10, (400, 400, 400)), layer("silt", 10, (300, 300, 300)),
    ]}}
    frame, _ = parse_soilgrids_json(payload)
    assert frame["ph"].iloc[0] == pytest.approx((6.3 * 5 + 6.4 * 10 + 6.5 * 15) / 30, abs=0.001)
    assert frame["clay_pct"].iloc[0] == 30.0
    with pytest.raises(SourceUnavailable):
        parse_soilgrids_json({"properties": {"layers": [layer("phh2o", 10, (None, None, None))]}})


def test_modis_parser_drops_fill_values():
    rows = parse_subset({"scale": "0.0001", "subset": [{"calendar_date": "2020-01-01", "data": [5000, 6000, -3000, 7000, 8000]}]})
    assert rows[0]["ndvi"] == pytest.approx(0.65)
    assert rows[0]["valid_frac"] == 0.8


def test_offline_source_uses_snapshot_or_reports_unavailable(data_dirs):
    frame = PowerSource(data_dirs).fetch(LAT, LON)
    assert frame.attrs["meta"]["origin"] == "snapshot"
    missing, meta = try_fetch(SoilGridsSource(data_dirs), LAT, LON)
    assert missing is None and meta["available"] is False and "offline" in meta["reason"]


def test_failed_refresh_keeps_stale_cache_and_says_so(tmp_path, monkeypatch, power_frame):
    monkeypatch.setattr(config, "CACHE_DIR", tmp_path / "c")
    monkeypatch.setattr(config, "SNAPSHOT_DIR", tmp_path / "s")
    monkeypatch.delenv("FIELDSHIFT_OFFLINE", raising=False)
    cache = DiskCache()
    cache.write(cache_key("power", LAT, LON), power_frame, {"fetched_at": "2001-01-01T00:00:00+00:00"})

    class Broken(PowerSource):
        def _download(self, lat, lon, cached):
            raise SourceUnavailable("service down")

    frame = Broken(cache).fetch(LAT, LON)
    meta = frame.attrs["meta"]
    assert meta["stale"] is True and meta["refresh_error"] == "service down" and len(frame) == len(power_frame)
    with pytest.raises(SourceUnavailable):
        Broken(cache).fetch(LAT + 5, LON)  # nothing cached there: unavailable, never invented
