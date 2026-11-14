"""Pluggable data-source contract + on-disk cache.

Every source implements ``fetch(lat, lon, start, end) -> DataFrame``.  The returned frame is
indexed by date and carries provenance in ``df.attrs["meta"]`` so that every number shown in
the UI can be labelled (source, resolution, date range, observed / modelled, live / cached).

Rules that all sources follow:
* every successful response is cached to ``data/cache``;
* ``data/snapshot`` holds a pre-fetched copy for the pilot farm so the demo runs offline;
* when a source fails and there is no cached copy, ``SourceUnavailable`` is raised and the
  caller reports "unavailable" - data is never invented or silently filled in.
"""
from __future__ import annotations

import json
import threading
from abc import ABC, abstractmethod
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from .. import config


class SourceUnavailable(Exception):
    """Raised when a source cannot provide data (network error, no credentials, offline...)."""

    def __init__(self, message: str, *, pending: bool = False):
        super().__init__(message)
        self.pending = pending  # True when a remote job was submitted and is still processing


def cache_key(source: str, lat: float, lon: float) -> str:
    """Cache key at ~1 km precision (2 decimals); finer than every source's native grid."""
    return f"{source}__{lat:.2f}_{lon:.2f}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DiskCache:
    """CSV(.gz) + JSON side-car cache. Reads fall back to the committed snapshot folder."""

    def __init__(self, cache_dir: Path | None = None, snapshot_dir: Path | None = None):
        self.cache_dir = Path(cache_dir) if cache_dir else config.CACHE_DIR
        self.snapshot_dir = Path(snapshot_dir) if snapshot_dir else config.SNAPSHOT_DIR
        self._lock = threading.Lock()

    def _paths(self, folder: Path, key: str) -> tuple[Path, Path]:
        return folder / f"{key}.csv.gz", folder / f"{key}.meta.json"

    def read(self, key: str) -> tuple[pd.DataFrame, dict, str] | None:
        """Return (frame, meta, origin) where origin is "cache" or "snapshot"; None if absent."""
        for origin, folder in (("cache", self.cache_dir), ("snapshot", self.snapshot_dir)):
            data_path, meta_path = self._paths(folder, key)
            if data_path.exists() and meta_path.exists():
                try:
                    df = pd.read_csv(data_path, index_col=0, parse_dates=True)
                    meta = json.loads(meta_path.read_text(encoding="utf-8"))
                    return df, meta, origin
                except Exception:
                    continue  # corrupt cache entry: ignore it and try the next location
        return None

    def write(self, key: str, df: pd.DataFrame, meta: dict, *, snapshot: bool = False) -> None:
        folder = self.snapshot_dir if snapshot else self.cache_dir
        folder.mkdir(parents=True, exist_ok=True)
        data_path, meta_path = self._paths(folder, key)
        with self._lock:
            df.to_csv(data_path, compression="gzip", float_format="%.5g")
            meta_path.write_text(json.dumps(meta, indent=1, default=str), encoding="utf-8")


def age_hours(meta: dict) -> float:
    try:
        fetched = datetime.fromisoformat(meta["fetched_at"])
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=timezone.utc)
        return (_utcnow() - fetched).total_seconds() / 3600.0
    except Exception:
        return float("inf")


class Source(ABC):
    """Base class for all data sources."""

    name: str = "source"  # short id used in cache keys and API payloads
    title: str = "Source"
    provider: str = ""
    kind: str = "modelled"  # "observed" (satellite retrieval) or "modelled" (reanalysis / ML map)
    resolution: str = ""
    url: str = ""
    needs_credentials: bool = False
    max_age_hours: float = 24.0  # cache entries older than this are refreshed when online

    def __init__(self, cache: DiskCache | None = None):
        self.cache = cache or DiskCache()

    # -- to implement ---------------------------------------------------------------------
    @abstractmethod
    def _download(
        self, lat: float, lon: float, cached: tuple[pd.DataFrame, dict] | None
    ) -> tuple[pd.DataFrame, dict]:
        """Download the full record for a point. Return (frame indexed by date, extra meta).

        ``cached`` is the existing (possibly stale) cache entry so a source can update
        incrementally.  Raise ``SourceUnavailable`` on any failure.
        """

    def credentials_configured(self) -> bool:
        return True

    # -- public API -----------------------------------------------------------------------
    def fetch(
        self,
        lat: float,
        lon: float,
        start: date | str | None = None,
        end: date | str | None = None,
        *,
        allow_network: bool = True,
    ) -> pd.DataFrame:
        key = cache_key(self.name, lat, lon)
        hit = self.cache.read(key)
        can_fetch = allow_network and not config.offline()

        if hit is not None:
            df, meta, origin = hit
            fresh = age_hours(meta) <= self.max_age_hours
            if fresh or not can_fetch:
                return self._finish(df, meta, origin, start, end, stale=not fresh)
        if not can_fetch:
            raise SourceUnavailable(
                f"{self.title}: offline mode and no cached or snapshot copy for this location"
            )
        try:
            df, extra = self._download(lat, lon, (hit[0], hit[1]) if hit else None)
            if df is None or df.empty:
                raise SourceUnavailable(f"{self.title}: the service returned no data for this location")
        except SourceUnavailable as exc:
            if hit is not None:
                df, meta, origin = hit
                meta = {**meta, "refresh_error": str(exc)}
                return self._finish(df, meta, origin, start, end, stale=True)
            raise
        except Exception as exc:  # network / parsing problems
            if hit is not None:
                df, meta, origin = hit
                meta = {**meta, "refresh_error": f"{type(exc).__name__}: {exc}"}
                return self._finish(df, meta, origin, start, end, stale=True)
            raise SourceUnavailable(f"{self.title}: {type(exc).__name__}: {exc}") from exc

        meta = {
            "source": self.name,
            "title": self.title,
            "provider": self.provider,
            "kind": self.kind,
            "resolution": self.resolution,
            "url": self.url,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "fetched_at": _utcnow().isoformat(timespec="seconds"),
            **(extra or {}),
        }
        self.cache.write(key, df, meta)
        return self._finish(df, meta, "live", start, end, stale=False)

    def _finish(
        self,
        df: pd.DataFrame,
        meta: dict,
        origin: str,
        start: date | str | None,
        end: date | str | None,
        *,
        stale: bool,
    ) -> pd.DataFrame:
        df = df.sort_index()
        if start is not None:
            df = df[df.index >= pd.Timestamp(start)]
        if end is not None:
            df = df[df.index <= pd.Timestamp(end)]
        out_meta: dict[str, Any] = {
            "source": self.name,
            "title": self.title,
            "provider": self.provider,
            "kind": self.kind,
            "resolution": self.resolution,
            "url": self.url,
            **meta,
            "origin": origin,  # live | cache | snapshot
            "stale": bool(stale),
            "date_start": df.index.min().date().isoformat() if len(df) else None,
            "date_end": df.index.max().date().isoformat() if len(df) else None,
            "rows": int(len(df)),
        }
        df = df.copy()
        df.attrs["meta"] = out_meta
        return df

    def describe(self) -> dict:
        """Static description used by /api/health and the data & confidence page."""
        return {
            "source": self.name,
            "title": self.title,
            "provider": self.provider,
            "kind": self.kind,
            "resolution": self.resolution,
            "url": self.url,
            "needs_credentials": self.needs_credentials,
            "credentials_configured": self.credentials_configured(),
        }


def unavailable_meta(source: Source, reason: str, *, pending: bool = False) -> dict:
    """Provenance record for a source that could not be used."""
    return {
        **source.describe(),
        "origin": "unavailable",
        "available": False,
        "pending": pending,
        "reason": reason,
    }


def yesterday() -> date:
    return date.today() - timedelta(days=1)
