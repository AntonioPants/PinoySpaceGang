"""Crop feasibility filter: which crops can be grown in which season on this farm.

A crop is REMOVED for a season (not scored down) when it fails any hard check:

  season        the crop is not grown in that season (crops.yaml `seasons`)
  duration      it does not fit between sowing and the end of the season window
  temperature   the season's mean temperature is outside the crop's envelope
  thermal_time  not enough growing-degree days to mature
  frost         frost-sensitive crop and frost occurs in more than 1 year in 5
  salinity      farmer-entered soil salinity far above the crop's tolerance
  ph            soil pH outside the crop's range
  water         with the farmer's water source, rain + stored soil water + irrigation
                covered less than 60 % of crop water demand on average
  reliability   the season outcome "failed" in at least half of the years replayed

Every check reports the actual numbers so the UI can show why a crop was dropped.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .context import SiteContext
from .crops import Crop
from .i18n import t
from .waterbalance import FAILED_OUTCOME, GDD_CAP_C

MIN_WATER_SATISFACTION = 0.60
MAX_FAILURE_RATE = 0.50
MAX_FROST_YEAR_SHARE = 0.20
SALINITY_MARGIN_DS_M = 4.0  # above threshold + margin the crop is dropped (~50 % loss)
PH_MARGIN = 0.3


@dataclass
class Check:
    name: str
    passed: bool
    text: str
    value: float | None = None
    limit: str | None = None


@dataclass
class CropFeasibility:
    crop_id: str
    season: str
    feasible: bool
    checks: list[Check] = field(default_factory=list)

    def failed(self) -> list[Check]:
        return [c for c in self.checks if not c.passed]

    def public(self) -> dict:
        return {
            "crop_id": self.crop_id,
            "season": self.season,
            "feasible": self.feasible,
            "checks": [
                {"name": c.name, "passed": c.passed, "text": c.text, "value": c.value, "limit": c.limit}
                for c in self.checks
            ],
        }


def assess_crop(ctx: SiteContext, crop: Crop, season: str) -> CropFeasibility:
    lang = ctx.lang
    name = crop.label(lang)
    season_name = t(lang, f"season.{ctx.plan.kind(season)}")
    checks: list[Check] = []

    tag = ctx.plan.crop_tag(season)
    in_season = tag in crop.seasons
    checks.append(
        Check(
            "season",
            in_season,
            t(lang, "feas.season.ok" if in_season else "feas.season.fail", crop=name, season=season_name),
        )
    )
    if not in_season:
        return CropFeasibility(crop.id, season, False, checks)

    window = ctx.plan.length_days(season)
    fits = crop.duration_days <= window
    checks.append(
        Check(
            "duration",
            fits,
            t(lang, "feas.duration.ok" if fits else "feas.duration.fail", crop=name, days=crop.duration_days, window=window),
            float(crop.duration_days),
            f"<= {window} d",
        )
    )

    sw = ctx.seasons[season]
    days = min(crop.duration_days, sw.length)
    tmean = sw.after_sowing("tmean")[ctx.keep, :days]
    season_mean = float(np.nanmean(tmean))
    lo, hi = crop.t_mean_range_c
    temp_ok = lo <= season_mean <= hi
    checks.append(
        Check(
            "temperature",
            temp_ok,
            t(lang, "feas.temp.ok" if temp_ok else "feas.temp.fail", crop=name, value=round(season_mean, 1), lo=lo, hi=hi),
            round(season_mean, 1),
            f"{lo:g}-{hi:g} C",
        )
    )

    window_tmean = sw.after_sowing("tmean")[ctx.keep]
    gdd = float(np.nanmean(np.nansum(np.maximum(np.minimum(window_tmean, GDD_CAP_C) - crop.t_base_c, 0.0), axis=1)))
    gdd_ok = gdd >= crop.gdd_need
    checks.append(
        Check(
            "thermal_time",
            gdd_ok,
            t(lang, "feas.gdd.ok" if gdd_ok else "feas.gdd.fail", crop=name, value=round(gdd), need=round(crop.gdd_need)),
            round(gdd),
            f">= {crop.gdd_need:g} GDD",
        )
    )

    tmin = sw.after_sowing("tmin")[ctx.keep, :days]
    frost_share = float(np.mean(np.nanmin(tmin, axis=1) < 0.0))
    frost_ok = not (crop.frost_sensitive and frost_share > MAX_FROST_YEAR_SHARE)
    if frost_share > 0 or not frost_ok:
        checks.append(
            Check(
                "frost",
                frost_ok,
                t(lang, "feas.frost.ok" if frost_ok else "feas.frost.fail", crop=name, pct=round(100 * frost_share)),
                round(100 * frost_share),
                f"<= {round(100 * MAX_FROST_YEAR_SHARE)} % of years",
            )
        )

    ec = ctx.soil.ec_ds_m
    if ec is not None:
        limit = crop.salinity_threshold_ds_m + SALINITY_MARGIN_DS_M
        salt_ok = ec <= limit
        checks.append(
            Check(
                "salinity",
                salt_ok,
                t(
                    lang,
                    "feas.salt.ok" if salt_ok else "feas.salt.fail",
                    crop=name,
                    value=ec,
                    threshold=crop.salinity_threshold_ds_m,
                ),
                ec,
                f"<= {limit:g} dS/m",
            )
        )

    ph = ctx.soil.ph
    if ph is not None:
        p_lo, p_hi = crop.ph_range
        ph_ok = (p_lo - PH_MARGIN) <= ph <= (p_hi + PH_MARGIN)
        checks.append(
            Check(
                "ph",
                ph_ok,
                t(lang, "feas.ph.ok" if ph_ok else "feas.ph.fail", crop=name, value=round(ph, 1), lo=p_lo, hi=p_hi),
                round(ph, 1),
                f"{p_lo:g}-{p_hi:g}",
            )
        )

    sim = ctx.sim(crop.id, season)
    satisfaction = float(sim.water_satisfaction.mean())
    water_ok = satisfaction >= MIN_WATER_SATISFACTION
    checks.append(
        Check(
            "water",
            water_ok,
            t(
                lang,
                "feas.water.ok" if water_ok else "feas.water.fail",
                crop=name,
                season=season_name,
                pct=round(100 * satisfaction),
                source=t(lang, f"water_source.{ctx.settings.water_source}"),
                demand=round(float(sim.etc_mm.mean())),
                rain=round(float(sim.rain_mm.mean())),
                years=ctx.n_years,
            ),
            round(100 * satisfaction),
            f">= {round(100 * MIN_WATER_SATISFACTION)} %",
        )
    )

    failure_rate = float(np.mean(sim.outcome < FAILED_OUTCOME))
    reliable = failure_rate < MAX_FAILURE_RATE
    cause = _main_cause(sim)
    checks.append(
        Check(
            "reliability",
            reliable,
            t(
                lang,
                "feas.reliable.ok" if reliable else "feas.reliable.fail",
                crop=name,
                season=season_name,
                failed=int(np.sum(sim.outcome < FAILED_OUTCOME)),
                years=ctx.n_years,
                cause=t(lang, f"factor.{cause}"),
            ),
            round(100 * failure_rate),
            f"< {round(100 * MAX_FAILURE_RATE)} % of years",
        )
    )
    return CropFeasibility(crop.id, season, all(c.passed for c in checks), checks)


def _main_cause(sim) -> str:
    """The factor that pulled the outcome down most on average."""
    means = {name: float(values.mean()) for name, values in sim.factors.items()}
    return min(means, key=means.get)


def assess_all(ctx: SiteContext) -> dict[tuple[str, str], CropFeasibility]:
    return {
        (crop.id, season): assess_crop(ctx, crop, season)
        for season in ctx.plan.SEASONS
        for crop in ctx.crops.values()
    }


def feasible_ids(feas: dict[tuple[str, str], CropFeasibility], season: str) -> list[str]:
    return [crop_id for (crop_id, s), f in feas.items() if s == season and f.feasible]
