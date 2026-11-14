"""Climate module: ET0, season calendar, per-season indicators and trends."""
from .et0 import daily_et0, extraterrestrial_radiation, hargreaves, penman_monteith
from .indicators import climate_summary, growing_degree_days, longest_run, season_indicators, trend
from .weather import (
    SeasonPlan,
    SeasonWeather,
    Weather,
    detect_season_plan,
    monthly_climatology,
    prepare_weather,
    season_matrix,
    window_matrix,
)

__all__ = [
    "daily_et0",
    "extraterrestrial_radiation",
    "hargreaves",
    "penman_monteith",
    "climate_summary",
    "growing_degree_days",
    "longest_run",
    "season_indicators",
    "trend",
    "SeasonPlan",
    "SeasonWeather",
    "Weather",
    "detect_season_plan",
    "monthly_climatology",
    "prepare_weather",
    "season_matrix",
    "window_matrix",
]
