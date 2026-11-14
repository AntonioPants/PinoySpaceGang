"""Soil projection (10 years, illustrative) and irrigation needs per rotation."""
from __future__ import annotations

import numpy as np

from .config import AREA_UNIT
from .context import SiteContext
from .crops import FALLOW
from .i18n import t
from .replay import Scoreboard
from .scoring.criteria import HUMIFICATION, SOC_HORIZON_YEARS, soc_trajectory
from .waterbalance import IRRIGATION_EFFICIENCY

MM_TO_M3_PER_HA = 10.0


def soil_projection(board: Scoreboard, row: int) -> dict:
    """Organic-carbon curve and nitrogen balance for one rotation. Labelled illustrative."""
    ctx = board.ctx
    lang = ctx.lang
    soil = ctx.soil
    c_input = float(board.soil["c_input"][row])
    n_need = float(board.soil["n_need"][row])
    n_credit = float(board.soil["n_credit"][row])
    years = list(range(SOC_HORIZON_YEARS + 1))
    stock = soil.soc_stock_t_ha
    out = {
        "label": t(lang, "soilproj.label"),
        "illustrative": True,
        "years": years,
        "c_input_t_ha_yr": round(c_input, 2),
        "n_fertiliser_need_kg_ha_yr": round(n_need, 0),
        "n_from_legumes_kg_ha_yr": round(n_credit, 0),
        "n_cumulative_need_kg_ha": [round(n_need * y, 0) for y in years],
        "n_cumulative_from_legumes_kg_ha": [round(n_credit * y, 0) for y in years],
        "cover_rating": round(float(board.soil["cover"][row]), 2),
        "families": int(board.soil["families"][row]),
        "components": {
            "nitrogen": round(float(board.soil["n_score"][row]), 1),
            "cover": round(float(board.soil["cover_score"][row]), 1),
            "carbon": round(float(board.soil["soc_score"][row]), 1) if stock else None,
            "diversity": round(float(board.soil["div_score"][row]), 1),
        },
        "component_weights": {k: round(v, 3) for k, v in board.soil["weights"].items()},
        "assumptions": [
            t(lang, "soilproj.assume.model", h=round(100 * HUMIFICATION)),
            t(lang, "soilproj.assume.decay", k=round(100 * board.decay, 2), how=t(lang, f"soilproj.decay.{board.decay_source}")),
            t(lang, "soilproj.assume.residue"),
            t(lang, "soilproj.assume.n"),
        ],
    }
    if stock is None or stock <= 0:
        out.update({"soc_available": False, "soc_t_ha": None, "soc_g_kg": None, "soc_change_pct": None})
        return out
    curve = soc_trajectory(stock, c_input, board.decay)
    factor = soil.soc_g_kg / stock
    out.update(
        {
            "soc_available": True,
            "soc_t_ha": [round(float(v), 2) for v in curve],
            "soc_g_kg": [round(float(v * factor), 2) for v in curve],
            "soc_change_pct": round(100.0 * float(curve[-1] - stock) / stock, 2),
            "soc_start_source": soil.provenance.get("soc_g_kg", "unavailable"),
        }
    )
    return out


def irrigation_plan(ctx: SiteContext, slots: list[str]) -> dict:
    """Seasonal irrigation need per crop and per rotation (net and gross, m3 per area unit)."""
    seasons = ["main", "off"] * 3
    rows = []
    net_total = np.zeros(ctx.n_years)
    applied_total = np.zeros(ctx.n_years)
    for index, crop_id in enumerate(slots):
        if crop_id == FALLOW:
            continue
        season = seasons[index]
        need = ctx.full_irrigation[(crop_id, season)].irrigation_mm
        applied = ctx.sims[(crop_id, season)].irrigation_mm
        net_total += need
        applied_total += applied
        rows.append(
            {
                "slot": index,
                "crop": crop_id,
                "season": season,
                "net_mm_mean": round(float(need.mean()), 0),
                "net_mm_p80": round(float(np.percentile(need, 80)), 0),
                "net_m3_mean": round(float(need.mean()) * MM_TO_M3_PER_HA, 0),
                "net_m3_p80": round(float(np.percentile(need, 80)) * MM_TO_M3_PER_HA, 0),
                "gross_m3_mean": round(float(need.mean()) * MM_TO_M3_PER_HA / IRRIGATION_EFFICIENCY, 0),
                "applied_mm_mean": round(float(applied.mean()), 0),
                "crop_demand_mm": round(float(ctx.sims[(crop_id, season)].etc_mm.mean()), 0),
                "rain_mm": round(float(ctx.sims[(crop_id, season)].rain_mm.mean()), 0),
                "water_met_pct": round(100.0 * float(ctx.sims[(crop_id, season)].water_satisfaction.mean()), 0),
            }
        )
    per_year = net_total / 3.0  # the cycle spans three years
    applied_year = applied_total / 3.0
    return {
        "area_unit": AREA_UNIT,
        "unit": f"m3/{AREA_UNIT}",
        "efficiency": IRRIGATION_EFFICIENCY,
        "water_source": ctx.settings.water_source,
        "slots": rows,
        "net_m3_per_year_mean": round(float(per_year.mean()) * MM_TO_M3_PER_HA, 0),
        "net_m3_per_year_p80": round(float(np.percentile(per_year, 80)) * MM_TO_M3_PER_HA, 0),
        "gross_m3_per_year_mean": round(float(per_year.mean()) * MM_TO_M3_PER_HA / IRRIGATION_EFFICIENCY, 0),
        "applied_m3_per_year_mean": round(float(applied_year.mean()) * MM_TO_M3_PER_HA, 0),
        "note": t(ctx.lang, "irrigation.note", eff=round(100 * IRRIGATION_EFFICIENCY)),
    }
