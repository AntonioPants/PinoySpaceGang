/**
 * Landing gear: what the legs can absorb and when the vehicle goes over.
 *
 * Two questions are answered from the gear's dimensions instead of fixed limits:
 *
 *  1. Does the stroke absorb the sink rate? The legs can dissipate
 *        E_max = m · a_limit · stroke · damping
 *     against a vertical kinetic energy E_kin = ½ m v_z², so the largest sink rate they take is
 *        v_max = √(2 · a_limit · stroke · damping)
 *     (the mass cancels: a_limit is the deceleration the vehicle is built to take, and the crush
 *     force of the legs is sized to it).
 *
 *  2. Does the vehicle stay on its feet? It tips about the downhill edge of its support polygon.
 *     For N legs on a foot circle of radius R that edge is R·cos(π/N) from the centre, so with the
 *     centre of mass h above the feet the static tip angle is
 *        θ_tip = atan(R·cos(π/N) / h)
 *     Ground slope and the vehicle's own tilt at contact use up part of that angle. What is left
 *     is an energy barrier: the centre of mass has to be lifted L·(1 − cos(θ_tip − θ_ground)) to
 *     pass over the feet (L = distance from the pivot to the centre of mass). Three things lift it:
 *       - the lateral speed at contact, turned about the pivot;
 *       - the part of the sink energy the dampers give back as rebound on sloping ground;
 *       - the slap-down: a level vehicle meets a slope uphill feet first and swings down onto the
 *         rest, its centre of mass dropping R·cos(π/N)·sin(slope). The dampers take their share
 *         and the rest carries it on downhill. This one does not depend on speed, so even a
 *         perfectly gentle touchdown goes over on ground steep enough.
 *     The first two are bought with speed against gravity, so low gravity makes them cheap: a
 *     touchdown that stays upright on Earth can go over on the Moon.
 *
 * The first three presets are prototype values for this simulator; the rest follow gear that flew
 * on real landers, with approximate figures. None are measured hardware.
 */
import type { LandingGearConfig } from './types.ts';

/** Deceleration the vehicle and its legs are rated for at touchdown, m/s² (about 1.5 Earth g). */
export const GEAR_DECEL_LIMIT = 15;
/** Height of the hull's centre of mass above the feet with the legs fully compressed, m. */
export const HULL_CG_HEIGHT_M = 2.1;
/** Touchdown the dynamic slope figure is quoted for: 0.6 m/s sideways, 1.5 m/s down, vehicle level. */
export const RATING_TOUCHDOWN = { lateralMps: 0.6, sinkMps: 1.5 };

export const GEAR_TUNING = { strokeM: { min: 0.3, max: 0.8 }, dampingRatio: { min: 0.3, max: 0.95 } };

export type GearPresetId = 'standard-four' | 'wide-four' | 'survey-six' | 'apollo-four' | 'surveyor-three' | 'change-four' | 'vikram-four' | 'slim-five' | 'nova-six' | 'viking-three';

/**
 * The three gear options. `slopeRatingDeg` is the slope guidance treats as the limit when it
 * chooses where to land; whether a touchdown actually stays upright is decided by the dynamics.
 */
export const GEAR_PRESETS: Record<GearPresetId, LandingGearConfig & { slopeRatingDeg: number }> = {
  // balanced: the reference gear
  'standard-four': { gearId: 'standard-four', legs: 4, radiusM: 3.0, strokeM: 0.45, dampingRatio: 0.65, gearMassKg: 75, padRadiusM: 0.42, slopeRatingDeg: 12 },
  // wide stance for slopes: a shorter stroke, and a footprint that spans more uneven ground
  'wide-four': { gearId: 'wide-four', legs: 4, radiusM: 3.8, strokeM: 0.4, dampingRatio: 0.7, gearMassKg: 110, padRadiusM: 0.55, slopeRatingDeg: 16 },
  // six long-stroke legs for hard, rough touchdowns: the heaviest
  'survey-six': { gearId: 'survey-six', legs: 6, radiusM: 3.3, strokeM: 0.6, dampingRatio: 0.7, gearMassKg: 135, padRadiusM: 0.5, slopeRatingDeg: 14 },
  // After gear that flew. Approximate figures that keep each design's character; the same
  // formulas above decide what they absorb and when they tip.
  // Apollo LM: four cantilevered legs with crushable aluminium honeycomb struts (about 0.8 m of
  // stroke, almost no rebound) on a wide stance, rated for a 12° slope. Heavy.
  'apollo-four': { gearId: 'apollo-four', legs: 4, radiusM: 4.6, strokeM: 0.8, dampingRatio: 0.9, gearMassKg: 260, padRadiusM: 0.47, slopeRatingDeg: 12 },
  // Surveyor: three legs with hydraulic shock absorbers and crushable blocks. Light, but a tripod's
  // support edge sits only half its radius from the centre, so it tips more easily.
  'surveyor-three': { gearId: 'surveyor-three', legs: 3, radiusM: 2.6, strokeM: 0.3, dampingRatio: 0.75, gearMassKg: 30, padRadiusM: 0.2, slopeRatingDeg: 10 },
  // Chang'e 3/4: four legs with buffer struts and large round pads for soft ground.
  'change-four': { gearId: 'change-four', legs: 4, radiusM: 2.9, strokeM: 0.5, dampingRatio: 0.8, gearMassKg: 120, padRadiusM: 0.55, slopeRatingDeg: 14 },
  // Chandrayaan-3: four legs strengthened after Chandrayaan-2 to take about 3 m/s.
  'vikram-four': { gearId: 'vikram-four', legs: 4, radiusM: 2.7, strokeM: 0.55, dampingRatio: 0.7, gearMassKg: 100, padRadiusM: 0.4, slopeRatingDeg: 12 },
  // SLIM: five short legs with 3D-printed lattice crush pads that absorb and do not rebound.
  'slim-five': { gearId: 'slim-five', legs: 5, radiusM: 2.4, strokeM: 0.3, dampingRatio: 0.95, gearMassKg: 20, padRadiusM: 0.22, slopeRatingDeg: 15 },
  // Nova-C: six slim legs. Light, with little stroke: IM-1 caught a foot and tipped when it
  // touched down with sideways speed.
  'nova-six': { gearId: 'nova-six', legs: 6, radiusM: 2.7, strokeM: 0.35, dampingRatio: 0.6, gearMassKg: 70, padRadiusM: 0.3, slopeRatingDeg: 10 },
  // Viking and Phoenix: three legs with crushable honeycomb inserts, for Mars.
  'viking-three': { gearId: 'viking-three', legs: 3, radiusM: 2.8, strokeM: 0.4, dampingRatio: 0.9, gearMassKg: 55, padRadiusM: 0.3, slopeRatingDeg: 12 },
};

export function isGearPreset(id: unknown): id is GearPresetId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(GEAR_PRESETS, id);
}

/** A preset, optionally with its stroke and damping trimmed (which makes it a 'custom' gear). */
export function gearConfig(id: GearPresetId, trim: { strokeM?: number; dampingRatio?: number } = {}): LandingGearConfig {
  const { slopeRatingDeg: _rating, ...preset } = GEAR_PRESETS[id];
  const strokeM = trim.strokeM ?? preset.strokeM, dampingRatio = trim.dampingRatio ?? preset.dampingRatio;
  const trimmed = strokeM !== preset.strokeM || dampingRatio !== preset.dampingRatio;
  return { ...preset, strokeM, dampingRatio, gearId: trimmed ? 'custom' : preset.gearId };
}

export function validateGear(g: LandingGearConfig): string[] {
  const errors: string[] = [];
  const within = (name: string, v: number, lo: number, hi: number) => { if (!Number.isFinite(v) || v < lo || v > hi) errors.push(`gear ${name} must be between ${lo} and ${hi}.`); };
  if (!Number.isInteger(g.legs) || g.legs < 3 || g.legs > 8) errors.push('gear legs must be a whole number from 3 to 8.');
  within('radiusM', g.radiusM, 1, 8); within('strokeM', g.strokeM, 0.1, 1.5); within('dampingRatio', g.dampingRatio, 0.05, 1);
  within('gearMassKg', g.gearMassKg, 0, 1000); within('padRadiusM', g.padRadiusM, 0.05, 2);
  return errors;
}

export interface GearCapability {
  /** Largest sink rate the stroke absorbs, m/s. */
  maxSinkMps: number;
  /** Centre to the nearest edge of the support polygon, m. */
  supportRadiusM: number;
  /** Centre of mass above the feet, m: longer-stroke legs stand the hull higher. */
  cgHeightM: number;
  /** Lean at which the centre of mass passes over the feet with the vehicle at rest, degrees. */
  staticTipDeg: number;
  /** Relief between the feet (rocks, rims) the legs and pads take up, m. */
  roughnessToleranceM: number;
}

/** What a gear can take, from its dimensions alone. `hullCgHeightM` defaults to HULL_CG_HEIGHT_M. */
export function gearCapability(g: LandingGearConfig, hullCgHeightM = HULL_CG_HEIGHT_M): GearCapability {
  const supportRadiusM = g.radiusM * Math.cos(Math.PI / g.legs);
  // the legs carry the hull two strokes up: one of travel, one of clearance below the engine bell
  const cgHeightM = hullCgHeightM + 2 * g.strokeM;
  return {
    maxSinkMps: Math.sqrt(2 * GEAR_DECEL_LIMIT * g.strokeM * g.dampingRatio),
    supportRadiusM, cgHeightM,
    staticTipDeg: deg(Math.atan(supportRadiusM / cgHeightM)),
    // Stroke evens out legs standing at different heights and a wide pad bridges a rock; six legs
    // share the load, so one leg on a boulder matters less.
    roughnessToleranceM: (0.6 * g.strokeM + 0.55 * g.padRadiusM) * (g.legs >= 6 ? 1.1 : 1),
  };
}

export interface GearContact { verticalSpeedMps: number; horizontalSpeedMps: number; slopeDeg: number; tiltDeg: number }

export interface GearTouchdown {
  strokeM: number;
  /** How far the legs compressed, m (equal to the stroke when they bottomed out). */
  strokeUsedM: number;
  /** strokeUsedM / strokeM before clamping: above 1 the gear bottomed out. */
  strokeRatio: number;
  maxSinkMps: number;
  staticTipDeg: number;
  /** Ground slope plus body tilt at contact, degrees: the lean the vehicle starts with. */
  groundLeanDeg: number;
  /** Furthest the centre of mass leaned before settling, degrees (the tip angle if it went over). */
  peakLeanDeg: number;
  /** staticTipDeg − peakLeanDeg: how close it came to going over. 0 when it tipped. */
  tipMarginDeg: number;
  /** Energy driving the tip ÷ energy needed to go over (≥ 1 tips). */
  tipRatio: number;
  tipped: boolean;
}

/** How the gear fared at a touchdown: stroke used and how close the vehicle came to tipping. */
export function gearTouchdown(g: LandingGearConfig, c: GearContact, gravity: number, hullCgHeightM = HULL_CG_HEIGHT_M): GearTouchdown {
  const cap = gearCapability(g, hullCgHeightM);
  const strokeRatio = (c.verticalSpeedMps / cap.maxSinkMps) ** 2;   // E_kin / E_max
  // Worst case: the vehicle leans the same way the ground falls.
  const groundLeanDeg = c.slopeDeg + c.tiltDeg, ground = rad(groundLeanDeg), tip = rad(cap.staticTipDeg);
  const arm = Math.hypot(cap.supportRadiusM, cap.cgHeightM);
  const spare = tip - ground;
  // Height the centre of mass can climb: lateral speed turned about the pivot and rebound
  // downslope (both against gravity), plus what is left of the slap-down onto the slope.
  const pivotSpeed = c.horizontalSpeedMps * cap.cgHeightM / arm;
  const rebound = (1 - g.dampingRatio) * c.verticalSpeedMps ** 2 * Math.sin(Math.max(ground, 0));
  const slapDown = (1 - g.dampingRatio) * cap.supportRadiusM * Math.sin(rad(Math.max(c.slopeDeg, 0)));
  const climb = (pivotSpeed ** 2 + rebound) / (2 * Math.max(gravity, 1e-6)) + slapDown;
  const barrier = spare > 0 ? arm * (1 - Math.cos(spare)) : 0;
  const tipped = spare <= 0 || climb >= barrier;
  const swing = tipped ? Math.max(spare, 0) : spare - Math.acos(Math.min(1, Math.cos(spare) + climb / arm));
  const peakLeanDeg = tipped ? cap.staticTipDeg : groundLeanDeg + deg(swing);
  return {
    strokeM: g.strokeM, strokeUsedM: Math.min(1, strokeRatio) * g.strokeM, strokeRatio,
    maxSinkMps: cap.maxSinkMps, staticTipDeg: cap.staticTipDeg, groundLeanDeg, peakLeanDeg,
    tipMarginDeg: Math.max(0, cap.staticTipDeg - peakLeanDeg),
    tipRatio: spare <= 0 ? Infinity : climb / barrier, tipped,
  };
}

/**
 * Steepest ground the gear stays upright on at the rating touchdown (RATING_TOUCHDOWN) under
 * `gravity`, degrees. Found by bisection on the model above; lower gravity gives a lower angle.
 */
export function dynamicSlopeLimitDeg(g: LandingGearConfig, gravity: number, hullCgHeightM = HULL_CG_HEIGHT_M): number {
  const upright = (slopeDeg: number) => !gearTouchdown(g, { verticalSpeedMps: RATING_TOUCHDOWN.sinkMps, horizontalSpeedMps: RATING_TOUCHDOWN.lateralMps, slopeDeg, tiltDeg: 0 }, gravity, hullCgHeightM).tipped;
  if (!upright(0)) return 0;
  let lo = 0, hi = gearCapability(g, hullCgHeightM).staticTipDeg;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (upright(mid)) lo = mid; else hi = mid; }
  return lo;
}

const deg = (r: number) => r * 180 / Math.PI;
const rad = (d: number) => d * Math.PI / 180;
