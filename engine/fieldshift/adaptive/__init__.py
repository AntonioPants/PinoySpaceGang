"""Adaptive rotation plans: decision points learned from the historical replay.

For every cropped slot of a top rotation the module asks: *is there something the farmer
can observe before sowing that separated the good years from the bad ones, and a different
crop that would have done better in the bad ones?*

Candidate early signals (all from NASA POWER, observable on the check date):
  root_wetness   mean root-zone soil wetness over the 7 days before the check date
  rain_30d       rainfall in the 30 days before the check date
  rain_60d       rainfall in the 60 days before the check date
Check dates: the planned sowing date, or 14 days before it (time to source seed).

A rule has the form
  {check_date, indicator, threshold, if_below: crop, if_above: crop, evidence}
and is found by exhaustive search over (signal, check date, alternative crop, direction,
threshold).  Only alternatives that keep the rotation valid (family-gap rule) are tried.

What a rule optimises: the *season value* of the slot - the same ingredients the replay
scores (season outcome, water fit, income band x outcome) blended with the farmer's own
priority weights.  Optimising the raw outcome alone would happily swap a cash crop for a
cover crop that "succeeds" but earns nothing.  A rule must also be a contingency: it may
switch in at most half of the years, otherwise the alternative should simply be the plan.

Honesty guard: with ~35 years it is easy to "discover" a rule that is just noise.  Every
rule is therefore re-tested by leave-one-year-out cross-validation in which the WHOLE search
(signal, crop, threshold) is repeated without the held-out year.  A decision point is only
emitted when the cross-validated gain is positive; the adaptive replay reports the
cross-validated numbers, not the flattering in-sample ones.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import numpy as np

from ..climate.weather import MONTH_NAMES
from ..context import SiteContext
from ..crops import FALLOW
from ..i18n import t
from ..rotations.generator import SLOTS, cyclic_distance, slot_conflict
from ..waterbalance import FAILED_OUTCOME

INDICATORS = {
    # name: (weather variable, window days, aggregation, unit, decimals)
    "root_wetness": ("gwetroot", 7, "mean", "", 2),
    "rain_30d": ("rain", 30, "sum", "mm", 0),
    "rain_60d": ("rain", 60, "sum", "mm", 0),
}
LEADS = (0, 14)  # days before sowing at which the check is made
QUANTILES = (0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8)
MIN_SIDE_YEARS = 4  # years required on each side of a threshold
MAX_SWITCH_SHARE = 0.5  # a contingency rule may switch in at most half of the years
MIN_IN_SAMPLE_GAIN = 1.0  # outcome points (0-100 scale)
MIN_CV_GAIN = 0.5
WORST_SHARE = 0.2


@dataclass
class Rule:
    indicator: str
    lead: int
    direction: str  # "below" -> switch to the alternative when the signal is below threshold
    threshold: float
    alt: str
    gain: float


def _signals(ctx: SiteContext, season: str) -> dict[tuple[str, int], np.ndarray]:
    out = {}
    for name, (variable, span, how, _unit, _dec) in INDICATORS.items():
        for lead in LEADS:
            window = ctx.indicator_window(season, variable, lead, span)
            if window.size == 0 or np.isnan(window).any():
                continue  # signal not available for every year: do not use it
            out[(name, lead)] = window.mean(axis=1) if how == "mean" else window.sum(axis=1)
    return out


def _search(signals: dict, planned: np.ndarray, alts: dict[str, np.ndarray], train: np.ndarray) -> Rule | None:
    """Best switching rule on the training years (exhaustive, vectorised)."""
    if not signals or not alts:
        return None
    alt_ids = list(alts)
    delta = np.stack([alts[a] - planned for a in alt_ids])[:, train]  # (A, T) gain from switching
    n_train = int(train.sum())
    best: Rule | None = None
    for (name, lead), x in signals.items():
        xt = x[train]
        thresholds = np.unique(np.quantile(xt, QUANTILES))
        for direction in ("below", "above"):
            switch = (xt[None, :] < thresholds[:, None]) if direction == "below" else (xt[None, :] > thresholds[:, None])
            n_switch = switch.sum(axis=1)
            usable = (
                (n_switch >= MIN_SIDE_YEARS)
                & (n_train - n_switch >= MIN_SIDE_YEARS)
                & (n_switch <= MAX_SWITCH_SHARE * n_train)
            )
            if not usable.any():
                continue
            gains = switch.astype("float64") @ delta.T / n_train  # (thresholds, A)
            gains[~usable] = -np.inf
            row, col = np.unravel_index(np.argmax(gains), gains.shape)
            gain = float(gains[row, col])
            if best is None or gain > best.gain:
                best = Rule(name, lead, direction, float(thresholds[row]), alt_ids[col], gain)
    return best


def _apply(rule: Rule, signals: dict, planned: np.ndarray, alts: dict) -> tuple[np.ndarray, np.ndarray]:
    x = signals[(rule.indicator, rule.lead)]
    switch = x < rule.threshold if rule.direction == "below" else x > rule.threshold
    return np.where(switch, alts[rule.alt], planned), switch


def _valid_alternatives(ctx: SiteContext, slots: list[str], index: int, feasible: list[str]) -> list[str]:
    """Feasible crops that can replace slot ``index`` without breaking the family-gap rule."""
    out = []
    for alt in feasible:
        if alt == slots[index]:
            continue
        crop = ctx.crops[alt]
        ok = True
        for j, other in enumerate(slots):
            if j == index or other == FALLOW:
                continue
            if slot_conflict(crop, ctx.crops[other], cyclic_distance(index, j, SLOTS)):
                ok = False
                break
        if ok:
            out.append(alt)
    return out


def season_value(ctx: SiteContext, crop_id: str, season: str, weights: dict | None) -> np.ndarray:
    """Per-year value (0-100) of growing a crop in a season, weighted by the farmer's priorities.

    value = (w_risk x outcome + w_income x outcome x band/5 + w_water x water met) / sum(w)
    Soil health is left out: it belongs to the rotation as a whole, not to one season.
    """
    sim = ctx.sim(crop_id, season)
    weights = weights or {}
    w_risk, w_income, w_water = (float(weights.get(k, 0.0)) for k in ("risk", "income", "water"))
    total = w_risk + w_income + w_water
    if total <= 0:
        return sim.outcome.copy()
    band = ctx.crops[crop_id].income_band / 5.0
    return (w_risk * sim.outcome + w_income * sim.outcome * band + w_water * 100.0 * sim.water_satisfaction) / total


def _fmt(value: float, decimals: int) -> str:
    return f"{value:.{decimals}f}"


def decision_point(
    ctx: SiteContext, slots: list[str], index: int, feasible: list[str], weights: dict | None = None
) -> dict:
    """Decision point (or an explicit "no reliable signal") for one slot of a rotation."""
    lang = ctx.lang
    season = "main" if index % 2 == 0 else "off"
    planned_id = slots[index]
    planned_crop = ctx.crops[planned_id]
    planned = season_value(ctx, planned_id, season, weights)
    planned_outcome = ctx.sim(planned_id, season).outcome
    base = {
        "slot": index,
        "year_in_rotation": index // 2 + 1,
        "season": season,
        "season_kind": ctx.plan.kind(season),
        "planned_crop": planned_id,
        "sow_date": _label(ctx.plan.sow_date(season, 2001)),
    }
    alt_ids = _valid_alternatives(ctx, slots, index, feasible)
    alts = {a: season_value(ctx, a, season, weights) for a in alt_ids}
    signals = _signals(ctx, season)
    everyone = np.ones(len(planned), dtype=bool)
    rule = _search(signals, planned, alts, everyone)

    if rule is None or rule.gain < MIN_IN_SAMPLE_GAIN:
        return {
            **base,
            "has_rule": False,
            "policy_outcome": planned_outcome.copy(),
            "policy_value": planned.copy(),
            "fixed_value": planned.copy(),
            "switch": np.zeros(len(planned), dtype=bool),
            "message": t(lang, "adaptive.none", crop=planned_crop.label(lang), years=ctx.n_years),
        }

    # leave-one-year-out: repeat the whole search without each year, then apply it to that year
    cv_value = planned.copy()
    cv_outcome = planned_outcome.copy()
    cv_switch = np.zeros(len(planned), dtype=bool)
    for held in range(len(planned)):
        train = everyone.copy()
        train[held] = False
        fold = _search(signals, planned, alts, train)
        if fold is None or fold.gain < MIN_IN_SAMPLE_GAIN:
            continue
        value, switch = _apply(fold, signals, planned, alts)
        cv_value[held] = value[held]
        cv_switch[held] = switch[held]
        if switch[held]:
            cv_outcome[held] = ctx.sim(fold.alt, season).outcome[held]
    cv_gain = float(cv_value.mean() - planned.mean())

    if cv_gain < MIN_CV_GAIN:
        return {
            **base,
            "has_rule": False,
            "policy_outcome": planned_outcome.copy(),
            "policy_value": planned.copy(),
            "fixed_value": planned.copy(),
            "switch": np.zeros(len(planned), dtype=bool),
            "message": t(
                lang,
                "adaptive.not_robust",
                crop=planned_crop.label(lang),
                alt=ctx.crops[rule.alt].label(lang),
                gain=round(rule.gain, 1),
                cv=round(cv_gain, 1),
            ),
        }

    _outcome, switch = _apply(rule, signals, planned, alts)
    variable, span, _how, unit, decimals = INDICATORS[rule.indicator]
    unit = unit or t(lang, "unit.wetness")
    alt_crop = ctx.crops[rule.alt]
    alt = alts[rule.alt]
    alt_outcome = ctx.sim(rule.alt, season).outcome
    check = ctx.plan.sow_date(season, 2001) - timedelta(days=rule.lead)
    n_switch = int(switch.sum())
    stay = ~switch
    stats = {
        "years": ctx.n_years,
        "switch_years": n_switch,
        "planned_mean_when_switching": round(float(planned[switch].mean()), 1),
        "alt_mean_when_switching": round(float(alt[switch].mean()), 1),
        "planned_mean_otherwise": round(float(planned[stay].mean()), 1),
        "alt_mean_otherwise": round(float(alt[stay].mean()), 1),
        "in_sample_gain": round(rule.gain, 1),
        "cross_validated_gain": round(cv_gain, 1),
        "planned_outcome_when_switching": round(float(planned_outcome[switch].mean()), 1),
        "alt_outcome_when_switching": round(float(alt_outcome[switch].mean()), 1),
        "planned_failures": int((planned_outcome < FAILED_OUTCOME).sum()),
        "policy_failures_cross_validated": int((cv_outcome < FAILED_OUTCOME).sum()),
    }
    threshold_text = _fmt(rule.threshold, decimals)
    indicator_label = t(lang, f"indicator.{rule.indicator}", days=span)
    below_crop, above_crop = (rule.alt, planned_id) if rule.direction == "below" else (planned_id, rule.alt)
    evidence = t(
        lang,
        "adaptive.evidence",
        n=n_switch,
        years=ctx.n_years,
        indicator=indicator_label,
        relation=t(lang, f"relation.{rule.direction}"),
        threshold=threshold_text,
        unit=unit,
        crop=planned_crop.label(lang),
        alt=alt_crop.label(lang),
        planned_bad=stats["planned_mean_when_switching"],
        alt_bad=stats["alt_mean_when_switching"],
        planned_good=stats["planned_mean_otherwise"],
        cv=stats["cross_validated_gain"],
    )
    rule_text = t(
        lang,
        "adaptive.rule",
        date=_label(check),
        indicator=indicator_label,
        relation=t(lang, f"relation.{rule.direction}"),
        threshold=threshold_text,
        unit=unit,
        alt=alt_crop.label(lang),
        crop=planned_crop.label(lang),
    )
    return {
        **base,
        "has_rule": True,
        "check_date": _label(check),
        "check_month": check.month,
        "check_day": check.day,
        "lead_days": rule.lead,
        "indicator": rule.indicator,
        "indicator_label": indicator_label,
        "indicator_source": "NASA POWER (modelled)",
        "window_days": span,
        "threshold": round(rule.threshold, decimals),
        "unit": unit,
        "direction": rule.direction,
        "if_below": below_crop,
        "if_above": above_crop,
        "alt_crop": rule.alt,
        "rule_text": rule_text,
        "evidence": evidence,
        "stats": stats,
        "switch_years": [int(y) for y in ctx.years[switch]],
        "policy_outcome": cv_outcome,
        "policy_value": cv_value,
        "fixed_value": planned,
        "switch": cv_switch,
    }


def _label(day) -> str:
    return f"{day.day} {MONTH_NAMES[day.month - 1]}"


def adaptive_plan(
    ctx: SiteContext, slots: list[str], feasible: dict[str, list[str]], weights: dict | None = None
) -> dict:
    """Decision points for every cropped slot + the replay of the adaptive policy."""
    seasons = ["main", "off"] * 3
    points = []
    fixed, adaptive, fixed_value, adaptive_value = [], [], [], []
    for index, crop_id in enumerate(slots):
        if crop_id == FALLOW:
            continue
        point = decision_point(ctx, slots, index, feasible[seasons[index]], weights)
        fixed.append(ctx.sim(crop_id, seasons[index]).outcome)
        adaptive.append(point.pop("policy_outcome"))
        fixed_value.append(point.pop("fixed_value"))
        adaptive_value.append(point.pop("policy_value"))
        point["cross_validated_switch_years"] = [int(y) for y in ctx.years[point.pop("switch")]]
        points.append(point)

    fixed_arr, adaptive_arr = np.stack(fixed), np.stack(adaptive)  # (slots, Y)
    fixed_year, adaptive_year = np.stack(fixed_value).mean(axis=0), np.stack(adaptive_value).mean(axis=0)
    k = max(1, int(np.ceil(WORST_SHARE * ctx.n_years)))
    worst_fixed = float(np.sort(fixed_year)[:k].mean())
    worst_adaptive = float(np.sort(adaptive_year)[:k].mean())
    n_rules = sum(1 for p in points if p["has_rule"])
    comparison = {
        "basis": "season value (0-100: outcome, water fit and income band weighted by the farmer priorities), "
        "leave-one-year-out cross-validated",
        "fixed_mean": round(float(fixed_year.mean()), 1),
        "adaptive_mean": round(float(adaptive_year.mean()), 1),
        "gain_mean": round(float(adaptive_year.mean() - fixed_year.mean()), 1),
        "fixed_worst20": round(worst_fixed, 1),
        "adaptive_worst20": round(worst_adaptive, 1),
        "gain_worst20": round(worst_adaptive - worst_fixed, 1),
        "fixed_failed_seasons": int((fixed_arr < FAILED_OUTCOME).sum()),
        "adaptive_failed_seasons": int((adaptive_arr < FAILED_OUTCOME).sum()),
        "crop_seasons_replayed": int(fixed_arr.size),
        "years_better": int((adaptive_year > fixed_year + 1e-9).sum()),
        "years_worse": int((adaptive_year < fixed_year - 1e-9).sum()),
        "rules": n_rules,
    }
    yearly = [
        {"year": int(y), "fixed": round(float(f), 1), "adaptive": round(float(a), 1)}
        for y, f, a in zip(ctx.years, fixed_year, adaptive_year)
    ]
    if n_rules == 0:
        text = t(ctx.lang, "adaptive.summary.none", years=ctx.n_years)
    else:
        text = t(
            ctx.lang,
            "adaptive.summary",
            rules=n_rules,
            gain=comparison["gain_mean"],
            worst=comparison["gain_worst20"],
            failed_fixed=comparison["fixed_failed_seasons"],
            failed_adaptive=comparison["adaptive_failed_seasons"],
            years=ctx.n_years,
        )
    return {"decision_points": points, "comparison": comparison, "yearly": yearly, "summary": text}
