"""The four criteria (all 0-100, higher is better), computed for every rotation at once.

  water fit     how much of crop water demand was met (share of ETc covered), per year
  soil health   nitrogen self-reliance (fertiliser N needed per crop grown) + soil cover +
                organic-carbon direction + crop-family diversity
                (static: does not depend on the weather year)
  climate risk  "resilience": half the average season outcome, half the worst season
                outcome among the rotation's crops, per year
  income        relative income index: income band x how well the crop did, per year
                (a RELATIVE comparison between rotations, never a price or profit forecast)

Because a rotation is three (main, off) year-pairs, every quantity is first tabulated per
pair and then combined for all rotations with numpy gathers - which is what makes scoring
hundreds of thousands of candidates through 35 years of weather take about a second.

Year-level scores are phase-neutral: in weather year y the rotation's three years are all
evaluated and averaged (as if a third of the farm were in each year of the cycle).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..context import SiteContext
from ..crops import FALLOW, Crop
from ..soil import SoilProfile

# ---- assumptions (flagged in the README) -----------------------------------------------------
FALLOW_COVER = 1.5  # residue/cover rating of a weedy fallow (crops are rated 1-5)
FALLOW_C_INPUT = 0.3  # t C/ha returned by fallow weeds
FALLOW_CREDIT_CARRY = 0.5  # share of a legume's N credit that survives a fallow season
N_REFERENCE_KG_HA_CROP = 120.0  # fertiliser N per crop grown that scores 0 (a heavy feeder)
HUMIFICATION = 0.20  # share of residue carbon that becomes soil organic carbon
DECAY_BOUNDS = (0.004, 0.05)  # yearly soil-carbon decay rate allowed after calibration
DEFAULT_DECAY = 0.02
SOC_HORIZON_YEARS = 10
SOC_SCORE_PER_PCT = 10.0  # +5 % carbon in 10 years scores 100, -5 % scores 0
MAX_INCOME_BAND = 5.0
SOIL_WEIGHTS = {"nitrogen": 0.30, "cover": 0.25, "carbon": 0.30, "diversity": 0.15}
CRITERIA = ("water", "soil", "risk", "income")
CHUNK = 20000


@dataclass
class PairStats:
    pairs: list[tuple[str, str]]
    n_crop: np.ndarray  # (P,) cropped slots in the year (1 or 2)
    ws_sum: np.ndarray  # (P, Y) sum of water satisfaction over cropped slots
    out_sum: np.ndarray  # (P, Y) sum of season outcomes
    out_min: np.ndarray  # (P, Y) worst season outcome
    inc_sum: np.ndarray  # (P, Y) sum of income band x outcome / 100
    cover_sum: np.ndarray  # (P,) sum of cover ratings over both slots
    c_input: np.ndarray  # (P,) t C/ha returned in the year
    n_within: np.ndarray  # (P,) fertiliser N needed in the year before cross-year credits
    demand_main: np.ndarray  # (P,) N demand of the main-season crop
    last_credit: np.ndarray  # (P,) N credit handed to next year's main crop
    credit_within: np.ndarray  # (P,) N credit used inside the year
    fam_mask: np.ndarray  # (P,) bit mask of crop families present


def build_pair_stats(ctx: SiteContext, pairs: list[tuple[str, str]], sims: dict | None = None) -> PairStats:
    sims = sims or ctx.sims
    crops = ctx.crops
    families = sorted({c.family for c in crops.values()})
    fam_bit = {f: 1 << i for i, f in enumerate(families)}
    n_pairs, n_years = len(pairs), ctx.n_years

    n_crop = np.zeros(n_pairs)
    ws_sum = np.zeros((n_pairs, n_years), dtype=np.float32)
    out_sum = np.zeros((n_pairs, n_years), dtype=np.float32)
    out_min = np.full((n_pairs, n_years), 100.0, dtype=np.float32)
    inc_sum = np.zeros((n_pairs, n_years), dtype=np.float32)
    cover_sum = np.zeros(n_pairs)
    c_input = np.zeros(n_pairs)
    n_within = np.zeros(n_pairs)
    demand_main = np.zeros(n_pairs)
    last_credit = np.zeros(n_pairs)
    credit_within = np.zeros(n_pairs)
    fam_mask = np.zeros(n_pairs, dtype=np.int64)

    for p, (m, o) in enumerate(pairs):
        main: Crop = crops[m]
        off: Crop | None = crops[o] if o != FALLOW else None
        for crop, season in ((main, "main"), (off, "off")):
            if crop is None:
                cover_sum[p] += FALLOW_COVER
                c_input[p] += FALLOW_C_INPUT
                continue
            sim = sims[(crop.id, season)]
            n_crop[p] += 1
            ws_sum[p] += sim.water_satisfaction
            out_sum[p] += sim.outcome
            out_min[p] = np.minimum(out_min[p], sim.outcome)
            inc_sum[p] += crop.income_band * sim.outcome / 100.0
            cover_sum[p] += crop.residue_cover
            c_input[p] += crop.residue_c_t_ha
            fam_mask[p] |= fam_bit[crop.family]
        demand_main[p] = main.n_demand_kg_ha
        if off is None:
            n_within[p] = main.n_demand_kg_ha
            last_credit[p] = FALLOW_CREDIT_CARRY * main.n_credit_kg_ha
        else:
            used = min(main.n_credit_kg_ha, off.n_demand_kg_ha)
            credit_within[p] = used
            n_within[p] = main.n_demand_kg_ha + off.n_demand_kg_ha - used
            last_credit[p] = off.n_credit_kg_ha
    return PairStats(
        pairs, n_crop, ws_sum, out_sum, out_min, inc_sum, cover_sum, c_input,
        n_within, demand_main, last_credit, credit_within, fam_mask,
    )


def _popcount(mask: np.ndarray) -> np.ndarray:
    count = np.zeros(mask.shape, dtype=np.int32)
    for bit in range(40):
        count += ((mask >> bit) & 1).astype(np.int32)
    return count


def calibrate_decay(soil: SoilProfile, current_c_input_per_year: float) -> tuple[float, str]:
    """Soil-carbon decay rate, assuming carbon is roughly stable under the current rotation."""
    stock = soil.soc_stock_t_ha
    if stock is None or stock <= 0:
        return DEFAULT_DECAY, "default"
    k = HUMIFICATION * current_c_input_per_year / stock
    bounded = float(np.clip(k, *DECAY_BOUNDS))
    return bounded, "calibrated" if abs(bounded - k) < 1e-12 else "calibrated-bounded"


def soc_trajectory(stock: float, c_input_per_year: float, decay: float, years: int = SOC_HORIZON_YEARS) -> np.ndarray:
    """One-pool model C[t+1] = C[t] + h x input - k x C[t]; returns years + 1 values."""
    out = np.empty(years + 1)
    out[0] = stock
    for step in range(years):
        out[step + 1] = out[step] + HUMIFICATION * c_input_per_year - decay * out[step]
    return out


def soil_components(ps: PairStats, triples: np.ndarray, soil: SoilProfile, decay: float) -> dict:
    """Static soil-health components for every rotation in ``triples`` (N, 3)."""
    a, b, c = triples[:, 0], triples[:, 1], triples[:, 2]
    cross = (
        np.minimum(ps.last_credit[a], ps.demand_main[b])
        + np.minimum(ps.last_credit[b], ps.demand_main[c])
        + np.minimum(ps.last_credit[c], ps.demand_main[a])
    )
    within = ps.n_within[a] + ps.n_within[b] + ps.n_within[c]
    n_need = (within - cross) / 3.0  # kg N/ha per year
    n_per_crop = (within - cross) / (ps.n_crop[a] + ps.n_crop[b] + ps.n_crop[c])  # per crop grown
    n_credit = (ps.credit_within[a] + ps.credit_within[b] + ps.credit_within[c] + cross) / 3.0
    cover = (ps.cover_sum[a] + ps.cover_sum[b] + ps.cover_sum[c]) / 6.0
    c_in = (ps.c_input[a] + ps.c_input[b] + ps.c_input[c]) / 3.0  # t C/ha per year
    families = _popcount(ps.fam_mask[a] | ps.fam_mask[b] | ps.fam_mask[c])

    # per crop grown, so that growing a second crop a year is not punished for needing more N
    n_score = 100.0 * np.clip(1.0 - n_per_crop / N_REFERENCE_KG_HA_CROP, 0.0, 1.0)
    cover_score = 100.0 * np.clip((cover - 1.0) / 4.0, 0.0, 1.0)
    div_score = 100.0 * np.clip((families - 1) / 3.0, 0.0, 1.0)

    stock = soil.soc_stock_t_ha
    weights = dict(SOIL_WEIGHTS)
    if stock is not None and stock > 0:
        equilibrium = HUMIFICATION * c_in / decay
        final = equilibrium + (stock - equilibrium) * (1.0 - decay) ** SOC_HORIZON_YEARS
        soc_pct = 100.0 * (final - stock) / stock
        soc_score = np.clip(50.0 + SOC_SCORE_PER_PCT * soc_pct, 0.0, 100.0)
    else:
        soc_pct = np.full(len(triples), np.nan)
        soc_score = np.zeros(len(triples))
        weights["carbon"] = 0.0
    total_weight = sum(weights.values())
    soil_score = (
        weights["nitrogen"] * n_score
        + weights["cover"] * cover_score
        + weights["carbon"] * soc_score
        + weights["diversity"] * div_score
    ) / total_weight
    return {
        "soil": soil_score,
        "n_need": n_need,
        "n_per_crop": n_per_crop,
        "n_credit": n_credit,
        "cover": cover,
        "c_input": c_in,
        "families": families,
        "soc_pct": soc_pct,
        "n_score": n_score,
        "cover_score": cover_score,
        "soc_score": soc_score,
        "div_score": div_score,
        "weights": {k: v / total_weight for k, v in weights.items()},
    }


def yearly_criteria(ps: PairStats, triples: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per-year water, resilience and income scores, each (N, Y) float32."""
    n, n_years = len(triples), ps.ws_sum.shape[1]
    water = np.empty((n, n_years), dtype=np.float32)
    risk = np.empty((n, n_years), dtype=np.float32)
    income = np.empty((n, n_years), dtype=np.float32)
    for start in range(0, n, CHUNK):
        t = triples[start : start + CHUNK]
        a, b, c = t[:, 0], t[:, 1], t[:, 2]
        slots = (ps.n_crop[a] + ps.n_crop[b] + ps.n_crop[c])[:, None].astype(np.float32)
        water[start : start + CHUNK] = 100.0 * (ps.ws_sum[a] + ps.ws_sum[b] + ps.ws_sum[c]) / slots
        mean_out = (ps.out_sum[a] + ps.out_sum[b] + ps.out_sum[c]) / slots
        worst = np.minimum(np.minimum(ps.out_min[a], ps.out_min[b]), ps.out_min[c])
        risk[start : start + CHUNK] = 0.5 * mean_out + 0.5 * worst
        income[start : start + CHUNK] = (
            100.0 * (ps.inc_sum[a] + ps.inc_sum[b] + ps.inc_sum[c]) / (6.0 * MAX_INCOME_BAND)
        )
    return water, risk, income


def mean_slot_outcome(ps: PairStats, triples: np.ndarray) -> np.ndarray:
    """Average season outcome of the cropped slots, (N, Y)."""
    a, b, c = triples[:, 0], triples[:, 1], triples[:, 2]
    slots = (ps.n_crop[a] + ps.n_crop[b] + ps.n_crop[c])[:, None]
    return (ps.out_sum[a] + ps.out_sum[b] + ps.out_sum[c]) / slots
