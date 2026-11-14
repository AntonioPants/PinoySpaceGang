"""Data contracts (pydantic) shared by the API and - through OpenAPI - the TypeScript frontend.

``web/lib/api-types.ts`` is generated from these models (see ``scripts/export_openapi.py``),
so backend and frontend can be worked on in parallel without drifting apart.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

WaterSource = Literal["rainfed", "supplemental", "irrigated"]
Drainage = Literal["auto", "poor", "moderate", "good"]
RankingMode = Literal["average", "worst_case", "regret"]
Lang = Literal["en", "fil"]


class Loose(BaseModel):
    """Base for response models: documented fields are typed, extra fields pass through."""

    model_config = ConfigDict(extra="allow")


# ---- request -----------------------------------------------------------------------------------
class Priorities(BaseModel):
    """Farmer priority sliders (any non-negative scale; they are normalised to sum to 1)."""

    water: float = Field(25, ge=0, le=100, description="Using water well")
    soil: float = Field(25, ge=0, le=100, description="Building soil health")
    income: float = Field(25, ge=0, le=100, description="Relative income")
    risk: float = Field(25, ge=0, le=100, description="Low climate risk")


class SoilOverrides(BaseModel):
    """Farmer-entered soil values; anything given here replaces the SoilGrids estimate."""

    ph: float | None = Field(None, ge=3, le=10)
    soc_g_kg: float | None = Field(None, ge=0, le=200, description="Soil organic carbon, g/kg")
    nitrogen_g_kg: float | None = Field(None, ge=0, le=20)
    clay_pct: float | None = Field(None, ge=0, le=100)
    sand_pct: float | None = Field(None, ge=0, le=100)
    silt_pct: float | None = Field(None, ge=0, le=100)
    bulk_density: float | None = Field(None, ge=0.5, le=2.0)
    cec_cmol_kg: float | None = Field(None, ge=0, le=100)
    ec_ds_m: float | None = Field(None, ge=0, le=40, description="Soil salinity (ECe), dS/m")
    texture: str | None = Field(None, description="USDA texture class, e.g. 'clay loam'")
    compaction_suspected: bool = False


class PlanRequest(BaseModel):
    lat: float = Field(..., ge=-60, le=75)
    lon: float = Field(..., ge=-180, le=180)
    current_rotation: list[str] = Field(
        ...,
        min_length=2,
        max_length=6,
        description="Crop ids for [Y1 main, Y1 off, Y2 main, Y2 off, Y3 main, Y3 off]; use 'fallow' "
        "for an empty off season. A 2-item list is repeated for all three years.",
    )
    soil_overrides: SoilOverrides = Field(default_factory=SoilOverrides)
    priorities: Priorities = Field(default_factory=Priorities)
    water_source: WaterSource = "rainfed"
    drainage: Drainage = "auto"
    ranking_mode: RankingMode = "average"
    excluded_crops: list[str] = Field(default_factory=list, description="Crops the farmer will not grow")
    lang: Lang = "en"

    @field_validator("current_rotation")
    @classmethod
    def _length(cls, value: list[str]) -> list[str]:
        if len(value) not in (2, 6):
            raise ValueError("current_rotation must have 2 items (one year) or 6 items (three years)")
        return [v.strip().lower() for v in value]


class AdvisorRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    plan_context: dict[str, Any] | None = Field(None, description="The plan returned by /api/plan (or a subset)")
    plan_id: str | None = Field(None, description="Id of a plan the engine still has in memory")
    history: list[dict[str, str]] = Field(default_factory=list, description="Earlier {role, content} turns")
    lang: Lang = "en"


# ---- shared pieces -----------------------------------------------------------------------------
class Badge(Loose):
    source: str
    kind: str  # observed | modelled | farmer-entered | assumed
    label: str


class SourceStatus(Loose):
    source: str
    title: str
    provider: str = ""
    kind: str = ""
    resolution: str = ""
    available: bool = False
    origin: str = "unavailable"  # live | cache | snapshot | unavailable
    used_for: str = ""
    reason: str | None = None
    date_start: str | None = None
    date_end: str | None = None
    fetched_at: str | None = None
    stale: bool = False
    pending: bool = False
    needs_credentials: bool = False
    credentials_configured: bool = True


class SeasonInfo(Loose):
    kind: str
    months: list[int]
    label: str
    sow_label: str
    length_days: int


class SeasonPlanOut(Loose):
    regime: str
    main: SeasonInfo
    off: SeasonInfo


class SoilOut(Loose):
    values: dict[str, Any]
    provenance: dict[str, str]


class Reason(Loose):
    criterion: str
    tone: str
    text: str


class Scores(Loose):
    overall: float
    worst_case: float
    water: float
    soil: float
    risk: float
    income: float


class ReplayStats(Loose):
    years: int
    mean_score: float
    worst20_score: float
    worst_years: list[int]
    max_regret: float
    mean_regret: float
    win_rate_vs_current: float
    mean_performance: float
    worst20_performance: float


class SlotOut(Loose):
    index: int
    year: int
    season: str
    season_kind: str
    crop: str
    crop_name: str
    family: str | None = None


class SlotYear(Loose):
    outcome: float
    status: str


class YearRow(Loose):
    year: int
    score: float
    performance: float
    water: float
    risk: float
    income: float
    regret: float
    beats_current: bool
    failed_slots: int
    bad_year: bool
    slots: list[SlotYear | None]


class DecisionPoint(Loose):
    slot: int
    year_in_rotation: int
    season: str
    planned_crop: str
    has_rule: bool
    sow_date: str
    message: str | None = None
    check_date: str | None = None
    indicator: str | None = None
    indicator_label: str | None = None
    threshold: float | None = None
    unit: str | None = None
    direction: str | None = None
    if_below: str | None = None
    if_above: str | None = None
    alt_crop: str | None = None
    rule_text: str | None = None
    evidence: str | None = None
    stats: dict[str, Any] | None = None
    switch_years: list[int] = Field(default_factory=list)


class AdaptiveComparison(Loose):
    fixed_mean: float
    adaptive_mean: float
    gain_mean: float
    fixed_worst20: float
    adaptive_worst20: float
    gain_worst20: float
    fixed_failed_seasons: int
    adaptive_failed_seasons: int
    rules: int


class AdaptiveYear(Loose):
    year: int
    fixed: float
    adaptive: float


class AdaptivePlan(Loose):
    decision_points: list[DecisionPoint]
    comparison: AdaptiveComparison
    yearly: list[AdaptiveYear]
    summary: str


class SoilProjection(Loose):
    label: str
    illustrative: bool
    years: list[int]
    soc_available: bool
    soc_t_ha: list[float] | None = None
    soc_g_kg: list[float] | None = None
    soc_change_pct: float | None = None
    c_input_t_ha_yr: float
    n_fertiliser_need_kg_ha_yr: float
    n_from_legumes_kg_ha_yr: float
    n_cumulative_need_kg_ha: list[float]
    n_cumulative_from_legumes_kg_ha: list[float]
    assumptions: list[str]


class IrrigationSlot(Loose):
    slot: int
    crop: str
    season: str
    net_mm_mean: float
    net_m3_mean: float
    net_m3_p80: float
    gross_m3_mean: float
    crop_demand_mm: float
    rain_mm: float
    water_met_pct: float


class IrrigationPlan(Loose):
    unit: str
    efficiency: float
    water_source: str
    slots: list[IrrigationSlot]
    net_m3_per_year_mean: float
    net_m3_per_year_p80: float
    gross_m3_per_year_mean: float
    applied_m3_per_year_mean: float
    note: str


class RotationOut(Loose):
    id: str
    name: str
    is_current: bool
    rank: int
    slots: list[SlotOut]
    scores: Scores
    replay: ReplayStats
    yearly: list[YearRow]
    reasons: list[Reason]
    rule_violations: list[str] = Field(default_factory=list)
    adaptive: AdaptivePlan | None = None
    soil_projection: SoilProjection
    irrigation: IrrigationPlan


class RankedRow(Loose):
    rank: int
    slots: list[str]
    overall: float
    worst_case: float
    max_regret: float
    win_rate_vs_current: float
    water: float
    soil: float
    risk: float
    income: float
    shown_as: str | None = None


class WhyLost(Loose):
    rotation_id: str
    behind_by: float
    criteria_vs_winner: dict[str, float]
    weakest_criterion: str
    strongest_criterion: str
    priority_change: dict[str, Any]
    rainfall_change: dict[str, Any]
    summary: str


class FeasibilityCheck(Loose):
    name: str
    passed: bool
    text: str
    value: float | None = None
    limit: str | None = None


class FeasibilityOut(Loose):
    crop_id: str
    season: str
    feasible: bool
    checks: list[FeasibilityCheck]


class CropOut(Loose):
    id: str
    name: dict[str, str]
    family: str
    seasons: list[str]
    duration_days: int
    income_band: int
    n_fixing: bool
    deep_taproot: bool


class PlanSettings(Loose):
    water_source: str
    drainage: str
    drainage_source: str
    ranking_mode: str
    weights: dict[str, float]


class PlanResponse(Loose):
    plan_id: str
    generated_at: str
    lang: str
    location: dict[str, Any]
    season_plan: SeasonPlanOut
    soil: SoilOut
    settings: PlanSettings
    years: list[int]
    crops: list[CropOut]
    feasibility: list[FeasibilityOut]
    enumeration: dict[str, Any]
    winner_id: str | None
    rotations: list[RotationOut]
    ranking: list[RankedRow]
    why_it_lost: list[WhyLost]
    backtest: dict[str, Any]
    sources: list[SourceStatus]
    gaps: list[str]
    disclaimer: str
    timing_s: float


class AdvisorResponse(Loose):
    answer: str
    mode: str  # "llm" or "rules"
    model: str | None = None
    tools_used: list[str] = Field(default_factory=list)
    note: str | None = None
