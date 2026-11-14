"""Data sources. Each one is a pluggable ``Source`` with ``fetch(lat, lon, start, end)``."""
from __future__ import annotations

import pandas as pd

from .base import DiskCache, Source, SourceUnavailable, cache_key, unavailable_meta
from .ecostress import EcostressSource
from .modis import ModisNdviSource
from .power import PowerSource
from .smap import SmapSource
from .soilgrids import SoilGridsSource

__all__ = [
    "DiskCache",
    "Source",
    "SourceUnavailable",
    "cache_key",
    "PowerSource",
    "SmapSource",
    "EcostressSource",
    "ModisNdviSource",
    "SoilGridsSource",
    "all_sources",
    "try_fetch",
]


def all_sources(cache: DiskCache | None = None) -> dict[str, Source]:
    cache = cache or DiskCache()
    sources: list[Source] = [
        PowerSource(cache),
        SmapSource(cache),
        EcostressSource(cache),
        ModisNdviSource(cache),
        SoilGridsSource(cache),
    ]
    return {s.name: s for s in sources}


def try_fetch(source: Source, lat: float, lon: float, **kwargs) -> tuple[pd.DataFrame | None, dict]:
    """Fetch without raising: returns (frame or None, provenance meta).

    A failed source yields ``None`` plus a meta record with ``available: False`` and the
    reason, so callers can show "unavailable" instead of inventing values.
    """
    try:
        df = source.fetch(lat, lon, **kwargs)
        meta = dict(df.attrs.get("meta", {}))
        meta["available"] = True
        return df, meta
    except SourceUnavailable as exc:
        return None, unavailable_meta(source, str(exc), pending=exc.pending)
