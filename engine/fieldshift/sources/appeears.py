"""Minimal client for NASA AppEEARS point-sample requests (used for SMAP and ECOSTRESS).

AppEEARS jobs are asynchronous: a request is submitted, processed on the NASA side (minutes
to hours) and then downloaded.  The engine therefore never blocks on it: the first call
submits the job and reports "pending"; later calls poll and, once done, download + cache.

Credentials (never committed - see .env.example):
  EARTHDATA_USERNAME + EARTHDATA_PASSWORD   -> exchanged for an AppEEARS token, or
  APPEEARS_TOKEN / EARTHDATA_TOKEN          -> used directly as a bearer token.

NOTE: this path could not be exercised without credentials during development; the request
shapes follow the public AppEEARS API documentation (https://appeears.earthdatacloud.nasa.gov/api/).
"""
from __future__ import annotations

import io
import json
import threading
from datetime import date, datetime, timezone

import httpx
import pandas as pd

from .. import config
from .base import SourceUnavailable

API = "https://appeears.earthdatacloud.nasa.gov/api"
_LOCK = threading.Lock()


class AppeearsClient:
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._token: str | None = None

    # -- credentials ------------------------------------------------------------------------
    @staticmethod
    def configured() -> bool:
        return bool(
            config.env("APPEEARS_TOKEN")
            or config.env("EARTHDATA_TOKEN")
            or (config.env("EARTHDATA_USERNAME") and config.env("EARTHDATA_PASSWORD"))
        )

    def _bearer(self) -> str:
        if self._token:
            return self._token
        direct = config.env("APPEEARS_TOKEN") or config.env("EARTHDATA_TOKEN")
        user, password = config.env("EARTHDATA_USERNAME"), config.env("EARTHDATA_PASSWORD")
        if user and password:
            try:
                resp = httpx.post(f"{API}/login", auth=(user, password), timeout=self.timeout)
            except httpx.HTTPError as exc:
                raise SourceUnavailable(f"AppEEARS login failed: {type(exc).__name__}") from exc
            if resp.status_code != 200:
                raise SourceUnavailable(f"AppEEARS login rejected (HTTP {resp.status_code}); check .env")
            self._token = resp.json().get("token")
        elif direct:
            self._token = direct
        if not self._token:
            raise SourceUnavailable("no Earthdata credentials configured in .env")
        return self._token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._bearer()}"}

    # -- task bookkeeping -------------------------------------------------------------------
    @staticmethod
    def _store_path():
        return config.CACHE_DIR / "appeears_tasks.json"

    def _load_tasks(self) -> dict:
        path = self._store_path()
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                return {}
        return {}

    def _save_tasks(self, tasks: dict) -> None:
        path = self._store_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(tasks, indent=1), encoding="utf-8")

    # -- API calls --------------------------------------------------------------------------
    def _submit(self, name: str, lat: float, lon: float, layers: list[dict], start: date, end: date) -> str:
        body = {
            "task_type": "point",
            "task_name": name,
            "params": {
                "dates": [{"startDate": start.strftime("%m-%d-%Y"), "endDate": end.strftime("%m-%d-%Y")}],
                "layers": layers,
                "coordinates": [{"id": "field", "category": "field", "latitude": lat, "longitude": lon}],
            },
        }
        try:
            resp = httpx.post(f"{API}/task", json=body, headers=self._headers(), timeout=self.timeout)
        except httpx.HTTPError as exc:
            raise SourceUnavailable(f"AppEEARS submit failed: {type(exc).__name__}") from exc
        if resp.status_code in (401, 403):
            raise SourceUnavailable(f"AppEEARS rejected the credentials in .env (HTTP {resp.status_code})")
        if resp.status_code not in (200, 202):
            raise SourceUnavailable(f"AppEEARS submit returned HTTP {resp.status_code}: {resp.text[:160]}")
        return resp.json()["task_id"]

    def _status(self, task_id: str) -> str:
        try:
            resp = httpx.get(f"{API}/task/{task_id}", headers=self._headers(), timeout=self.timeout)
        except httpx.HTTPError as exc:
            raise SourceUnavailable(f"AppEEARS status check failed: {type(exc).__name__}") from exc
        if resp.status_code != 200:
            raise SourceUnavailable(f"AppEEARS status returned HTTP {resp.status_code}")
        return str(resp.json().get("status", "unknown"))

    def _results_csv(self, task_id: str) -> pd.DataFrame:
        try:
            listing = httpx.get(f"{API}/bundle/{task_id}", headers=self._headers(), timeout=self.timeout)
            listing.raise_for_status()
            files = [
                f for f in listing.json().get("files", []) if str(f.get("file_name", "")).endswith("results.csv")
            ]
            if not files:
                raise SourceUnavailable("AppEEARS job finished but produced no results file")
            frames = []
            for f in files:
                data = httpx.get(
                    f"{API}/bundle/{task_id}/{f['file_id']}",
                    headers=self._headers(),
                    timeout=120.0,
                    follow_redirects=True,
                )
                data.raise_for_status()
                frames.append(pd.read_csv(io.StringIO(data.text)))
            return pd.concat(frames, ignore_index=True)
        except httpx.HTTPError as exc:
            raise SourceUnavailable(f"AppEEARS download failed: {type(exc).__name__}") from exc

    def point_series(
        self, key: str, lat: float, lon: float, layers: list[dict], start: date, end: date
    ) -> pd.DataFrame:
        """Submit-or-poll. Returns the raw results table, or raises SourceUnavailable(pending=True)."""
        if not self.configured():
            raise SourceUnavailable("no Earthdata credentials configured in .env")
        with _LOCK:
            tasks = self._load_tasks()
            entry = tasks.get(key)
            if entry is None:
                task_id = self._submit(key.replace(".", "_")[:60], lat, lon, layers, start, end)
                tasks[key] = {"task_id": task_id, "submitted_at": datetime.now(timezone.utc).isoformat()}
                self._save_tasks(tasks)
                raise SourceUnavailable(
                    "AppEEARS job submitted to NASA; results are usually ready within an hour", pending=True
                )
            status = self._status(entry["task_id"])
            if status == "done":
                table = self._results_csv(entry["task_id"])
                tasks.pop(key, None)
                self._save_tasks(tasks)
                return table
            if status in {"error", "deleted", "expired"}:
                tasks.pop(key, None)
                self._save_tasks(tasks)
                raise SourceUnavailable(f"AppEEARS job ended with status {status!r}")
            raise SourceUnavailable(f"AppEEARS job is still {status} on the NASA side", pending=True)


def find_column(table: pd.DataFrame, suffix: str) -> str | None:
    """AppEEARS names value columns <PRODUCT>_<VERSION>_<LAYER>; match on the layer suffix."""
    for col in table.columns:
        if col.endswith(suffix):
            return col
    return None
