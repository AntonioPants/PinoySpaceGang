"""SiteContext: everything the engine knows about one farm, computed once per plan request.

Holds the weather, season calendar, soil profile and - most importantly - the simulated
outcome of every crop in both seasons for every valid year of the record.  All downstream
modules (feasibility, scoring, replay, adaptive plans, why-it-lost) read from these arrays.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .climate import SeasonPlan, SeasonWeather, Weather, detect_season_plan, season_matrix
from .crops import Crop, load_crops
from .soil import SoilProfile
from .waterbalance import SeasonResult, SimSettings, simulate, spinup_depletion

MIN_REPLAY_YEARS = 10


class NotEnoughData(Exception):
    """The weather record is too short or too gappy for a meaningful replay."""


def _compact(result: SeasonResult, keep: np.ndarray) -> SeasonResult:
    """Restrict a simulation result to the valid replay years."""
    return SeasonResult(
        crop_id=result.crop_id,
        season=result.season,
        outcome=result.outcome[keep],
        water_satisfaction=result.water_satisfaction[keep],
        factors={k: v[keep] for k, v in result.factors.items()},
        etc_mm=result.etc_mm[keep],
        eta_mm=result.eta_mm[keep],
        rain_mm=result.rain_mm[keep],
        irrigation_mm=result.irrigation_mm[keep],
        heat_days=result.heat_days[keep],
        waterlog_days=result.waterlog_days[keep],
        extreme_days=result.extreme_days[keep],
        truncated=result.truncated,
    )


@dataclass
class SiteContext:
    lat: float
    lon: float
    weather: Weather
    plan: SeasonPlan
    soil: SoilProfile
    settings: SimSettings
    crops: dict[str, Crop]
    seasons: dict[str, SeasonWeather]
    keep: np.ndarray  # mask over seasons[...].years: both seasons complete
    years: np.ndarray  # rotation years used by the replay
    excluded_years: list[int]
    sims: dict[tuple[str, str], SeasonResult] = field(default_factory=dict)
    full_irrigation: dict[tuple[str, str], SeasonResult] = field(default_factory=dict)
    lang: str = "en"

    @property
    def n_years(self) -> int:
        return int(len(self.years))

    def sim(self, crop_id: str, season: str) -> SeasonResult:
        return self.sims[(crop_id, season)]

    def simulate_all(self, settings: SimSettings, crop_ids: list[str] | None = None) -> dict:
        """Re-run the crop simulations under different settings (used for what-if analysis)."""
        out = {}
        for season, sw in self.seasons.items():
            f0 = spinup_depletion(sw, self.soil, settings.rain_scale)
            for crop_id in crop_ids or list(self.crops):
                out[(crop_id, season)] = _compact(
                    simulate(self.crops[crop_id], sw, self.soil, settings, f0), self.keep
                )
        return out

    def indicator_window(self, season: str, name: str, days_before: int, span: int) -> np.ndarray:
        """Values of a weather variable in the ``span`` days ending ``days_before`` days before sowing."""
        sw = self.seasons[season]
        end = sw.pre - days_before
        return sw.data[name][self.keep, end - span : end]


def build_context(
    weather: Weather,
    soil: SoilProfile,
    settings: SimSettings,
    crops: dict[str, Crop] | None = None,
    plan: SeasonPlan | None = None,
    lang: str = "en",
) -> SiteContext:
    crops = crops or load_crops()
    plan = plan or detect_season_plan(weather)
    seasons = {s: season_matrix(weather, plan, s) for s in plan.SEASONS}
    keep = seasons["main"].valid & seasons["off"].valid
    all_years = seasons["main"].years
    if int(keep.sum()) < MIN_REPLAY_YEARS:
        raise NotEnoughData(
            f"only {int(keep.sum())} complete rotation years in the weather record; "
            f"at least {MIN_REPLAY_YEARS} are needed for the historical replay"
        )
    ctx = SiteContext(
        lat=weather.lat,
        lon=weather.lon,
        weather=weather,
        plan=plan,
        soil=soil,
        settings=settings,
        crops=crops,
        seasons=seasons,
        keep=keep,
        years=all_years[keep],
        excluded_years=[int(y) for y in all_years[~keep]],
        lang=lang,
    )
    ctx.sims = ctx.simulate_all(settings)
    # Full irrigation run: gives the irrigation requirement of each crop regardless of source.
    if settings.water_source == "irrigated":
        ctx.full_irrigation = ctx.sims
    else:
        ctx.full_irrigation = ctx.simulate_all(
            SimSettings(water_source="irrigated", drainage=settings.drainage, rain_scale=settings.rain_scale)
        )
    return ctx
