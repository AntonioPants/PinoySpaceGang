import { GEAR } from '../components/cutscene/lander';
import { GEAR_PRESETS, GEAR_TUNING, dynamicSlopeLimitDeg, gearCapability, gearConfig, isGearPreset, type GearPresetId } from '../../../app/sim/src/gear';
import type { LandingGearConfig } from '../../../app/sim/src/types';
import type { MissionConfig, MissionSettings } from './types';

export { GEAR_PRESETS, GEAR_TUNING, isGearPreset, type GearPresetId };

/**
 * Landing gear between the game and the physics.
 *
 * The player's choice lives in MissionSettings (landingGearId, plus an optional trim of stroke and
 * damping), so the equipment bay and the bridge edit the same thing. buildMission resolves it to a
 * LandingGearConfig in MissionConfig.strategy.landingGear, and the simulation models it: stroke and
 * damping set the sink rate the legs absorb, the stance and leg count set when the vehicle tips, the
 * pads and stroke set the relief it stands on, and its mass is added to the vehicle (app/sim/src/gear.ts).
 * The presets are prototype values, not measured hardware. Their stance, leg count and pad size are
 * the ones the lander is drawn with.
 */

/** Foot circle of a mission that names a gear but carries no gear model (older handoffs). */
export function gearFootprintM(mission: MissionConfig): number | undefined {
  const id = mission.equipment?.landingGearId;
  return id ? GEAR[id]?.radius : undefined;
}

/** The gear the settings describe, or undefined when no gear has been chosen. */
export function gearFromSettings(settings: MissionSettings): LandingGearConfig | undefined {
  if (!isGearPreset(settings.landingGearId)) return undefined;
  return gearConfig(settings.landingGearId, { strokeM: settings.gearStrokeM, dampingRatio: settings.gearDampingRatio });
}

/** Fit a gear preset: its own stroke and damping, and its slope rating as the slope guidance avoids. */
export function withGear(settings: MissionSettings, id: GearPresetId): MissionSettings {
  const preset = GEAR_PRESETS[id];
  return { ...settings, landingGearId: id, gearStrokeM: preset.strokeM, gearDampingRatio: preset.dampingRatio, maxSlopeToleranceDeg: preset.slopeRatingDeg };
}

export interface GearStats {
  /** Largest sink rate the stroke absorbs, m/s. */
  maxSinkMps: number;
  /** Lean at which the vehicle goes over at rest, degrees. */
  staticTipDeg: number;
  /** Steepest ground it stays upright on at a 0.6 m/s sideways, 1.5 m/s down touchdown in this gravity, degrees. */
  holdsSlopeDeg: number;
  /** Relief between the feet it takes up, m. */
  roughnessToleranceM: number;
}
export function gearStats(gear: LandingGearConfig, gravity: number): GearStats {
  const cap = gearCapability(gear);
  return { maxSinkMps: cap.maxSinkMps, staticTipDeg: cap.staticTipDeg, holdsSlopeDeg: dynamicSlopeLimitDeg(gear, gravity), roughnessToleranceM: cap.roughnessToleranceM };
}

/** One line of real figures for a gear option: "4 legs · 0.45 m stroke · 75 kg · rated 12° slope". */
export function gearDetail(id: GearPresetId): string {
  const g = GEAR_PRESETS[id];
  return `${g.legs} legs · ${g.strokeM.toFixed(2)} m stroke · ${g.gearMassKg} kg · rated ${g.slopeRatingDeg}° slope`;
}

export function validateGearSettings(s: MissionSettings): string[] {
  const errors: string[] = [];
  if (s.landingGearId !== undefined && !isGearPreset(s.landingGearId)) errors.push('Unknown landing gear.');
  const within = (key: 'gearStrokeM' | 'gearDampingRatio', range: { min: number; max: number }) => {
    const v = s[key]; if (v !== undefined && (!Number.isFinite(v) || v < range.min || v > range.max)) errors.push(`${key} is outside its supported range.`);
  };
  within('gearStrokeM', GEAR_TUNING.strokeM); within('gearDampingRatio', GEAR_TUNING.dampingRatio);
  return errors;
}
