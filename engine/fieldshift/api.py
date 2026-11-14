"""FastAPI application.  Run with:  uvicorn fieldshift.api:app --port 8000

Interactive docs: http://localhost:8000/docs      OpenAPI schema: /openapi.json
"""
from __future__ import annotations

import threading
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import __version__, advisor, config
from .backtest import run_backtest
from .climate import climate_summary, detect_season_plan, prepare_weather
from .context import NotEnoughData
from .crops import kb_meta, load_crops, references
from .drought import field_memory, flash_drought
from .i18n import LANGUAGES, t
from .models import AdvisorRequest, AdvisorResponse, Lang, PlanRequest, PlanResponse
from .planner import PlanError, load_site_data, make_plan, recall_plan
from .soil import AVAILABLE_WATER, build_profile
from .sources import DiskCache, SourceUnavailable, all_sources, cache_key, try_fetch
from .sources import modis as modis_source

app = FastAPI(
    title="Field Shift engine",
    version=__version__,
    description="Decision support for crop rotations from NASA Earth observations. "
    "Scores are relative comparisons, never yield or profit predictions.",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

Lat = Query(..., ge=-60, le=75, description="Latitude in decimal degrees")
Lon = Query(..., ge=-180, le=180, description="Longitude in decimal degrees")

_JOBS: dict[str, dict] = {}  # background MODIS downloads
_JOBS_LOCK = threading.Lock()


def _weather(lat: float, lon: float):
    try:
        power = all_sources()["power"].fetch(lat, lon)
    except SourceUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"Weather data unavailable: {exc}") from exc
    return prepare_weather(power, lat, lon), {**power.attrs["meta"], "available": True}


# ---- health / config --------------------------------------------------------------------------
@app.get("/api/health", tags=["status"])
def health(
    lat: float | None = Query(None, ge=-60, le=75),
    lon: float | None = Query(None, ge=-180, le=180),
    probe: bool = Query(False, description="Also make a live request to each open data service (slow)"),
) -> dict[str, Any]:
    """Status of every data source: configured, cached for this point, and (optionally) reachable."""
    lat = config.PILOT["lat"] if lat is None else lat
    lon = config.PILOT["lon"] if lon is None else lon
    cache = DiskCache()
    rows = []
    for name, source in all_sources(cache).items():
        row = source.describe()
        hit = cache.read(cache_key(name, lat, lon))
        row["cached"] = hit is not None
        row["cache_origin"] = hit[2] if hit else None
        row["cache_fetched_at"] = hit[1].get("fetched_at") if hit else None
        if source.needs_credentials and not row["credentials_configured"]:
            row["status"] = "cached" if hit else "unavailable"
            row["detail"] = "no Earthdata credentials in .env (optional source; the engine falls back to NASA POWER)"
        elif config.offline():
            row["status"] = "cached" if hit else "unavailable"
            row["detail"] = "offline mode: only cached / snapshot data is used"
        else:
            row["status"] = "cached" if hit else "ready"
            row["detail"] = "will be fetched on first use" if not hit else "served from cache; refreshed when stale"
        rows.append(row)
    if probe and not config.offline():
        checks = {
            "power": "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=AG&latitude=0&longitude=0&start=20200101&end=20200102&format=JSON",
            "soilgrids": "https://rest.isric.org/soilgrids/v2.0/docs",
            "modis_ndvi": "https://modis.ornl.gov/rst/api/v1/products",
            "smap_l4": "https://appeears.earthdatacloud.nasa.gov/api/product/SPL4SMGP.008",
            "ecostress": "https://appeears.earthdatacloud.nasa.gov/api/product/ECO_L4T_ESI.002",
        }
        for row in rows:
            try:
                resp = httpx.get(checks[row["source"]], timeout=20.0, headers={"Accept": "application/json"})
                row["reachable"] = resp.status_code < 500
                row["probe_http_status"] = resp.status_code
            except httpx.HTTPError as exc:
                row["reachable"] = False
                row["probe_error"] = type(exc).__name__
    return {
        "status": "ok",
        "version": __version__,
        "offline": config.offline(),
        "location": {"lat": lat, "lon": lon},
        "sources": rows,
        "advisor": {"mode": "llm" if advisor.llm_available() else "rules", "model": (config.env("ADVISOR_MODEL") or advisor.DEFAULT_MODEL) if advisor.llm_available() else None},
    }


@app.get("/api/config", tags=["status"])
def app_config() -> dict[str, Any]:
    return {
        "pilot": config.PILOT,
        "languages": list(LANGUAGES),
        "area_unit": config.AREA_UNIT,
        "record_start": config.RECORD_START.isoformat(),
        "offline": config.offline(),
        "textures": sorted(AVAILABLE_WATER),
        "advisor_mode": "llm" if advisor.llm_available() else "rules",
    }


@app.get("/api/crops", tags=["knowledge base"])
def crops() -> dict[str, Any]:
    """The crop knowledge base, with the source of every value."""
    return {"meta": kb_meta(), "references": references(), "crops": [c.public() for c in load_crops().values()]}


# ---- data endpoints ---------------------------------------------------------------------------
@app.get("/api/climate", tags=["data"])
def climate(lat: float = Lat, lon: float = Lon) -> dict[str, Any]:
    """Season calendar, per-season climate indicators, yearly series and trends since 1991."""
    weather, meta = _weather(lat, lon)
    plan = detect_season_plan(weather)
    out = climate_summary(weather, plan)
    out["location"] = {"lat": lat, "lon": lon, "elevation_m": weather.elevation_m}
    out["source"] = meta
    return out


@app.get("/api/soil", tags=["data"])
def soil(lat: float = Lat, lon: float = Lon) -> dict[str, Any]:
    """SoilGrids estimate for the point (labelled modelled) + derived texture class."""
    frame, meta = try_fetch(all_sources()["soilgrids"], lat, lon)
    profile = build_profile(frame, {})
    return {
        "location": {"lat": lat, "lon": lon},
        "available": frame is not None,
        "soil": profile.public(),
        "source": meta,
        "note": "SoilGrids values are 250 m map estimates, not a test of this field; every value can be overridden.",
    }


@app.get("/api/drought", tags=["data"])
def drought(lat: float = Lat, lon: float = Lon, lang: Lang = "en") -> dict[str, Any]:
    """Field vitals, flash-drought early-warning level and multi-year field memory."""
    return _drought(lat, lon, lang)


def _drought(lat: float, lon: float, lang: str) -> dict[str, Any]:
    weather, meta = _weather(lat, lon)
    sources = all_sources()
    soil_frame, _ = try_fetch(sources["soilgrids"], lat, lon)
    smap, smap_meta = try_fetch(sources["smap_l4"], lat, lon)
    eco, eco_meta = try_fetch(sources["ecostress"], lat, lon)
    profile = build_profile(soil_frame, {})
    out = flash_drought(weather, profile, smap, eco, lang)
    out["field_memory"] = field_memory(weather, smap)
    out["location"] = {"lat": lat, "lon": lon}
    out["sources"] = {"power": meta, "smap_l4": smap_meta, "ecostress": eco_meta}
    out["soil_texture"] = {"value": profile.texture, "provenance": profile.provenance.get("texture")}
    return out


def _modis_job(lat: float, lon: float, key: str) -> None:
    try:
        all_sources()["modis_ndvi"].fetch(lat, lon)
        with _JOBS_LOCK:
            _JOBS[key] = {"status": "done"}
    except SourceUnavailable as exc:
        with _JOBS_LOCK:
            _JOBS[key] = {"status": "error", "error": str(exc)}
    except Exception as exc:  # never let a background thread die silently
        with _JOBS_LOCK:
            _JOBS[key] = {"status": "error", "error": f"{type(exc).__name__}: {exc}"}


@app.get("/api/backtest", tags=["data"])
def backtest(lat: float = Lat, lon: float = Lon, lang: Lang = "en", fetch: bool = True) -> dict[str, Any]:
    """Engine water-stress estimate vs observed MODIS NDVI.

    MODIS takes several minutes to download for a new location, so the first call starts a
    background download and returns ``status: "fetching"``; poll until ``status: "ready"``.
    """
    weather, _ = _weather(lat, lon)
    sources = all_sources()
    key = cache_key("modis_ndvi", lat, lon)
    frame, meta = try_fetch(sources["modis_ndvi"], lat, lon, allow_network=False)
    if frame is None:
        with _JOBS_LOCK:
            job = _JOBS.get(key)
            if job is None and fetch and not config.offline():
                job = {"status": "fetching"}
                _JOBS[key] = job
                threading.Thread(target=_modis_job, args=(lat, lon, key), daemon=True).start()
        if job and job["status"] == "fetching":
            return {"status": "fetching", "available": False, "progress": modis_source.progress(lat, lon), "source": meta}
        reason = (job or {}).get("error") or meta.get("reason")
        return {"status": "unavailable", "available": False, "reason": reason, "source": meta, "caveats": [t(lang, f"backtest.caveat.{i}") for i in range(1, 6)]}
    soil_frame, _ = try_fetch(sources["soilgrids"], lat, lon)
    result = run_backtest(weather, detect_season_plan(weather), build_profile(soil_frame, {}), frame, lang)
    result["status"] = "ready"
    series = frame["ndvi"].dropna()
    result["ndvi_series"] = [{"date": d.date().isoformat(), "ndvi": round(float(v), 3)} for d, v in series.items()]
    return result


@app.get("/api/geocode", tags=["data"])
def geocode(q: str = Query(..., min_length=2, max_length=120)) -> dict[str, Any]:
    """Place search for the map (OpenStreetMap Nominatim). Only the typed query is sent."""
    if config.offline():
        raise HTTPException(status_code=503, detail="Place search needs an internet connection (offline mode is on). Enter coordinates or drag the pin instead.")
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "jsonv2", "limit": 5},
            headers={"User-Agent": "FieldShift-demo/0.1 (hackathon prototype)"},
            timeout=15.0,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Place search unavailable: {type(exc).__name__}") from exc
    return {
        "results": [
            {"name": item.get("display_name", ""), "lat": float(item["lat"]), "lon": float(item["lon"])}
            for item in resp.json()
            if "lat" in item and "lon" in item
        ]
    }


# ---- plan + advisor ---------------------------------------------------------------------------
@app.post("/api/plan", response_model=PlanResponse, tags=["plan"])
def plan(req: PlanRequest) -> dict[str, Any]:
    """Ranked rotations with scores + reasons, replay, adaptive rules, soil projection,
    irrigation, why-it-lost, sources used and information gaps."""
    try:
        return make_plan(req)
    except PlanError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NotEnoughData as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SourceUnavailable as exc:
        raise HTTPException(status_code=503, detail=f"Weather data unavailable: {exc}") from exc


@app.post("/api/advisor", response_model=AdvisorResponse, tags=["plan"])
def ask_advisor(req: AdvisorRequest) -> dict[str, Any]:
    """Answer a question about a plan (Claude with engine tools if a key is set, else rule-based)."""
    plan_data = recall_plan(req.plan_id) or req.plan_context
    return advisor.answer(req.question, plan_data, req.lang, req.history, _drought)


__all__ = ["app", "load_site_data"]
