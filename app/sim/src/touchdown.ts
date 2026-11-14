import type { Outcome, TouchdownLimits } from './types.ts';

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
}

/**
 * Classifies a ground contact.
 *  - crash:        > 2x the sink-rate or lateral-speed limit
 *  - tip-over:     slope, tilt, rocks under a leg, or lateral speed over the limit
 *  - hard-landing: sink rate over the limit (gear damage, vehicle upright)
 *  - success:      everything within limits
 * Survivability is 100 while every quantity is under half its limit, falling to 0 at 2x.
 */
export function evaluateTouchdown(c: ContactConditions, lim: TouchdownLimits): TouchdownResult {
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

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
