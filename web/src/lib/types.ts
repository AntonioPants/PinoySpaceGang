export type Body = 'Moon' | 'Mars';
export interface PlanetarySite {
  id: string; name: string; body: Body; region: string;
  lat: number; lon: number; gravity: number; description: string;
  interests: string[]; source: string;
}
export interface AnalogSite {
  id: string; name: string; region: string; lat: number; lon: number;
  available: boolean; description: string;
  /** Folder of the site's terrain pack, e.g. /terrain/amboy/ (absent when no pack exists). */
  terrainBase?: string; morphology?: string; substrate?: string; evidenceUrl?: string; reliefM?: number;
  manifestUrl?: string; matches: string[];
}
export interface TerrainManifest {
  schema_version: number; id: string; name: string; body: string;
  grid: { rows: number; columns: number; spacing_m: number; width_m: number; depth_m: number; dtype: string; byte_order: string; sample_file: string };
  local_frame: { vertical_offset_m: number };
  /** Kilbourne v1 packs carry statistics and analog evidence; catalog packs carry only a source. */
  statistics?: { relief_m: number; slope_p95_deg?: number };
  source: { dataset?: string; catalog?: string; sha256?: string; subset_sha256?: string; url?: string; vertical_datum: string };
  analog?: { basis: string; sources: string[] };
  license_url?: string;
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
  /** Terrain sensor used for hazard detection. */
  hazardSensor: 'lidar' | 'camera' | 'none';
  /** True: dust and glare come from the analog site's surface data; false: the manual sliders. */
  siteConditions: boolean;
  /** Earth field test only: 0 = manual wind; 1–12 = use the real weather profile for that month. */
  realWeatherMonth: number;
  weatherScenario: 'typical' | 'high_wind';
}
/** Proposed frontend handoff v1. Coordinate and unit conventions are explicit. */
export interface MissionConfig {
  /** Selected hardware. 'footprint' = the gear's drawn foot circle is used by the physics and nothing else about it is. */
  equipment?: { vehicleId: string; landingGearId: string; hazardSensor: MissionSettings['hazardSensor']; gearPhysics: 'pending' | 'footprint' };
  schemaVersion: '1.0.0'; createdAt: string;
  planetaryTarget: { id: string; name: string; body: Body; gravity: number };
  earthAnalog: {
    id: string; name: string; terrainBaseUrl: string; elevationProfile: number[];
    sampleSpacingM: number; profileRow: number; verticalOffsetM: number;
    sourceSha256: string;
    /** Where the player chose to land: x east, y north, metres from the patch centre. Absent = the centre. */
    landingTargetM?: { x: number; y: number };
  };
  strategy: { mode: MissionSettings['mode']; hazardSensor: MissionSettings['hazardSensor']; thrusterForceN: number; fuelMassKg: number; dryMassKg: number; maxSlopeToleranceDeg: number };
  environment: { mode: MissionSettings['environment']; gravityMs2: number; windSpeedMs: number; atmosphereModel: 'none' | 'earth-standard' | 'mars-constant'; dust: number; glare: number; interferenceSource: 'site' | 'manual';
    /** Set when an Earth field test uses a real modelled hour instead of the manual wind. */
    realWeather: { month: number; scenario: 'typical' | 'high_wind' } | null };
  /** quantitativeSimilarityScore is the catalog's terrain-descriptor score for a proposed pairing (0–1), else null. */
  evidence: { quantitativeSimilarityScore: number | null; analogFidelityScore: null; status: 'unvalidated-pair' | 'proposed-pair'; limitations: string[] };
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
