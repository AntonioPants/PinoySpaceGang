import type { LandingGearConfig, Outcome, TouchdownLimits } from './types.ts';
import { gearTouchdown, type GearTouchdown } from './gear.ts';

export interface ContactConditions {
  verticalSpeedMps: number;
  horizontalSpeedMps: number;
  slopeDeg: number;
  roughnessM: number;
  tiltDeg: number;
}

export interface TouchdownResult {
  outcome: Exclude<Outcome, 'timeout'>;
  survivability: number;
  reasons: string[];
  /** Present when the touchdown was judged with a landing gear model. */
  gear?: GearTouchdown;
}

/** The gear the vehicle landed on, and what it landed in. */
export interface GearDynamics { gear: LandingGearConfig; gravity: number; hullCgHeightM?: number }

/**
 * Classifies a ground contact.
 *  - crash:        > 2x the sink-rate or lateral-speed limit
 *  - tip-over:     slope, tilt, rocks under a leg, or lateral speed over the limit
 *  - hard-landing: sink rate over the limit (gear damage, vehicle upright)
 *  - success:      everything within limits
 * Survivability is 100 while every quantity is under half its limit, falling to 0 at 2x.
 *
 * With `dynamics` (a landing gear model) the fixed slope, tilt and lateral-speed limits no longer
 * decide a tip-over. Instead:
 *  - hard-landing: the sink rate needs more stroke than the legs have (they bottom out)
 *  - crash:        more than 2x the sink rate the stroke absorbs (4x its energy), or > 2x the lateral limit
 *  - tip-over:     slope, tilt, lateral speed and rebound together carry the centre of mass past
 *                  the feet, or a rock or rim under a leg is more than the gear takes up
 */
export function evaluateTouchdown(c: ContactConditions, lim: TouchdownLimits, dynamics?: GearDynamics): TouchdownResult {
  if (dynamics) return evaluateWithGear(c, lim, dynamics);
  const ratios = {
    vertical: c.verticalSpeedMps / lim.maxVerticalMps,
    horizontal: c.horizontalSpeedMps / lim.maxHorizontalMps,
    slope: c.slopeDeg / lim.maxSlopeDeg,
    roughness: c.roughnessM / lim.maxRoughnessM,
    tilt: c.tiltDeg / lim.maxTiltDeg,
  };
  const worst = Math.max(...Object.values(ratios));
  let survivability = 100 * clamp(1 - (worst - 0.5) / 1.5, 0, 1);

  const reasons: string[] = [];
  const f = (v: number) => v.toFixed(2);
  if (ratios.vertical > 1) reasons.push(`sink rate ${f(c.verticalSpeedMps)} m/s > ${lim.maxVerticalMps} m/s`);
  if (ratios.horizontal > 1)
    reasons.push(`lateral speed ${f(c.horizontalSpeedMps)} m/s > ${lim.maxHorizontalMps} m/s`);
  if (ratios.slope > 1) reasons.push(`ground slope ${c.slopeDeg.toFixed(1)}° > ${lim.maxSlopeDeg}°`);
  if (ratios.roughness > 1)
    reasons.push(`rock/rim under a leg (${f(c.roughnessM)} m > ${lim.maxRoughnessM} m)`);
  if (ratios.tilt > 1) reasons.push(`body tilt ${c.tiltDeg.toFixed(1)}° > ${lim.maxTiltDeg}°`);

  let outcome: TouchdownResult['outcome'];
  if (ratios.vertical > 2 || ratios.horizontal > 2) {
    outcome = 'crash';
    survivability = 0;
  } else if (ratios.slope > 1 || ratios.tilt > 1 || ratios.roughness > 1 || ratios.horizontal > 1) {
    outcome = 'tip-over';
    survivability = Math.min(survivability, 40);
  } else if (ratios.vertical > 1) {
    outcome = 'hard-landing';
    survivability = Math.min(survivability, 70);
  } else {
    outcome = 'success';
  }
  return { outcome, survivability: Math.round(survivability), reasons };
}

function evaluateWithGear(c: ContactConditions, lim: TouchdownLimits, { gear, gravity, hullCgHeightM }: GearDynamics): TouchdownResult {
  const g = gearTouchdown(gear, c, gravity, hullCgHeightM);
  const ratios = {
    vertical: c.verticalSpeedMps / g.maxSinkMps,
    horizontal: c.horizontalSpeedMps / lim.maxHorizontalMps,
    roughness: c.roughnessM / lim.maxRoughnessM,
    // lean as a share of the tip angle; past 1 by how much energy was left over once it went
    stability: g.tipped ? 1 + Math.min(1, Number.isFinite(g.tipRatio) ? g.tipRatio - 1 : 1) : g.peakLeanDeg / g.staticTipDeg,
  };
  // Lateral speed is already in the stability figure; on its own it only matters as a crash.
  const worst = Math.max(ratios.vertical, ratios.roughness, ratios.stability);
  let survivability = 100 * clamp(1 - (worst - 0.5) / 1.5, 0, 1);
  const reasons: string[] = [];
  const f = (v: number) => v.toFixed(2);
  if (ratios.vertical > 1)
    reasons.push(`leg stroke bottomed out at ${f(gear.strokeM)} m: ${f(c.verticalSpeedMps)} m/s sink rate exceeded the ${f(g.maxSinkMps)} m/s the shock absorbers take`);
  if (ratios.horizontal > 2) reasons.push(`lateral speed ${f(c.horizontalSpeedMps)} m/s > ${f(2 * lim.maxHorizontalMps)} m/s: the legs gave way sideways`);
  if (g.tipped) {
    const parts = [`${c.slopeDeg.toFixed(1)}° slope`, c.tiltDeg >= 0.5 ? `${c.tiltDeg.toFixed(1)}° body tilt` : '', c.horizontalSpeedMps >= 0.05 ? `${f(c.horizontalSpeedMps)} m/s lateral speed` : ''].filter(Boolean);
    reasons.push(`tipped over: ${parts.join(' + ')} carried the centre of mass past the feet (${gear.legs} legs on a ${gear.radiusM.toFixed(1)} m stance tip at ${g.staticTipDeg.toFixed(1)}°)`);
  }
  if (ratios.roughness > 1) reasons.push(`rock/rim under a leg (${f(c.roughnessM)} m > ${f(lim.maxRoughnessM)} m the gear takes up)`);

  let outcome: TouchdownResult['outcome'];
  if (ratios.vertical > 2 || ratios.horizontal > 2) {
    outcome = 'crash';
    survivability = 0;
  } else if (g.tipped || ratios.roughness > 1) {
    outcome = 'tip-over';
    survivability = Math.min(survivability, 40);
  } else if (ratios.vertical > 1) {
    outcome = 'hard-landing';
    survivability = Math.min(survivability, 70);
  } else {
    outcome = 'success';
  }
  return { outcome, survivability: Math.round(survivability), reasons, gear: g };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
