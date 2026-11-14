"""Plain-language reasons behind each score, citing the actual numbers used.

Every reason is a dict {criterion, tone, text}: tone is "positive", "neutral" or "negative"
so the UI can colour it.  Nothing here is free text from a language model - each sentence is
a template filled with values that came out of the replay.
"""
from __future__ import annotations

import numpy as np

from ..context import SiteContext
from ..crops import FALLOW
from ..i18n import t
from ..replay import Scoreboard, WORST_SHARE
from ..scoring.criteria import mean_slot_outcome
from ..waterbalance import FAILED_OUTCOME

MM_TO_M3_PER_HA = 10.0
SEASONS = ["main", "off"] * 3


def _tone(value: float, good: float, bad: float) -> str:
    return "positive" if value >= good else "negative" if value < bad else "neutral"


def _unique_slots(slots: list[str]) -> list[tuple[str, str]]:
    seen, out = set(), []
    for i, crop_id in enumerate(slots):
        key = (crop_id, SEASONS[i])
        if crop_id != FALLOW and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _main_cause(sim, at: int | None = None) -> str:
    if at is None:
        means = {k: float(v.mean()) for k, v in sim.factors.items()}
    else:
        means = {k: float(v[at]) for k, v in sim.factors.items()}
    return min(means, key=means.get)


def build_reasons(board: Scoreboard, row: int, slots: list[str]) -> list[dict]:
    ctx: SiteContext = board.ctx
    lang = ctx.lang
    crops = ctx.crops
    reasons: list[dict] = []
    unique = _unique_slots(slots)
    season_name = {s: t(lang, f"season.{ctx.plan.kind(s)}") for s in ("main", "off")}

    # ---- water ---------------------------------------------------------------------------
    water_rows = []
    for crop_id, season in unique:
        sim = ctx.sim(crop_id, season)
        water_rows.append((float(sim.water_satisfaction.mean()), crop_id, season, sim))
    for satisfaction, crop_id, season, sim in sorted(water_rows, key=lambda r: r[0]):
        reasons.append(
            {
                "criterion": "water",
                "tone": _tone(100 * satisfaction, 85, 65),
                "text": t(
                    lang,
                    "reason.water.slot",
                    crop=crops[crop_id].label(lang),
                    season=season_name[season],
                    pct=round(100 * satisfaction),
                    years=ctx.n_years,
                    demand=round(float(sim.etc_mm.mean())),
                    rain=round(float(sim.rain_mm.mean())),
                ),
            }
        )
    if ctx.settings.water_source != "rainfed":
        applied = sum(
            float(ctx.sim(c, SEASONS[i]).irrigation_mm.mean()) for i, c in enumerate(slots) if c != FALLOW
        )
        reasons.append(
            {
                "criterion": "water",
                "tone": "neutral",
                "text": t(
                    lang,
                    "reason.water.irrigation",
                    m3=round(applied / 3.0 * MM_TO_M3_PER_HA),
                    source=t(lang, f"water_source.{ctx.settings.water_source}"),
                ),
            }
        )

    # ---- soil ----------------------------------------------------------------------------
    soil = board.soil
    n_need = float(soil["n_need"][row])
    legumes = sorted({crops[c].label(lang) for c in slots if c != FALLOW and crops[c].n_fixing})
    if legumes:
        reasons.append(
            {
                "criterion": "soil",
                "tone": _tone(float(soil["n_score"][row]), 55, 30),
                "text": t(
                    lang,
                    "reason.soil.n",
                    legumes=", ".join(legumes),
                    credit=round(float(soil["n_credit"][row])),
                    need=round(n_need),
                    per_crop=round(float(soil["n_per_crop"][row])),
                    current=round(float(soil["n_per_crop"][board.current])),
                ),
            }
        )
    else:
        reasons.append(
            {
                "criterion": "soil",
                "tone": "negative",
                "text": t(lang, "reason.soil.n.none", need=round(n_need), per_crop=round(float(soil["n_per_crop"][row]))),
            }
        )
    fallow = sum(1 for c in slots if c == FALLOW)
    reasons.append(
        {
            "criterion": "soil",
            "tone": _tone(float(soil["cover_score"][row]), 55, 35),
            "text": t(lang, "reason.soil.cover", cover=round(float(soil["cover"][row]), 1), fallow=fallow),
        }
    )
    pct = float(soil["soc_pct"][row])
    if np.isnan(pct):
        reasons.append(
            {
                "criterion": "soil",
                "tone": "neutral",
                "text": t(lang, "reason.soil.carbon.unavailable", c=round(float(soil["c_input"][row]), 1)),
            }
        )
    else:
        reasons.append(
            {
                "criterion": "soil",
                "tone": "positive" if pct > 0.25 else "negative" if pct < -0.25 else "neutral",
                "text": t(lang, "reason.soil.carbon", c=round(float(soil["c_input"][row]), 1), pct=pct),
            }
        )
    families = sorted({crops[c].family for c in slots if c != FALLOW})
    reasons.append(
        {
            "criterion": "soil",
            "tone": _tone(len(families), 3, 2),
            "text": t(
                lang,
                "reason.soil.diversity" if len(families) > 1 else "reason.soil.diversity.one",
                n=len(families),
                families=", ".join(families),
            ),
        }
    )

    # ---- climate risk --------------------------------------------------------------------
    performance = mean_slot_outcome(board.ps, board.triples[row : row + 1])[0]
    k = max(1, int(np.ceil(WORST_SHARE * ctx.n_years)))
    worst_idx = np.argsort(performance)[:k]
    worst_mean = float(performance[worst_idx].mean())
    reasons.append(
        {
            "criterion": "risk",
            "tone": _tone(worst_mean, 70, 50),
            "text": t(
                lang,
                "reason.risk.worst",
                worst_years=", ".join(str(int(y)) for y in sorted(ctx.years[worst_idx])),
                worst=round(worst_mean),
                mean=round(float(performance.mean())),
                years=ctx.n_years,
            ),
        }
    )
    cropped = [(c, SEASONS[i]) for i, c in enumerate(slots) if c != FALLOW]
    failed = sum(int((ctx.sim(c, s).outcome < FAILED_OUTCOME).sum()) for c, s in cropped)
    total = len(cropped) * ctx.n_years
    reasons.append(
        {
            "criterion": "risk",
            "tone": "positive" if failed == 0 else "negative" if failed > 0.05 * total else "neutral",
            "text": t(lang, "reason.risk.failures", failed=failed, total=total),
        }
    )
    riskiest = max(unique, key=lambda cs: (int((ctx.sim(*cs).outcome < FAILED_OUTCOME).sum()), -float(ctx.sim(*cs).outcome.min())))
    sim = ctx.sim(*riskiest)
    n_fail = int((sim.outcome < FAILED_OUTCOME).sum())
    low_at = int(np.argmin(sim.outcome))
    if n_fail > 0:
        reasons.append(
            {
                "criterion": "risk",
                "tone": "negative",
                "text": t(
                    lang,
                    "reason.risk.weakest",
                    crop=crops[riskiest[0]].label(lang),
                    season=season_name[riskiest[1]],
                    n=n_fail,
                    years=ctx.n_years,
                    cause=t(lang, f"factor.{_main_cause(sim, low_at)}"),
                    year=int(ctx.years[low_at]),
                ),
            }
        )
    else:
        reasons.append(
            {
                "criterion": "risk",
                "tone": "positive",
                "text": t(
                    lang,
                    "reason.risk.lowest",
                    crop=crops[riskiest[0]].label(lang),
                    season=season_name[riskiest[1]],
                    years=ctx.n_years,
                    low=round(float(sim.outcome.min())),
                    year=int(ctx.years[low_at]),
                    cause=t(lang, f"factor.{_main_cause(sim, low_at)}"),
                ),
            }
        )

    # ---- income --------------------------------------------------------------------------
    bands = ", ".join(f"{crops[c].label(lang)} {crops[c].income_band}/5" for c, _ in unique)
    income_score = float(board.income[row].mean())
    reasons.append(
        {
            "criterion": "income",
            "tone": _tone(income_score, 50, 35),
            "text": t(lang, "reason.income.bands", score=round(income_score), bands=bands),
        }
    )
    if fallow:
        reasons.append({"criterion": "income", "tone": "negative", "text": t(lang, "reason.income.fallow", n=fallow)})
    reasons.append({"criterion": "income", "tone": "neutral", "text": t(lang, "reason.income.caveat")})
    return reasons
