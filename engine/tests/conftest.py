"""Shared fixtures. Everything is synthetic and deterministic - the tests never touch the network."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from fieldshift import config
from fieldshift.climate import prepare_weather
from fieldshift.context import build_context
from fieldshift.soil import build_profile
from fieldshift.sources import DiskCache, cache_key
from fieldshift.waterbalance import SimSettings

LAT, LON = 15.0, 121.0
DRY_YEARS = (1994, 1998, 2003, 2007)  # synthetic "El Nino" years: weak monsoon, dry off-season


def synthetic_power(start: str = "1991-01-01", end: str = "2012-12-31", seed: int = 7) -> pd.DataFrame:
    """A monsoon climate in NASA POWER column layout: wet May-Oct, dry Nov-Apr."""
    rng = np.random.default_rng(seed)
    index = pd.date_range(start, end, freq="D")
    doy = index.day_of_year.to_numpy()
    year = index.year.to_numpy()
    month = index.month.to_numpy()
    wet = (month >= 5) & (month <= 10)
    # rain: frequent in the wet season, rare in the dry season; dry years get much less
    factor = np.where(np.isin(year, DRY_YEARS) | np.isin(year - 1, DRY_YEARS) & (month <= 4), 0.35, 1.0)
    chance = np.where(wet, 0.55, 0.06) * np.clip(factor + 0.3, 0, 1)
    amount = rng.gamma(shape=0.9, scale=np.where(wet, 16.0, 7.0)) * factor
    rain = np.where(rng.random(len(index)) < chance, amount, 0.0)
    tmean = 27.0 + 2.0 * np.sin(2 * np.pi * (doy - 80) / 365.0) + rng.normal(0, 0.6, len(index))
    spread = np.where(wet, 6.0, 10.0)
    wetness = pd.Series(rain).rolling(45, min_periods=1).sum().to_numpy()
    gwet = np.clip(0.35 + wetness / 500.0, 0.2, 0.98)
    frame = pd.DataFrame(
        {
            "T2M": tmean,
            "T2M_MAX": tmean + spread / 2,
            "T2M_MIN": tmean - spread / 2,
            "PRECTOTCORR": rain,
            "GWETROOT": gwet,
            "GWETTOP": np.clip(gwet + rng.normal(0, 0.03, len(index)), 0.05, 1.0),
            "ALLSKY_SFC_SW_DWN": np.where(wet, 16.0, 21.0) + rng.normal(0, 1.5, len(index)),
            "RH2M": np.where(wet, 85.0, 68.0) + rng.normal(0, 3, len(index)),
            "WS2M": np.clip(1.5 + rng.normal(0, 0.4, len(index)), 0.3, None),
            "TS": tmean + np.where(wet, 0.2, 1.5),
        },
        index=index,
    )
    frame.index.name = "date"
    frame.attrs["meta"] = {"elevation_m": 50.0, "source": "power", "kind": "modelled", "origin": "synthetic"}
    return frame


@pytest.fixture(scope="session")
def power_frame() -> pd.DataFrame:
    return synthetic_power()


@pytest.fixture(scope="session")
def weather(power_frame):
    return prepare_weather(power_frame, LAT, LON)


@pytest.fixture(scope="session")
def loam_soil():
    return build_profile(None, {"texture": "loam", "soc_g_kg": 12.0, "bulk_density": 1.3, "ph": 6.3})


@pytest.fixture(scope="session")
def ctx(weather, loam_soil):
    return build_context(weather, loam_soil, SimSettings(water_source="rainfed", drainage="moderate"))


@pytest.fixture()
def data_dirs(tmp_path, monkeypatch, power_frame):
    """Temporary cache + snapshot folders holding only the synthetic POWER record, offline."""
    cache_dir, snapshot_dir = tmp_path / "cache", tmp_path / "snapshot"
    monkeypatch.setattr(config, "CACHE_DIR", cache_dir)
    monkeypatch.setattr(config, "SNAPSHOT_DIR", snapshot_dir)
    monkeypatch.setenv("FIELDSHIFT_OFFLINE", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    cache = DiskCache()
    meta = {"fetched_at": "2020-01-01T00:00:00+00:00", "elevation_m": 50.0}
    cache.write(cache_key("power", LAT, LON), power_frame, meta, snapshot=True)
    return cache
