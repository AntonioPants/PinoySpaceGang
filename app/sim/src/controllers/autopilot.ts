import type { Controls, Observation, Vec2 } from '../types.ts';
import type { Controller, ControllerContext } from '../engine.ts';
import { DEG } from '../constants.ts';
import { roughnessAt, slopeDegAt } from '../terrain.ts';
import type { HazardField } from '../surface.ts';

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
  // Navigation filter state (alpha-beta filter): guidance flies on these, not on raw readings,
  // so plume dust (noisy readings, dropouts) doesn't make it chase noise into the ground.
  let est: { h: number; vx: number; vy: number; vz: number } | null = null;

  return {
    update(raw: Observation, ctx: ControllerContext): Controls {
      const { gravity: g, lander, dt } = ctx;
      if (!est) est = { h: raw.altitudeAGL, vx: raw.velocity.x, vy: raw.velocity.y, vz: raw.velocity.z };
      else {
        if (raw.velocimeterValid) {
          const b = 0.08;
          est.vx += b * (raw.velocity.x - est.vx);
          est.vy += b * (raw.velocity.y - est.vy);
          est.vz += b * (raw.velocity.z - est.vz);
        }
        est.h += est.vz * dt; // dead-reckon between altimeter fixes
        if (raw.altimeterValid) est.h += 0.04 * (raw.altitudeAGL - est.h);
      }
      const obs: Observation = { ...raw, altitudeAGL: Math.max(0, est.h), velocity: { x: est.vx, y: est.vy, z: est.vz } };
      const maxAcc = lander.maxThrustN / obs.massKg;
      // Terrain look-ahead: measure height above the highest ground between here and the aim
      // point (within the next few seconds of travel), so a crater wall or ridge on the way in
      // is cleared instead of being flown into. Needs a terrain sensor.
      let rise = 0;
      if (ctx.hazardView) {
        const view = ctx.hazardView;
        const px = obs.position.x;
        const py = obs.position.y;
        const toAim = Math.hypot(ctx.aim.x - px, ctx.aim.y - py);
        const reach = Math.min(toAim, Math.hypot(est.vx, est.vy) * 10 + 30);
        if (toAim > 1) {
          const here = view.heightAt(px, py);
          const dx = (ctx.aim.x - px) / toAim;
          const dy = (ctx.aim.y - py) / toAim;
          for (let d = 10; d <= reach; d += 10) rise = Math.max(rise, view.heightAt(px + dx * d, py + dy * d) - here);
        }
      }
      const h = Math.max(0, obs.altitudeAGL - rise);

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
        vzDes = Math.max(-1.5, Math.min(8, 0.6 * (0.7 * termAlt - h)));
      } else {
        vzDes = -termRate;
      }
      const kz = 1.2;
      let az = g + kz * (vzDes - vz);

      // limit tilt: steep while braking high up (as real landers pitch over), moderate lower down,
      // and tight close to the ground so the lander touches down upright
      const tiltLim = h < 6 ? Math.min(maxTilt, 4 * DEG) : h > 150 ? Math.max(maxTilt, 45 * DEG) : maxTilt;
      const ah = Math.hypot(ahx, ahy);

      // engine off while falling well clear of the ground, below the profile, with no
      // sideways braking due
      if (az <= 0.05 * g && h > 60 && ah < 0.3) return { throttle: 0, tiltX: 0, tiltY: 0 };
      az = Math.max(az, 0.05 * g);
      // Sideways thrust only comes from tilting the main engine, so braking laterally needs
      // vertical thrust to tilt against: burn harder rather than overshoot the target. The extra
      // burn may slow the descent to a gentle sink but never turn it into a climb, which a
      // light, high-thrust vehicle would otherwise do.
      if (h > termAlt) {
        const holdSink = g + kz * (-2 - vz);            // thrust that settles at 2 m/s sink
        az = Math.max(az, Math.min(ah / Math.tan(tiltLim), 0.8 * maxAcc, Math.max(holdSink, 0.05 * g)));
      }
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
  view: HazardField,
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
    // lidar/camera point clouds resolve individual boulders the DEM can't
    if (view.obstacleWithin) rough = Math.max(rough, view.obstacleWithin(x, y, legR + 3));
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
