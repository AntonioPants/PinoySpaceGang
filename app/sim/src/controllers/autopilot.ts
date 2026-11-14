import type { Controls, Observation, Vec2 } from '../types.ts';
import type { Controller, ControllerContext } from '../engine.ts';
import { DEG } from '../constants.ts';
import { roughnessAt, slopeDegAt, type HeightField } from '../terrain.ts';

export interface AutopilotOptions {
  /** Scan for and divert around hazards (needs a hazard sensor). */
  hazardAvoidance?: boolean;
  /** Height above ground at which the hazard scan runs (ALHAT-style). */
  scanAltitudeM?: number;
  /** How far from the aim point a divert may go. */
  divertRadiusM?: number;
  /** Below this height: hover-and-translate gate, then constant slow sink. */
  terminalAltitudeM?: number;
  terminalRateMps?: number;
  /** Max tilt guidance will command while flying (and near the ground). */
  maxGuidanceTiltDeg?: number;
}

/**
 * Simplified powered-descent guidance, loosely after Apollo P63 (braking) / P64 (approach) /
 * P66 (vertical descent):
 *  - vertical: track a "constant-deceleration" sink-rate profile down to the terminal gate,
 *  - horizontal: fly a velocity that brakes to zero exactly over the aim point,
 *  - terminal: hover until centred over the aim point, then sink at terminalRate,
 *  - hazard avoidance: one scan at scanAltitude (slope + roughness over the footprint),
 *    divert to the best safe spot within the divert radius.
 */
export function autopilot(opts: AutopilotOptions = {}): Controller {
  const scanAlt = opts.scanAltitudeM ?? 250;
  const divertR = opts.divertRadiusM ?? 120;
  const termAlt = opts.terminalAltitudeM ?? 15;
  const termRate = opts.terminalRateMps ?? 1.0;
  const maxTilt = (opts.maxGuidanceTiltDeg ?? 25) * DEG;
  let scanned = false;

  return {
    update(obs: Observation, ctx: ControllerContext): Controls {
      const { gravity: g, lander } = ctx;
      const maxAcc = lander.maxThrustN / obs.massKg;
      const h = obs.altitudeAGL;

      if (opts.hazardAvoidance && !scanned && ctx.hazardView && h <= scanAlt) {
        scanned = true;
        const pick = scanForLandingSite(ctx.hazardView, ctx.aim, divertR, lander.legRadiusM, lander.limits);
        if (!pick.aimSafe) {
          ctx.emit({ type: 'hazardDetected', t: obs.t, at: { ...ctx.aim }, slopeDeg: pick.aimSlope, roughnessM: pick.aimRough });
          if (pick.best) {
            ctx.emit({
              type: 'divert',
              t: obs.t,
              from: { ...ctx.aim },
              to: pick.best,
              distanceM: Math.hypot(pick.best.x - ctx.aim.x, pick.best.y - ctx.aim.y),
            });
            ctx.setAim(pick.best);
          }
        }
      }

      // ---- horizontal ---------------------------------------------------------
      const ex = ctx.aim.x - obs.position.x;
      const ey = ctx.aim.y - obs.position.y;
      const dist = Math.hypot(ex, ey);
      const vhx = obs.velocity.x;
      const vhy = obs.velocity.y;
      const aHBrake = 0.35 * Math.max(maxAcc - g, 0.5);
      const vhMax = h > termAlt ? 30 : 3;
      const vhDes = Math.min(vhMax, Math.sqrt(2 * aHBrake * dist), 0.4 * dist);
      const ux = dist > 1e-6 ? ex / dist : 0;
      const uy = dist > 1e-6 ? ey / dist : 0;
      const kv = 0.6;
      let ahx = kv * (vhDes * ux - vhx);
      let ahy = kv * (vhDes * uy - vhy);

      // ---- vertical ------------------------------------------------------------
      const vz = obs.velocity.z;
      const aVBrake = 0.5 * Math.max(maxAcc - g, 0.3);
      const vhErr = Math.hypot(vhDes * ux - vhx, vhDes * uy - vhy);
      let vzDes: number;
      if (h > termAlt) {
        vzDes = -(Math.min(40, Math.sqrt(2 * aVBrake * (h - termAlt))) + termRate);
      } else if (dist > 2 || Math.hypot(vhx, vhy) > 0.4 || vhErr > 0.4) {
        // hover & translate (P66): hold height above the *ground* so rising terrain can't catch us
        vzDes = Math.max(-1.5, Math.min(2, 0.6 * (0.7 * termAlt - h)));
      } else {
        vzDes = -termRate;
      }
      const kz = 1.2;
      let az = g + kz * (vzDes - vz);

      // engine off while falling well clear of the ground and below the profile
      if (az <= 0.05 * g && h > 60) return { throttle: 0, tiltX: 0, tiltY: 0 };
      az = Math.max(az, 0.05 * g);

      // limit tilt (tighter close to the ground so the lander touches down upright)
      const tiltLim = h < 6 ? Math.min(maxTilt, 4 * DEG) : maxTilt;
      const ah = Math.hypot(ahx, ahy);
      const ahMax = az * Math.tan(tiltLim);
      if (ah > ahMax) {
        ahx *= ahMax / ah;
        ahy *= ahMax / ah;
      }
      const aTot = Math.hypot(ahx, ahy, az);
      return {
        throttle: Math.min(1, (aTot * obs.massKg) / lander.maxThrustN),
        tiltX: Math.atan2(ahx, az),
        tiltY: Math.atan2(ahy, az),
      };
    },
  };
}

export interface ScanResult {
  aimSafe: boolean;
  aimSlope: number;
  aimRough: number;
  best?: Vec2;
}

/** Scores candidate spots on a grid around the aim point; lower is better. */
export function scanForLandingSite(
  view: HeightField,
  aim: Vec2,
  radiusM: number,
  legR: number,
  limits: { maxSlopeDeg: number; maxRoughnessM: number },
  stepM = 4,
): ScanResult {
  // Evaluate the footprint plus a small margin ring for guidance dispersion.
  const assess = (x: number, y: number) => {
    let slope = 0;
    let rough = 0;
    for (const [dx, dy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
      slope = Math.max(slope, slopeDegAt(view, x + dx, y + dy, legR));
      rough = Math.max(rough, roughnessAt(view, x + dx, y + dy, legR));
    }
    return { slope, rough };
  };
  const safe = (a: { slope: number; rough: number }) =>
    a.slope < 0.7 * limits.maxSlopeDeg && a.rough < 0.6 * limits.maxRoughnessM;

  const here = assess(aim.x, aim.y);
  if (safe(here)) return { aimSafe: true, aimSlope: here.slope, aimRough: here.rough };

  let best: Vec2 | undefined;
  let bestScore = Infinity;
  for (let dy = -radiusM; dy <= radiusM; dy += stepM) {
    for (let dx = -radiusM; dx <= radiusM; dx += stepM) {
      const d = Math.hypot(dx, dy);
      if (d > radiusM) continue;
      const a = assess(aim.x + dx, aim.y + dy);
      if (!safe(a)) continue;
      const score = a.slope / limits.maxSlopeDeg + a.rough / limits.maxRoughnessM + (0.5 * d) / radiusM;
      if (score < bestScore) {
        bestScore = score;
        best = { x: aim.x + dx, y: aim.y + dy };
      }
    }
  }
  return { aimSafe: false, aimSlope: here.slope, aimRough: here.rough, best };
}
