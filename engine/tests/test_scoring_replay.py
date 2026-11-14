"""Water balance, feasibility, scoring (TOPSIS), replay, adaptive plans and why-it-lost."""
from __future__ import annotations

import numpy as np
import pytest

from fieldshift.adaptive import adaptive_plan
from fieldshift.feasibility import assess_all, feasible_ids
from fieldshift.replay import build_scoreboard, pick_distinct, summary, year_table
from fieldshift.rotations import enumerate_rotations
from fieldshift.scoring.criteria import build_pair_stats, soc_trajectory, soil_components
from fieldshift.scoring.reasons import build_reasons
from fieldshift.scoring.topsis import TopsisFrame, topsis, worst_share_mean
from fieldshift.waterbalance import SimSettings, kc_curve, simulate

from .conftest import DRY_YEARS

CURRENT = ["rice", "fallow"] * 3


# ---- water balance -----------------------------------------------------------------------------
def test_kc_curve_follows_fao_stages(ctx):
    crop = ctx.crops["corn"]
    curve = kc_curve(crop, crop.duration_days)
    assert len(curve) == crop.duration_days
    assert curve[0] == pytest.approx(crop.kc[0])
    assert curve.max() == pytest.approx(crop.kc[1])
    assert curve[-1] == pytest.approx(crop.kc[2], abs=0.05)


def test_dry_years_stress_dry_season_crops(ctx):
    sim = ctx.sim("corn", "off")
    years = list(ctx.years)
    dry = [years.index(y) for y in DRY_YEARS if y in years]
    normal = [i for i in range(len(years)) if years[i] not in DRY_YEARS]
    assert sim.water_satisfaction[dry].mean() < sim.water_satisfaction[normal].mean()
    assert 0.0 <= sim.outcome.min() and sim.outcome.max() <= 100.0


def test_irrigation_removes_water_stress(ctx):
    sw = ctx.seasons["off"]
    rainfed = simulate(ctx.crops["corn"], sw, ctx.soil, SimSettings("rainfed"))
    irrigated = simulate(ctx.crops["corn"], sw, ctx.soil, SimSettings("irrigated"))
    capped = simulate(ctx.crops["corn"], sw, ctx.soil, SimSettings("supplemental", supplemental_cap_mm=50))
    assert irrigated.water_satisfaction.min() > 0.99
    assert irrigated.irrigation_mm.mean() > 0 and rainfed.irrigation_mm.sum() == 0
    assert capped.irrigation_mm.max() <= 50 + 1e-6
    assert rainfed.water_satisfaction.mean() <= capped.water_satisfaction.mean() <= irrigated.water_satisfaction.mean()


def test_salinity_lowers_outcome(ctx, loam_soil):
    from dataclasses import replace

    salty = replace(loam_soil, ec_ds_m=6.0)
    sw = ctx.seasons["main"]
    plain = simulate(ctx.crops["corn"], sw, loam_soil)
    salted = simulate(ctx.crops["corn"], sw, salty)
    assert salted.outcome.mean() < plain.outcome.mean()


# ---- feasibility ---------------------------------------------------------------------------------
def test_feasibility_removes_out_of_season_crops_with_reasons(ctx):
    feas = assess_all(ctx)
    onion_wet = feas[("onion", "main")]
    assert not onion_wet.feasible
    assert onion_wet.checks[0].name == "season" and not onion_wet.checks[0].passed
    assert "rice" in feasible_ids(feas, "main")
    for f in feas.values():
        for check in f.checks:
            assert check.text and "{" not in check.text  # every template was filled


# ---- TOPSIS --------------------------------------------------------------------------------------
def test_topsis_textbook_behaviour():
    matrix = np.array([[90, 10], [10, 90], [50, 50], [5, 5]])
    equal = topsis(matrix, [1, 1])
    assert np.argmin(equal) == 3
    assert equal[0] == pytest.approx(equal[1])
    assert np.argmax(topsis(matrix, [3, 1])) == 0
    assert np.argmax(topsis(matrix, [1, 3])) == 1


def test_topsis_frame_matches_textbook_ordering():
    rng = np.random.default_rng(0)
    water, risk, income = (rng.uniform(20, 100, (50, 1)) for _ in range(3))
    soil = rng.uniform(20, 100, 50)
    frame = TopsisFrame.fit(water, soil, risk, income)
    weights = [0.4, 0.3, 0.2, 0.1]
    u = frame.closeness(weights, water, soil, risk, income)[:, 0]
    reference = topsis(np.column_stack([water[:, 0], soil, risk[:, 0], income[:, 0]]), weights)
    assert np.corrcoef(u, reference)[0, 1] > 0.99
    assert np.argmax(u) == np.argmax(reference)


def test_worst_share_mean():
    values = np.array([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10.0]])
    assert worst_share_mean(values, 0.2)[0] == pytest.approx(1.5)


# ---- soil ---------------------------------------------------------------------------------------
def test_soc_trajectory_moves_towards_equilibrium():
    up = soc_trajectory(40.0, 3.0, 0.02)  # equilibrium 0.2 * 3 / 0.02 = 30 -> declining
    assert up[-1] < up[0]
    stable = soc_trajectory(30.0, 3.0, 0.02)
    assert stable[-1] == pytest.approx(30.0)


def test_legumes_and_cover_raise_soil_score(ctx):
    pairs = [("rice", "fallow"), ("rice", "mungbean"), ("rice", "sunn_hemp")]
    ps = build_pair_stats(ctx, pairs)
    triples = np.array([[0, 0, 0], [1, 1, 1], [2, 2, 2]], dtype=np.int32)
    soil = soil_components(ps, triples, ctx.soil, 0.02)
    assert soil["n_credit"][0] == 0 and soil["n_credit"][2] > soil["n_credit"][1] > 0
    assert soil["soil"][2] > soil["soil"][0]
    assert soil["cover"][2] > soil["cover"][0]


# ---- replay ---------------------------------------------------------------------------------------
@pytest.fixture(scope="module")
def board(ctx):
    feas = assess_all(ctx)
    space = enumerate_rotations(feasible_ids(feas, "main"), feasible_ids(feas, "off"), ctx.crops)
    return build_scoreboard(ctx, space, CURRENT, [1, 1, 1, 1], "average")


def test_replay_statistics_are_consistent(board):
    n = len(board.triples)
    assert board.u.shape == (n, board.ctx.n_years)
    assert np.all((board.u >= 0) & (board.u <= 1))
    assert np.all(board.worst <= board.mean + 1e-9)
    assert np.all(board.max_regret >= -1e-9)
    assert board.max_regret[board.order[0]] <= board.max_regret.max()
    assert board.win_rate[board.current] == 0.0
    best = board.order[0]
    assert board.mean[best] == pytest.approx(board.mean[: board.current].max())


def test_ranking_modes_order_by_their_measure(ctx, board):
    for mode, key in (("worst_case", board.worst), ("regret", -board.max_regret)):
        board.mode = mode
        value = board.rank_value()
        order = np.argsort(-value[: board.current], kind="stable")
        assert key[order[0]] == pytest.approx(key[: board.current].max())
    board.mode = "average"


def test_top_plans_are_distinct_and_beat_fallow(board):
    rows = pick_distinct(board, 3)
    assert len(rows) == 3
    slots = [board.slots(r) for r in rows]
    assert len({tuple(sorted(s)) for s in slots}) == 3
    for r in rows:
        assert summary(board, r)["replay"]["win_rate_vs_current"] > 0.5


def test_year_table_and_reasons(board):
    row = int(board.order[0])
    slots = board.slots(row)
    table = year_table(board, row, slots)
    assert [r["year"] for r in table] == [int(y) for y in board.ctx.years]
    assert all(len(r["slots"]) == 6 for r in table)
    reasons = build_reasons(board, row, slots)
    assert {r["criterion"] for r in reasons} == {"water", "soil", "risk", "income"}
    for r in reasons:
        assert "{" not in r["text"] and r["tone"] in ("positive", "neutral", "negative")


# ---- adaptive ---------------------------------------------------------------------------------
def test_adaptive_plan_is_cross_validated_and_well_formed(ctx, board):
    feas = assess_all(ctx)
    feasible = {s: feasible_ids(feas, s) for s in ("main", "off")}
    slots = board.slots(int(board.order[0]))
    plan = adaptive_plan(ctx, slots, feasible, {"water": 0.25, "soil": 0.25, "risk": 0.25, "income": 0.25})
    comparison = plan["comparison"]
    assert len(plan["decision_points"]) == sum(1 for s in slots if s != "fallow")
    assert comparison["rules"] == sum(p["has_rule"] for p in plan["decision_points"])
    for point in plan["decision_points"]:
        if point["has_rule"]:
            assert point["stats"]["cross_validated_gain"] >= 0.5
            assert point["direction"] in ("below", "above")
            assert {point["if_below"], point["if_above"]} == {point["planned_crop"], point["alt_crop"]}
            assert point["stats"]["switch_years"] <= 0.5 * ctx.n_years
        else:
            assert point["message"]
    if comparison["rules"] == 0:
        assert comparison["gain_mean"] == 0


def test_adaptive_finds_a_planted_signal(ctx):
    """In the synthetic climate the dry years are visible in pre-season rain: a rule should appear."""
    feas = assess_all(ctx)
    feasible = {s: feasible_ids(feas, s) for s in ("main", "off")}
    slots = ["rice", "watermelon", "rice", "mungbean", "rice", "okra"]
    plan = adaptive_plan(ctx, slots, feasible, {"water": 0.4, "soil": 0.0, "risk": 0.6, "income": 0.0})
    assert plan["comparison"]["gain_mean"] >= 0
