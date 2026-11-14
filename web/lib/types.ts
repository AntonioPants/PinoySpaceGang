// TypeScript mirror of the engine's data contracts (engine/fieldshift/models.py).
// The full machine-readable schema is lib/openapi.json; `npm run gen:types` turns it into
// lib/openapi.d.ts so drift between the two sides shows up as a type error.

export type Lang = "en" | "fil";
export type WaterSource = "rainfed" | "supplemental" | "irrigated";
export type Drainage = "auto" | "poor" | "moderate" | "good";
export type RankingMode = "average" | "worst_case" | "regret";
export type Criterion = "water" | "soil" | "risk" | "income";
export type Provenance = "observed" | "modelled" | "farmer-entered" | "assumed" | "unavailable";

export interface Priorities {
  water: number;
  soil: number;
  income: number;
  risk: number;
}

export interface SoilOverrides {
  ph?: number | null;
  soc_g_kg?: number | null;
  nitrogen_g_kg?: number | null;
  clay_pct?: number | null;
  sand_pct?: number | null;
  silt_pct?: number | null;
  bulk_density?: number | null;
  cec_cmol_kg?: number | null;
  ec_ds_m?: number | null;
  texture?: string | null;
  compaction_suspected?: boolean;
}

export interface PlanRequest {
  lat: number;
  lon: number;
  current_rotation: string[];
  soil_overrides: SoilOverrides;
  priorities: Priorities;
  water_source: WaterSource;
  drainage: Drainage;
  ranking_mode: RankingMode;
  excluded_crops: string[];
  lang: Lang;
}

export interface Badge {
  source: string;
  kind: string;
  label: string;
}

export interface SourceStatus {
  source: string;
  title: string;
  provider: string;
  kind: string;
  resolution: string;
  available: boolean;
  origin: string;
  used_for: string;
  reason?: string | null;
  date_start?: string | null;
  date_end?: string | null;
  fetched_at?: string | null;
  stale: boolean;
  pending: boolean;
  needs_credentials: boolean;
  credentials_configured: boolean;
  url?: string;
}

export interface SeasonInfo {
  kind: string;
  months: number[];
  label: string;
  sow_label: string;
  sow_month: number;
  sow_day: number;
  length_days: number;
}

export interface SeasonPlan {
  regime: string;
  main: SeasonInfo;
  off: SeasonInfo;
}

export interface SoilOut {
  values: Record<string, number | string | boolean | null>;
  provenance: Record<string, string>;
}

export interface Reason {
  criterion: Criterion;
  tone: "positive" | "neutral" | "negative";
  text: string;
}

export interface Scores {
  overall: number;
  worst_case: number;
  water: number;
  soil: number;
  risk: number;
  income: number;
}

export interface ReplayStats {
  years: number;
  mean_score: number;
  worst20_score: number;
  best_year_score: number;
  worst_year_score: number;
  std_score: number;
  worst_years: number[];
  max_regret: number;
  mean_regret: number;
  win_rate_vs_current: number;
  mean_performance: number;
  worst20_performance: number;
}

export interface Slot {
  index: number;
  year: number;
  season: "main" | "off";
  season_kind: string;
  crop: string;
  crop_name: string;
  family: string | null;
}

export interface SlotYear {
  outcome: number;
  status: "good" | "stressed" | "failed";
}

export interface YearRow {
  year: number;
  score: number;
  performance: number;
  water: number;
  risk: number;
  income: number;
  regret: number;
  beats_current: boolean;
  failed_slots: number;
  bad_year: boolean;
  slots: (SlotYear | null)[];
}

export interface DecisionPoint {
  slot: number;
  year_in_rotation: number;
  season: "main" | "off";
  season_kind: string;
  planned_crop: string;
  sow_date: string;
  has_rule: boolean;
  message?: string;
  check_date?: string;
  lead_days?: number;
  indicator?: string;
  indicator_label?: string;
  indicator_source?: string;
  threshold?: number;
  unit?: string;
  direction?: "below" | "above";
  if_below?: string;
  if_above?: string;
  alt_crop?: string;
  rule_text?: string;
  evidence?: string;
  stats?: Record<string, number>;
  switch_years?: number[];
  cross_validated_switch_years?: number[];
}

export interface AdaptivePlan {
  decision_points: DecisionPoint[];
  comparison: {
    basis: string;
    fixed_mean: number;
    adaptive_mean: number;
    gain_mean: number;
    fixed_worst20: number;
    adaptive_worst20: number;
    gain_worst20: number;
    fixed_failed_seasons: number;
    adaptive_failed_seasons: number;
    crop_seasons_replayed: number;
    years_better: number;
    years_worse: number;
    rules: number;
  };
  yearly: { year: number; fixed: number; adaptive: number }[];
  summary: string;
}

export interface SoilProjection {
  label: string;
  illustrative: boolean;
  years: number[];
  soc_available: boolean;
  soc_t_ha: number[] | null;
  soc_g_kg: number[] | null;
  soc_change_pct: number | null;
  soc_start_source?: string;
  c_input_t_ha_yr: number;
  n_fertiliser_need_kg_ha_yr: number;
  n_from_legumes_kg_ha_yr: number;
  n_cumulative_need_kg_ha: number[];
  n_cumulative_from_legumes_kg_ha: number[];
  cover_rating: number;
  families: number;
  components: Record<string, number | null>;
  component_weights: Record<string, number>;
  assumptions: string[];
}

export interface IrrigationSlot {
  slot: number;
  crop: string;
  season: string;
  net_mm_mean: number;
  net_mm_p80: number;
  net_m3_mean: number;
  net_m3_p80: number;
  gross_m3_mean: number;
  applied_mm_mean: number;
  crop_demand_mm: number;
  rain_mm: number;
  water_met_pct: number;
}

export interface IrrigationPlan {
  area_unit: string;
  unit: string;
  efficiency: number;
  water_source: WaterSource;
  slots: IrrigationSlot[];
  net_m3_per_year_mean: number;
  net_m3_per_year_p80: number;
  gross_m3_per_year_mean: number;
  applied_m3_per_year_mean: number;
  note: string;
}

export interface Rotation {
  id: string;
  name: string;
  is_current: boolean;
  rank: number;
  slots: Slot[];
  slot_ids: string[];
  scores: Scores;
  replay: ReplayStats;
  yearly: YearRow[];
  reasons: Reason[];
  rule_violations: string[];
  adaptive: AdaptivePlan | null;
  soil_projection: SoilProjection;
  irrigation: IrrigationPlan;
}

export interface RankedRow {
  rank: number;
  slots: string[];
  overall: number;
  worst_case: number;
  max_regret: number;
  win_rate_vs_current: number;
  water: number;
  soil: number;
  risk: number;
  income: number;
  shown_as: string | null;
}

export interface WhyLost {
  rotation_id: string;
  behind_by: number;
  average_score_gap: number;
  ranking_mode: RankingMode;
  criteria_vs_winner: Record<Criterion, number>;
  weakest_criterion: Criterion;
  strongest_criterion: Criterion;
  priority_change: {
    found: boolean;
    dominated: boolean;
    text: string;
    criterion?: Criterion;
    shift?: number;
    new_weights?: Record<Criterion, number>;
    old_weights?: Record<Criterion, number>;
  };
  rainfall_change: { found: boolean; text: string; factor?: number; change_pct?: number; tested_range_pct: number[] };
  summary: string;
}

export interface FeasibilityCheck {
  name: string;
  passed: boolean;
  text: string;
  value: number | null;
  limit: string | null;
}

export interface Feasibility {
  crop_id: string;
  season: "main" | "off";
  feasible: boolean;
  checks: FeasibilityCheck[];
}

export interface CropBrief {
  id: string;
  name: Record<string, string>;
  family: string;
  seasons: string[];
  duration_days: number;
  income_band: number;
  n_fixing: boolean;
  deep_taproot: boolean;
}

export interface BacktestSeason {
  kind: string;
  n_years: number;
  available: boolean;
  reason?: string;
  pearson_r?: number;
  pearson_p?: number;
  spearman_rho?: number;
  spearman_p?: number;
  rain_vs_ndvi_r?: number;
  strength?: string;
  direction_as_expected?: boolean;
  points?: { year: number; water_satisfaction: number; ndvi: number; ndvi_anomaly: number }[];
  text?: string;
}

export interface Backtest {
  available: boolean;
  status?: string;
  reason?: string;
  method?: string;
  seasons: Record<string, BacktestSeason>;
  caveats: string[];
  cropping_intensity: { available: boolean; text?: string; median_cycles_per_year?: number; per_year?: { year: number; cycles: number }[] };
  ndvi_record?: { start: string; end: string; composites: number };
  ndvi_series?: { date: string; ndvi: number }[];
  progress?: { done: number; total: number } | null;
}

export interface Plan {
  plan_id: string;
  generated_at: string;
  lang: Lang;
  request: PlanRequest;
  location: { lat: number; lon: number; elevation_m: number | null; is_pilot: boolean };
  season_plan: SeasonPlan;
  soil: SoilOut;
  settings: {
    water_source: WaterSource;
    drainage: string;
    drainage_source: string;
    ranking_mode: RankingMode;
    weights: Record<Criterion, number>;
  };
  years: number[];
  crops: CropBrief[];
  feasibility: Feasibility[];
  enumeration: {
    main_season_crops: number;
    off_season_crops: number;
    year_pairs: number;
    cycles_before_rules: number;
    after_family_gap_rule: number;
    after_legume_and_taproot_rules: number;
    valid_rotations: number;
    replayed: number;
    current_rank: number;
    feasible_main: string[];
    feasible_off: string[];
  };
  winner_id: string | null;
  rotations: Rotation[];
  ranking: RankedRow[];
  why_it_lost: WhyLost[];
  backtest: Backtest;
  sources: SourceStatus[];
  weather_quality: Record<string, unknown>;
  gaps: string[];
  disclaimer: string;
  timing_s: number;
}

export interface Vital {
  value: number | null;
  unit: string;
  date: string;
  badge: Badge;
}

export interface DroughtStatus {
  level: "normal" | "watch" | "warning" | "alert";
  points: number;
  flash_drought_criterion_met: boolean;
  headline: string;
  reasons: string[];
  signals: Record<string, { value: number; date: string; badge: Badge; [key: string]: unknown }>;
  vitals: Record<string, Vital>;
  series: { date: string; wetness: number | null; percentile: number | null; stress: number | null; rain: number | null; tmax: number | null }[];
  as_of: string;
  root_zone_source: { source: string; label: string; kind: string; fallback: boolean; fallback_reason?: string };
  method: string;
  field_memory: {
    available: boolean;
    current_year: number;
    weekly: { week: number; p10: number; p50: number; p90: number; current: number | null }[];
    yearly: { year: number; mean: number; min: number }[];
    driest_years: number[];
    record: { start: string; end: string };
  };
  sources: Record<string, Record<string, unknown>>;
}

export interface CropFull extends CropBrief {
  t_base_c: number;
  gdd_need: number;
  t_mean_range_c: number[];
  heat_limit_c: number;
  water_need_mm: number[];
  kc: number[];
  root_depth_m: number;
  depletion_p: number;
  ky: number;
  paddy: boolean;
  salinity_threshold_ds_m: number;
  ph_range: number[];
  heat_tolerance: number;
  drought_tolerance: number;
  waterlogging_tolerance: number;
  n_credit_kg_ha: number;
  n_demand_kg_ha: number;
  residue_cover: number;
  residue_c_t_ha: number;
  rest_years: number;
  sources: Record<string, string>;
  verify: string[];
}

export interface AdvisorAnswer {
  answer: string;
  mode: "llm" | "rules";
  model?: string | null;
  tools_used: string[];
  note?: string | null;
}
