export type Body = 'Moon' | 'Mars';
export interface PlanetarySite {
  id: string; name: string; body: Body; region: string;
  lat: number; lon: number; gravity: number; description: string;
  interests: string[]; source: string;
}
export interface AnalogSite {
  id: string; name: string; region: string; lat: number; lon: number;
  available: boolean; description: string;
  manifestUrl?: string; source?: string; matches: string[];
}
export interface TerrainManifest {
  schema_version: number; id: string; name: string; body: string;
  grid: { rows: number; columns: number; spacing_m: number; width_m: number; depth_m: number; dtype: string; byte_order: string; sample_file: string };
  local_frame: { vertical_offset_m: number };
  statistics: { relief_m: number; slope_p95_deg: number };
  source: { dataset: string; catalog: string; sha256: string; vertical_datum: string };
  analog?: { basis: string; sources: string[] };
  limitations: string[]; attribution: string;
}
export interface TerrainProfile {
  manifest: TerrainManifest;
  /** A west-to-east centre-row transect, relative to the pack's vertical offset. */
  heightsM: number[]; sampleSpacingM: number; row: number; buffer: ArrayBuffer;
  terrainBaseUrl?: string;
}
export interface MissionSettings {
  mode: 'MANUAL_CONTROL' | 'AUTONOMOUS_HAZARD_AVOID';
  environment: 'planetary' | 'earth';
  fuelMassKg: number; dryMassKg: number; thrusterForceN: number;
  maxSlopeToleranceDeg: number; windSpeedMs: number;
  dust: number; glare: number;
}
/** Proposed frontend handoff v1. Coordinate and unit conventions are explicit. */
export interface MissionConfig {
  schemaVersion: '1.0.0'; createdAt: string;
  planetaryTarget: { id: string; name: string; body: Body; gravity: number };
  earthAnalog: {
    id: string; name: string; terrainBaseUrl: string; elevationProfile: number[];
    sampleSpacingM: number; profileRow: number; verticalOffsetM: number;
    sourceSha256: string;
  };
  strategy: { mode: MissionSettings['mode']; thrusterForceN: number; fuelMassKg: number; dryMassKg: number; maxSlopeToleranceDeg: number };
  environment: { mode: MissionSettings['environment']; gravityMs2: number; windSpeedMs: number; atmosphereModel: 'none' | 'earth-standard' | 'mars-constant'; dust: number; glare: number };
  evidence: { quantitativeSimilarityScore: null; analogFidelityScore: null; status: 'unvalidated-pair'; limitations: string[] };
}
export interface SimulationResult {
  success: boolean; failureReason?: string;
  touchdownVerticalVelocityMs: number; touchdownHorizontalVelocityMs: number;
  landingSiteSlopeDeg: number; vehiclePitchDeg: number; fuelRemainingPercent: number;
  analogFidelityScore: number | null;
}
export interface SimulationProps { config: MissionConfig; onComplete: (result: SimulationResult) => void; onExit: () => void }
export interface ApproachCutsceneProps { config: MissionConfig; onComplete: () => void }
export interface OutcomeCutsceneProps { result: SimulationResult; onComplete: () => void }
