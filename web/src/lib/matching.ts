export interface MatchCheck {
  earth_id: string; planetary_id: string; candidate_rank: number;
  evidence_status: 'literature_informed_proposal' | 'exploratory_terrain_only';
  scientifically_validated: false; validated_accuracy_percent: null;
  /** Half landform-family agreement, half terrain similarity; the score candidates are ranked by. */
  analog_score_percent?: number | null; landform_match_percent?: number;
  landform?: { earth_family: string | null; planetary_family: string | null; relation: 'same_family' | 'related_family' | 'different_family' | 'unknown'; status?: string };
  terrain_similarity_percent: number | null; environment_similarity_percent: number | null;
  total_similarity_percent: number | null; total_reason: string; evidence_coverage_percent: number;
  verification: { input_hashes_checked: boolean; catalog_features_reproduced: boolean;
    window_sensitivity: string; terrain_range_percent: [number | null, number | null] };
  environment_features: { property: string; similarity_percent: number | null; status: string; reason: string }[];
  atmosphere: { earth: string; planetary: string; reason: string; source_url: string };
  geology: { earth_morphology: string; planetary_morphology: string; earth_substrate: string; planetary_substrate: string };
}
export interface AnalogMatching { method_version: string; ranking_method: string; comparisons: MatchCheck[];
  selection?: { min_exploratory_score_percent?: number;
    screening?: { earth_id: string; planetary_id: string; status: string; central_upper_bound_percent: number | null }[] } }
/** Earth locations left off a target's list because their analog score is below the pipeline cutoff. */
export function hiddenBelowCutoff(matching: AnalogMatching | undefined, targetId: string): { count: number; cutoff: number } | null {
  const cutoff = matching?.selection?.min_exploratory_score_percent;
  if (typeof cutoff !== 'number') return null;
  const count = (matching!.selection!.screening ?? []).filter(s => s.planetary_id === targetId && s.status === 'filtered'
    && typeof s.central_upper_bound_percent === 'number' && s.central_upper_bound_percent < cutoff).length;
  return { count, cutoff };
}
export const LANDFORM_RELATION: Record<string, string> = { same_family: 'Same landform type', related_family: 'Related landform type', different_family: 'Different landform type', unknown: 'Landform type unknown' };
export const percent = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Not established';
