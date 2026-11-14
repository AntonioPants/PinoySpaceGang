"""Why it lost: the smallest change that would make a non-winning rotation win.

Two kinds of change are tested for every displayed rotation that is not the winner:

  priorities  move the farmer's priority weights toward one criterion, step by step, until
              the rotation outranks every candidate in the leading pool.  Exact for the
              pool because the TOPSIS frame does not depend on the weights.
  rainfall    scale every day's rainfall by a factor (-50 % .. +50 %), re-run the crop
              simulations and the replay for the displayed rotations, and find the smallest
              change at which the rotation leads that shortlist.

Both answers are reported with the numbers, or with a plain "nothing in the tested range
makes it win" - which is itself useful to know.
"""
from __future__ import annotations

import numpy as np

from .i18n import t
from .replay import Scoreboard
from .scoring.criteria import CRITERIA, build_pair_stats, yearly_criteria
from .scoring.topsis import normalise_weights, worst_share_mean
from .waterbalance import SimSettings

POOL = 1000
ALPHAS = np.round(np.arange(0.04, 1.0001, 0.04), 2)
RAIN_SCALES = [0.9, 1.1, 0.8, 1.2, 0.7, 1.3, 0.6, 1.4, 0.5, 1.5]  # ordered by size of change


def _value(u: np.ndarray, mode: str) -> np.ndarray:
    """Ranking value (higher is better) of each row of a closeness matrix."""
    if mode == "worst_case":
        return worst_share_mean(u) + 1e-6 * u.mean(axis=1)
    if mode == "regret":
        return -(u.max(axis=0)[None, :] - u).max(axis=1) + 1e-6 * u.mean(axis=1)
    return u.mean(axis=1)


def _priority_change(board: Scoreboard, pool: np.ndarray, target: int) -> dict | None:
    """Smallest shift of weight toward one criterion that puts ``target`` on top of the pool."""
    water, risk, income = board.water[pool], board.risk[pool], board.income[pool]
    soil = board.soil["soil"][pool]
    position = int(np.nonzero(pool == target)[0][0])
    best: dict | None = None
    for k, name in enumerate(CRITERIA):
        unit = np.zeros(4)
        unit[k] = 1.0
        for alpha in ALPHAS:
            if best is not None and alpha >= best["shift"]:
                break
            weights = normalise_weights((1.0 - alpha) * board.weights + alpha * unit)
            u = board.frame.closeness(weights, water, soil, risk, income)
            if int(np.argmax(_value(u, board.mode))) == position:
                best = {
                    "criterion": name,
                    "shift": float(alpha),
                    "new_weights": {c: round(float(w), 3) for c, w in zip(CRITERIA, weights)},
                }
                break
    return best


def rain_scenarios(board: Scoreboard, rows: list[int]) -> dict[float, np.ndarray]:
    """Ranking value of the displayed rotations under each rainfall scaling."""
    ctx = board.ctx
    pairs = sorted({board.pairs[int(p)] for row in rows for p in board.triples[row]})
    index = {pair: i for i, pair in enumerate(pairs)}
    triples = np.array([[index[board.pairs[int(p)]] for p in board.triples[row]] for row in rows], dtype=np.int32)
    crop_ids = sorted({c for pair in pairs for c in pair if c != "fallow"})
    soil = board.soil["soil"][rows]
    out = {}
    for scale in RAIN_SCALES:
        settings = SimSettings(
            water_source=ctx.settings.water_source,
            drainage=ctx.settings.drainage,
            rain_scale=scale,
            supplemental_cap_mm=ctx.settings.supplemental_cap_mm,
        )
        sims = ctx.simulate_all(settings, crop_ids)
        ps = build_pair_stats(ctx, pairs, sims)
        water, risk, income = yearly_criteria(ps, triples)
        u = board.frame.closeness(board.weights, water, soil, risk, income)
        out[scale] = _value(u, board.mode)
    return out


def why_it_lost(board: Scoreboard, winner: int, losers: dict[str, int], names: dict[str, str]) -> list[dict]:
    """``losers`` maps rotation id -> scoreboard row; ``names`` maps id -> display label."""
    ctx = board.ctx
    lang = ctx.lang
    rows = [winner] + list(losers.values())
    value = board.rank_value()
    pool = np.unique(np.concatenate([board.order[:POOL], np.array(rows, dtype=int)]))
    scenarios = rain_scenarios(board, rows)

    means = {
        "water": board.water.mean(axis=1),
        "soil": board.soil["soil"],
        "risk": board.risk.mean(axis=1),
        "income": board.income.mean(axis=1),
    }
    results = []
    for position, (rotation_id, row) in enumerate(losers.items(), start=1):
        deltas = {c: round(float(means[c][row] - means[c][winner]), 1) for c in CRITERIA}
        # gap in the measure the farmer chose to rank by (average, worst years or regret)
        behind = round(100.0 * float(value[winner] - value[row]), 1)
        weakest = min(deltas, key=deltas.get)
        strongest = max(deltas, key=deltas.get)
        dominated = all(d <= 0 for d in deltas.values())

        if dominated:
            priority = {"found": False, "dominated": True, "text": t(lang, "whylost.dominated", name=names[rotation_id])}
        else:
            change = _priority_change(board, pool, row)
            if change is None:
                priority = {
                    "found": False,
                    "dominated": False,
                    "text": t(lang, "whylost.priority.none", name=names[rotation_id]),
                }
            else:
                priority = {
                    "found": True,
                    "dominated": False,
                    **change,
                    "old_weights": {c: round(float(w), 3) for c, w in zip(CRITERIA, board.weights)},
                    "text": t(
                        lang,
                        "whylost.priority",
                        name=names[rotation_id],
                        criterion=t(lang, f"criterion.{change['criterion']}"),
                        old=round(100 * float(board.weights[CRITERIA.index(change["criterion"])])),
                        new=round(100 * change["new_weights"][change["criterion"]]),
                        pool=len(pool),
                    ),
                }

        rain = {"found": False, "tested_range_pct": [-50, 50], "text": t(lang, "whylost.rain.none", name=names[rotation_id])}
        for scale in RAIN_SCALES:
            if int(np.argmax(scenarios[scale])) == position:
                pct = round(100 * (scale - 1.0))
                rain = {
                    "found": True,
                    "factor": scale,
                    "change_pct": pct,
                    "tested_range_pct": [-50, 50],
                    "text": t(
                        lang,
                        "whylost.rain.less" if pct < 0 else "whylost.rain.more",
                        name=names[rotation_id],
                        pct=abs(pct),
                    ),
                }
                break

        results.append(
            {
                "rotation_id": rotation_id,
                "behind_by": behind,
                "average_score_gap": round(100.0 * float(board.mean[winner] - board.mean[row]), 1),
                "ranking_mode": board.mode,
                "criteria_vs_winner": deltas,
                "weakest_criterion": weakest,
                "strongest_criterion": strongest,
                "priority_change": priority,
                "rainfall_change": rain,
                "summary": t(
                    lang,
                    "whylost.summary" if deltas[strongest] > 0 else "whylost.summary.behind",
                    name=names[rotation_id],
                    behind=behind,
                    weakest=t(lang, f"criterion.{weakest}"),
                    weak_delta=abs(deltas[weakest]),
                    strongest=t(lang, f"criterion.{strongest}"),
                    strong_delta=deltas[strongest],
                ),
            }
        )
    return results
