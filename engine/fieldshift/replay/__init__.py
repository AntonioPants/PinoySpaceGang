"""Historical replay ("time machine").

Every candidate rotation is run through every complete year of the NASA weather record.
For each (rotation, year) the four criteria are combined with TOPSIS into a 0-1 closeness
score; the replay then summarises each rotation by

  average      mean score over all years
  worst case   mean score in its worst 20 % of years
  regret       how far it fell short of the best rotation in each year
               (max regret = the most the farmer could lose by having picked this plan)
  win rate     share of years it beat the farmer's current rotation

and ranks by whichever robustness measure the farmer chose.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

import numpy as np

from ..context import SiteContext
from ..crops import FALLOW
from ..rotations import RotationSpace, align_to
from ..scoring.criteria import (
    PairStats,
    build_pair_stats,
    calibrate_decay,
    mean_slot_outcome,
    soil_components,
    yearly_criteria,
)
from ..scoring.topsis import TopsisFrame, normalise_weights, worst_share_mean
from ..waterbalance import FAILED_OUTCOME, classify

RANKING_MODES = ("average", "worst_case", "regret")
MAX_REPLAY = 250_000  # candidates carried through the year-by-year replay
WORST_SHARE = 0.2
BAD_YEAR_PERFORMANCE = 50.0  # mean season outcome below this marks a bad year
BAD_YEAR_FAILED_SLOTS = 2  # ...or at least this many failed crop-seasons


@dataclass
class Scoreboard:
    ctx: SiteContext
    pairs: list[tuple[str, str]]
    triples: np.ndarray  # (N, 3); the last row is the farmer's current rotation
    current: int  # row index of the current rotation
    ps: PairStats
    soil: dict
    decay: float
    decay_source: str
    water: np.ndarray  # (N, Y)
    risk: np.ndarray
    income: np.ndarray
    frame: TopsisFrame
    weights: np.ndarray
    u: np.ndarray  # (N, Y) closeness 0-1
    mean: np.ndarray
    worst: np.ndarray
    best_by_year: np.ndarray
    max_regret: np.ndarray
    mean_regret: np.ndarray
    win_rate: np.ndarray
    mode: str
    order: np.ndarray  # candidate rows (current excluded) from best to worst
    enumerated: int
    replayed: int

    def slots(self, row: int) -> list[str]:
        out: list[str] = []
        for p in self.triples[row]:
            out.extend(self.pairs[int(p)])
        return out

    def rank_value(self, mode: str | None = None) -> np.ndarray:
        """Higher is better for every mode."""
        mode = mode or self.mode
        if mode == "worst_case":
            return self.worst + 1e-6 * self.mean
        if mode == "regret":
            return -self.max_regret + 1e-6 * self.mean
        return self.mean


def _stats(u: np.ndarray, current: int) -> dict:
    best = u.max(axis=0)
    regret = best[None, :] - u
    return {
        "mean": u.mean(axis=1),
        "worst": worst_share_mean(u, WORST_SHARE),
        "best_by_year": best,
        "max_regret": regret.max(axis=1),
        "mean_regret": regret.mean(axis=1),
        "win_rate": (u > u[current][None, :]).mean(axis=1),
    }


def build_scoreboard(
    ctx: SiteContext,
    space: RotationSpace,
    current_slots: list[str],
    weights,
    mode: str = "average",
    max_replay: int = MAX_REPLAY,
) -> Scoreboard:
    if mode not in RANKING_MODES:
        raise ValueError(f"ranking mode must be one of {RANKING_MODES}")
    weights = normalise_weights(weights)

    # The current rotation may break the rules or use crops that failed the feasibility
    # filter; it is still replayed, as the baseline everything is compared with.
    pairs = list(space.pairs)
    index = {pair: i for i, pair in enumerate(pairs)}
    current_triple = []
    for year in range(3):
        pair = (current_slots[2 * year], current_slots[2 * year + 1])
        if pair not in index:
            index[pair] = len(pairs)
            pairs.append(pair)
        current_triple.append(index[pair])
    ps = build_pair_stats(ctx, pairs)

    current_arr = np.array([current_triple], dtype=np.int32)
    decay, decay_source = calibrate_decay(ctx.soil, float(ps.c_input[current_arr[0]].sum() / 3.0))

    candidates = space.triples
    enumerated = int(len(candidates))
    if enumerated > max_replay:
        # Pre-selection on average criteria (cheap and exact for water / income / soil) so
        # the year-by-year replay stays within memory.  Reported to the user.
        soil_all = soil_components(ps, candidates, ctx.soil, decay)["soil"]
        a, b, c = candidates[:, 0], candidates[:, 1], candidates[:, 2]
        slots = ps.n_crop[a] + ps.n_crop[b] + ps.n_crop[c]
        ws = ps.ws_sum.mean(axis=1)
        out = ps.out_sum.mean(axis=1)
        low = ps.out_min.mean(axis=1)
        inc = ps.inc_sum.mean(axis=1)
        water_mean = 100.0 * (ws[a] + ws[b] + ws[c]) / slots
        risk_mean = 0.5 * (out[a] + out[b] + out[c]) / slots + 0.5 * np.minimum(np.minimum(low[a], low[b]), low[c])
        income_mean = 100.0 * (inc[a] + inc[b] + inc[c]) / 30.0
        quick = weights[0] * water_mean + weights[1] * soil_all + weights[2] * risk_mean + weights[3] * income_mean
        keep = np.argpartition(-quick, max_replay - 1)[:max_replay]
        candidates = candidates[np.sort(keep)]

    triples = np.concatenate([candidates, current_arr]).astype(np.int32)
    current = len(triples) - 1
    soil = soil_components(ps, triples, ctx.soil, decay)
    water, risk, income = yearly_criteria(ps, triples)
    frame = TopsisFrame.fit(water, soil["soil"], risk, income)
    u = frame.closeness(weights, water, soil["soil"], risk, income)
    stats = _stats(u, current)

    board = Scoreboard(
        ctx=ctx, pairs=pairs, triples=triples, current=current, ps=ps, soil=soil,
        decay=decay, decay_source=decay_source, water=water, risk=risk, income=income,
        frame=frame, weights=weights, u=u, mode=mode, order=np.array([], dtype=int),
        enumerated=enumerated, replayed=int(len(candidates)), **stats,
    )
    value = board.rank_value()[:current]
    board.order = np.argsort(-value, kind="stable")
    return board


def _crop_difference(a: list[str], b: list[str]) -> int:
    """Slots that would have to change crop to turn one rotation into the other (order ignored).

    Order is ignored on purpose: the same crops in a different sequence replay almost
    identically, so showing both would waste one of the three options.
    """
    shared = sum((Counter(a) & Counter(b)).values())
    return len(a) - shared


def pick_distinct(board: Scoreboard, count: int = 3, min_difference: int = 2, pool: int = 5000) -> list[int]:
    """Top rotations that differ from each other by at least ``min_difference`` slots.

    Without this the top of the list is usually the same plan with one crop swapped.
    """
    chosen: list[int] = []
    chosen_slots: list[list[str]] = []
    for row in board.order[:pool]:
        slots = board.slots(int(row))
        if all(_crop_difference(slots, other) >= min_difference for other in chosen_slots):
            chosen.append(int(row))
            chosen_slots.append(slots)
            if len(chosen) == count:
                break
    for row in board.order:  # fewer distinct plans than requested: fill with the next best
        if len(chosen) >= min(count, len(board.order)):
            break
        if int(row) not in chosen:
            chosen.append(int(row))
    return chosen


def year_table(board: Scoreboard, row: int, slots: list[str], sims: dict | None = None) -> list[dict]:
    """Per-year replay of one rotation (the time-machine data)."""
    ctx = board.ctx
    sims = sims or ctx.sims
    seasons = ["main", "off"] * 3
    outcomes = [None if s == FALLOW else sims[(s, seasons[i])].outcome for i, s in enumerate(slots)]
    table = []
    for y, year in enumerate(ctx.years):
        slot_rows = []
        values = []
        for i, s in enumerate(slots):
            if outcomes[i] is None:
                slot_rows.append(None)
                continue
            value = float(outcomes[i][y])
            values.append(value)
            slot_rows.append({"outcome": round(value, 1), "status": classify(value)})
        performance = float(np.mean(values)) if values else 0.0
        failed = sum(1 for v in values if v < FAILED_OUTCOME)
        bad = performance < BAD_YEAR_PERFORMANCE or failed >= BAD_YEAR_FAILED_SLOTS
        table.append(
            {
                "year": int(year),
                "score": round(100.0 * float(board.u[row, y]), 1),
                "performance": round(performance, 1),
                "water": round(float(board.water[row, y]), 1),
                "risk": round(float(board.risk[row, y]), 1),
                "income": round(float(board.income[row, y]), 1),
                "regret": round(100.0 * float(board.best_by_year[y] - board.u[row, y]), 1),
                "beats_current": bool(board.u[row, y] > board.u[board.current, y]),
                "failed_slots": int(failed),
                "bad_year": bool(bad),
                "slots": slot_rows,
            }
        )
    return table


def summary(board: Scoreboard, row: int) -> dict:
    """Headline scores and replay statistics of one rotation."""
    u = board.u[row]
    n_years = len(u)
    k = max(1, int(np.ceil(WORST_SHARE * n_years)))
    worst_years = [int(board.ctx.years[i]) for i in np.argsort(u)[:k]]
    performance = mean_slot_outcome(board.ps, board.triples[row : row + 1])[0]
    value = board.rank_value()
    rank = int(np.sum(value[: board.current] > value[row])) + 1
    return {
        "scores": {
            "overall": round(100.0 * float(board.mean[row]), 1),
            "worst_case": round(100.0 * float(board.worst[row]), 1),
            "water": round(float(board.water[row].mean()), 1),
            "soil": round(float(board.soil["soil"][row]), 1),
            "risk": round(float(board.risk[row].mean()), 1),
            "income": round(float(board.income[row].mean()), 1),
        },
        "replay": {
            "years": int(n_years),
            "mean_score": round(100.0 * float(board.mean[row]), 1),
            "worst20_score": round(100.0 * float(board.worst[row]), 1),
            "best_year_score": round(100.0 * float(u.max()), 1),
            "worst_year_score": round(100.0 * float(u.min()), 1),
            "std_score": round(100.0 * float(u.std()), 1),
            "worst_years": sorted(worst_years),
            "max_regret": round(100.0 * float(board.max_regret[row]), 1),
            "mean_regret": round(100.0 * float(board.mean_regret[row]), 1),
            "win_rate_vs_current": round(float(board.win_rate[row]), 3),
            "mean_performance": round(float(performance.mean()), 1),
            "worst20_performance": round(float(np.sort(performance)[:k].mean()), 1),
        },
        "rank": rank,
    }


def aligned_slots(board: Scoreboard, row: int) -> list[str]:
    """Slots of a rotation, with its year order turned to line up with the current rotation."""
    return align_to(board.slots(row), board.slots(board.current))
