"""Central configuration. Everything is overridable through environment variables / .env."""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path

try:  # .env is optional; the engine runs without it
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except Exception:  # pragma: no cover - dotenv missing is not fatal
    pass

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("FIELDSHIFT_DATA_DIR", REPO_ROOT / "data"))
CACHE_DIR = DATA_DIR / "cache"
SNAPSHOT_DIR = DATA_DIR / "snapshot"

# First year of the historical record used by the replay ("time machine").
RECORD_START = date(1991, 1, 1)

# Pilot farm: rain-fed lowland farm near the Science City of Munoz, Nueva Ecija (Central Luzon).
PILOT = {
    "name": "Pilot farm, Munoz, Nueva Ecija (Central Luzon, Philippines)",
    "lat": 15.72,
    "lon": 120.90,
}

# Area unit used when reporting irrigation volumes (m3 per <unit>).
AREA_UNIT = "ha"


def offline() -> bool:
    """When true, no network calls are made: only data/cache and data/snapshot are read."""
    return os.getenv("FIELDSHIFT_OFFLINE", "0").strip().lower() in {"1", "true", "yes", "on"}


def env(name: str) -> str | None:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else None
