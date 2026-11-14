"""Planner: orchestrates every module into the /api/plan response.

Flow: data sources -> weather + soil -> crop simulations -> feasibility filter -> enumerate
all valid rotations -> score + replay -> pick the top three distinct plans -> for each:
reasons, adaptive decision points, soil projection, irrigation -> why-it-lost -> backtest ->
sources used + information gaps.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone

import numpy as np

from . import config
from .adaptive import adaptive_plan
from .backtest import run_backtest
from .climate import Weather, detect_season_plan, prepare_weather
from .context import SiteContext, build_context
from .crops import FALLOW, load_crops
from .feasibility import assess_all, feasible_ids
from .i18n import t
from .models import PlanRequest
from .projections import irrigation_plan, soil_projection
from .replay import Scoreboard, aligned_slots, build_scoreboard, pick_distinct, summary, year_table
from .rotations import enumerate_rotations, violations
from .scoring.criteria import CRITERIA
from .scoring.reasons import build_reasons
from .soil import build_profile
from .sources import DiskCache, SourceUnavailable, all_sources, try_fetch
from .waterbalance import SimSettings, default_drainage
from .why_lost import why_it_lost

OPTION_LETTERS = ["A", "B", "C"]
RANKING_ROWS = 10
USED_FOR = {
    "power": "Daily weather 1991-present: rainfall, temperature, ET0 inputs, modelled soil wetness. Drives the water balance, the replay and the decision points.",
    "smap_l4": "Root-zone soil moisture for field vitals, flash-drought warning and field memory (falls back to POWER).",
    "ecostress": "Canopy temperature and evaporative stress for the flash-drought warning (falls back to POWER).",
    "modis_ndvi": "Observed greenness for the backtest and the cropping-intensity hint.",
    "soilgrids": "Soil pH, organic carbon, nitrogen and texture (the farmer can override each value).",
}


class PlanError(Exception):
    """A problem with the request that the user can fix (HTTP 422)."""


# ---- small in-memory plan store (also used by the advisor) ------------------------------------
_PLANS: "OrderedDict[str, dict]" = OrderedDict()
_PLANS_LOCK = threading.Lock()
_MAX_PLANS = 24


def remember_plan(plan: dict) -> None:
    with _PLANS_LOCK:
        _PLANS[plan["plan_id"]] = plan
        _PLANS.move_to_end(plan["plan_id"])
        while len(_PLANS) > _MAX_PLANS:
            _PLANS.popitem(last=False)


def recall_plan(plan_id: str | None) -> dict | None:
    if not plan_id:
        return None
    with _PLANS_LOCK:
        return _PLANS.get(plan_id)


# ---- data loading ----------------------------------------------------------------------------
def load_site_data(lat: float, lon: float, cache: DiskCache | None = None, *, with_modis: bool = True) -> dict:
    """Fetch every source for a point without raising (POWER excepted - it is essential)."""
    sources = all_sources(cache)
    power = sources["power"].fetch(lat, lon)  # raises SourceUnavailable: nothing works without weather
    frames = {"power": power}
    metas = {"power": {**power.attrs["meta"], "available": True}}
    for name in ("soilgrids", "smap_l4", "ecostress"):
        frames[name], metas[name] = try_fetch(sources[name], lat, lon)
    if with_modis:
        # MODIS takes minutes to download; a plan never waits for it.  /api/backtest fetches
        # it in the background and the plan picks it up from the cache once it is there.
        frames["modis_ndvi"], metas["modis_ndvi"] = try_fetch(sources["modis_ndvi"], lat, lon, allow_network=False)
        if frames["modis_ndvi"] is None and not config.offline():
            metas["modis_ndvi"]["reason"] = "not downloaded yet for this location - open the Data page to fetch it"
    for name, meta in metas.items():
        meta["used_for"] = USED_FOR.get(name, "")
        meta.setdefault("source", name)
    return {"frames": frames, "metas": metas}


def _source_rows(metas: dict) -> list[dict]:
    rows = []
    for name in ("power", "smap_l4", "ecostress", "modis_ndvi", "soilgrids"):
        meta = metas.get(name)
        if not meta:
            continue
        rows.append(
            {
                "source": name,
                "title": meta.get("title", name),
                "provider": meta.get("provider", ""),
                "kind": meta.get("kind", ""),
                "resolution": meta.get("resolution", ""),
                "available": bool(meta.get("available")),
                "origin": meta.get("origin", "unavailable"),
                "used_for": meta.get("used_for", ""),
                "reason": meta.get("reason") or meta.get("refresh_error"),
                "date_start": meta.get("date_start"),
                "date_end": meta.get("date_end"),
                "fetched_at": meta.get("fetched_at"),
                "stale": bool(meta.get("stale", False)),
                "pending": bool(meta.get("pending", False)),
                "needs_credentials": bool(meta.get("needs_credentials", False)),
                "credentials_configured": bool(meta.get("credentials_configured", True)),
                "url": meta.get("url", ""),
            }
        )
    return rows


# ---- helpers ---------------------------------------------------------------------------------
def _slot_rows(ctx: SiteContext, slots: list[str]) -> list[dict]:
    rows = []
    for i, crop_id in enumerate(slots):
        season = "main" if i % 2 == 0 else "off"
        crop = ctx.crops.get(crop_id)
        rows.append(
            {
                "index": i,
                "year": i // 2 + 1,
                "season": season,
                "season_kind": ctx.plan.kind(season),
                "crop": crop_id,
                "crop_name": crop.label(ctx.lang) if crop else t(ctx.lang, "fallow"),
                "family": crop.family if crop else None,
            }
        )
    return rows


def _violation_texts(ctx: SiteContext, slots: list[str]) -> list[str]:
    seen, out = set(), []
    for v in violations(slots, ctx.crops, ctx.soil.compaction_suspected):
        if v["rule"] == "family_gap":
            key = ("family_gap", v["family"])
            text = t(ctx.lang, "rule.family_gap", family=v["family"], distance=v["distance"], required=v["required"])
        else:
            key = (v["rule"],)
            text = t(ctx.lang, f"rule.{v['rule']}")
        if key not in seen:
            seen.add(key)
            out.append(text)
    return out


def _rotation(
    board: Scoreboard, row: int, rotation_id: str, name: str, feasible: dict, *, is_current: bool
) -> dict:
    ctx = board.ctx
    slots = board.slots(row) if is_current else aligned_slots(board, row)
    stats = summary(board, row)
    return {
        "id": rotation_id,
        "name": name,
        "is_current": is_current,
        "rank": stats["rank"],
        "slots": _slot_rows(ctx, slots),
        "slot_ids": slots,
        "scores": stats["scores"],
        "replay": stats["replay"],
        "yearly": year_table(board, row, slots),
        "reasons": build_reasons(board, row, slots),
        "rule_violations": _violation_texts(ctx, slots) if is_current else [],
        "adaptive": None
        if is_current
        else adaptive_plan(ctx, slots, feasible, dict(zip(CRITERIA, (float(w) for w in board.weights)))),
        "soil_projection": soil_projection(board, row),
        "irrigation": irrigation_plan(ctx, slots),
    }


def _gaps(ctx: SiteContext, weather: Weather, metas: dict, board: Scoreboard | None, feas: dict, current: list[str], drainage_source: str) -> list[str]:
    lang = ctx.lang
    gaps = [t(lang, "gap.power_resolution")]
    prov = ctx.soil.provenance
    if not metas["soilgrids"].get("available"):
        gaps.append(t(lang, "gap.soil_unavailable", reason=metas["soilgrids"].get("reason", "unavailable")))
    elif any(v == "modelled" for v in prov.values()):
        gaps.append(t(lang, "gap.soil_modelled"))
    if prov.get("texture") == "assumed":
        gaps.append(t(lang, "gap.texture_assumed"))
    if drainage_source == "assumed":
        gaps.append(t(lang, "gap.drainage_assumed", drainage=ctx.settings.drainage, texture=ctx.soil.texture))
    if ctx.soil.ec_ds_m is None:
        gaps.append(t(lang, "gap.salinity"))
    for name, key in (("smap_l4", "gap.smap"), ("ecostress", "gap.ecostress"), ("modis_ndvi", "gap.modis")):
        if not metas[name].get("available"):
            gaps.append(t(lang, key, reason=metas[name].get("reason", "unavailable")))
    if ctx.excluded_years:
        gaps.append(t(lang, "gap.excluded_years", years=", ".join(str(y) for y in ctx.excluded_years)))
    quality = weather.quality
    if quality.get("et0_hargreaves_days"):
        gaps.append(t(lang, "gap.et0_fallback", days=quality["et0_hargreaves_days"]))
    filled = quality.get("gap_filled_values") or {}
    if filled:
        gaps.append(t(lang, "gap.gapfill", n=sum(filled.values()), detail=", ".join(f"{k}: {v}" for k, v in filled.items())))
    if board is not None and board.enumerated > board.replayed:
        gaps.append(t(lang, "gap.prefilter", enumerated=f"{board.enumerated:,}", replayed=f"{board.replayed:,}"))
    seen = set()
    for i, crop_id in enumerate(current):
        season = "main" if i % 2 == 0 else "off"
        if crop_id == FALLOW or (crop_id, season) in seen:
            continue
        seen.add((crop_id, season))
        f = feas[(crop_id, season)]
        if not f.feasible:
            gaps.append(
                t(
                    lang,
                    "gap.current_infeasible",
                    crop=ctx.crops[crop_id].label(lang),
                    season=t(lang, f"season.{ctx.plan.kind(season)}"),
                    why=" ".join(c.text for c in f.failed()),
                )
            )
    gaps.append(t(lang, "gap.income"))
    gaps.append(t(lang, "gap.pests"))
    return gaps


def normalise_current(rotation: list[str], crops: dict) -> list[str]:
    slots = list(rotation) * 3 if len(rotation) == 2 else list(rotation)
    for i, crop_id in enumerate(slots):
        if crop_id == FALLOW:
            if i % 2 == 0:
                raise PlanError("the main season of the current rotation must have a crop (only the off season can be fallow)")
            continue
        if crop_id not in crops:
            raise PlanError(f"unknown crop id '{crop_id}' in current_rotation; valid ids: {', '.join(sorted(crops))}")
    return slots


def plan_key(req: PlanRequest, weather_stamp: str) -> str:
    payload = json.dumps(req.model_dump(), sort_keys=True) + weather_stamp
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:16]


# ---- main entry point ------------------------------------------------------------------------
def make_plan(req: PlanRequest, cache: DiskCache | None = None) -> dict:
    started = time.time()
    lang = req.lang
    crops = load_crops()
    current = normalise_current(req.current_rotation, crops)

    data = load_site_data(req.lat, req.lon, cache)
    frames, metas = data["frames"], data["metas"]
    plan_id = plan_key(req, str(metas["power"].get("date_end")))
    cached = recall_plan(plan_id)
    if cached is not None:
        return cached

    weather = prepare_weather(frames["power"], req.lat, req.lon)
    overrides = req.soil_overrides.model_dump(exclude_none=True)
    soil = build_profile(frames["soilgrids"], overrides)
    drainage, drainage_source = (default_drainage(soil), "assumed") if req.drainage == "auto" else (req.drainage, "farmer-entered")
    settings = SimSettings(water_source=req.water_source, drainage=drainage)
    season_plan = detect_season_plan(weather)
    ctx = build_context(weather, soil, settings, crops, season_plan, lang)

    feas = assess_all(ctx)
    excluded = set(req.excluded_crops)
    feasible = {s: [c for c in feasible_ids(feas, s) if c not in excluded] for s in season_plan.SEASONS}
    space = enumerate_rotations(feasible["main"], feasible["off"], crops, compaction=soil.compaction_suspected)

    weights = [req.priorities.water, req.priorities.soil, req.priorities.risk, req.priorities.income]
    board = build_scoreboard(ctx, space, current, weights, req.ranking_mode)

    top = pick_distinct(board, len(OPTION_LETTERS)) if len(board.order) else []
    rotations = [_rotation(board, board.current, "current", t(lang, "plan.name.current"), feasible, is_current=True)]
    ids = {}
    for letter, row in zip(OPTION_LETTERS, top):
        ids[letter] = row
        rotations.append(
            _rotation(board, row, letter, t(lang, "plan.name.option", letter=letter), feasible, is_current=False)
        )

    why = []
    if top:
        losers = {letter: row for letter, row in ids.items() if row != top[0]}
        losers["current"] = board.current
        names = {r["id"]: r["name"] for r in rotations}
        why = why_it_lost(board, top[0], losers, names)

    shown = {row: letter for letter, row in ids.items()}
    value = board.rank_value()
    ranking = []
    for position, row in enumerate(board.order[:RANKING_ROWS], start=1):
        row = int(row)
        ranking.append(
            {
                "rank": position,
                "slots": aligned_slots(board, row),
                "overall": round(100.0 * float(board.mean[row]), 1),
                "worst_case": round(100.0 * float(board.worst[row]), 1),
                "max_regret": round(100.0 * float(board.max_regret[row]), 1),
                "win_rate_vs_current": round(float(board.win_rate[row]), 3),
                "water": round(float(board.water[row].mean()), 1),
                "soil": round(float(board.soil["soil"][row]), 1),
                "risk": round(float(board.risk[row].mean()), 1),
                "income": round(float(board.income[row].mean()), 1),
                "shown_as": shown.get(row),
            }
        )
    current_rank = int(np.sum(value[: board.current] > value[board.current])) + 1

    backtest = run_backtest(weather, season_plan, soil, frames.get("modis_ndvi"), lang)
    norm = board.weights
    plan = {
        "plan_id": plan_id,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lang": lang,
        "request": req.model_dump(),
        "location": {
            "lat": req.lat,
            "lon": req.lon,
            "elevation_m": weather.elevation_m if weather.quality.get("elevation_known") else None,
            "is_pilot": abs(req.lat - config.PILOT["lat"]) < 0.005 and abs(req.lon - config.PILOT["lon"]) < 0.005,
        },
        "season_plan": season_plan.public(),
        "soil": soil.public(),
        "settings": {
            "water_source": req.water_source,
            "drainage": drainage,
            "drainage_source": drainage_source,
            "ranking_mode": req.ranking_mode,
            "weights": {c: round(float(w), 3) for c, w in zip(CRITERIA, norm)},
        },
        "years": [int(y) for y in ctx.years],
        "crops": [
            {
                "id": c.id,
                "name": c.name,
                "family": c.family,
                "seasons": list(c.seasons),
                "duration_days": c.duration_days,
                "income_band": c.income_band,
                "n_fixing": c.n_fixing,
                "deep_taproot": c.deep_taproot,
            }
            for c in crops.values()
        ],
        "feasibility": [f.public() for f in feas.values()],
        "enumeration": {
            **space.counts,
            "replayed": board.replayed,
            "current_rank": current_rank,
            "excluded_by_farmer": sorted(excluded),
            "feasible_main": feasible["main"],
            "feasible_off": feasible["off"],
        },
        "winner_id": OPTION_LETTERS[0] if top else None,
        "rotations": rotations,
        "ranking": ranking,
        "why_it_lost": why,
        "backtest": backtest,
        "sources": _source_rows(metas),
        "weather_quality": weather.quality,
        "gaps": _gaps(ctx, weather, metas, board, feas, current, drainage_source),
        "disclaimer": t(lang, "disclaimer"),
        "timing_s": round(time.time() - started, 2),
    }
    remember_plan(plan)
    return plan


__all__ = ["PlanError", "SourceUnavailable", "load_site_data", "make_plan", "recall_plan", "remember_plan"]
