/**
 * Post-flight assessment: turns one flight's telemetry into the numbers and findings a debrief
 * needs. Pure and read-only: it never re-flies anything and does not change the verdict made
 * by evaluateTouchdown(); it explains it.
 *
 *   margins   each touchdown quantity against the lander's limit
 *   stats     what happened during the descent (peaks, burn, delta-v, diverts, fuel events)
 *   scores    safety / precision / efficiency, combined into an overall score and grade
 *   findings  probable causes of a failure, contributing factors and what to change next time
 *
 * The scores are game scoring for comparing one flight with the next. Their thresholds
 * (see SCORING) are design choices of this simulator, not engineering standards.
 */
import type { FlightTelemetry, Outcome, SensorSuite, TouchdownLimits } from './types.ts';
import { G0 } from './constants.ts';

export const SCORING = {
  /** A limit is "marginal" once this share of it is used. */
  marginalRatio: 0.75,
  /** Precision: full marks within this miss distance, zero at `precisionZeroM`. */
  precisionFullM: 2,
  precisionZeroM: 50,
  weights: { safety: 0.6, precision: 0.25, efficiency: 0.15 },
  /** The overall score cannot exceed this for a given outcome. */
  outcomeCap: { success: 100, 'hard-landing': 70, 'tip-over': 45, crash: 20, timeout: 0 } as Record<Outcome, number>,
  grades: [[90, 'A'], [75, 'B'], [60, 'C'], [40, 'D']] as Array<[number, Grade]>,
  /** Below this share of the loaded fuel at touchdown, the reserve is flagged. */
  lowReserveFraction: 0.1,
  /** Below this thrust-to-weight ratio at ignition mass, braking authority is flagged. */
  lowThrustToWeight: 1.3,
};

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
/** 'stability' is only present for a lander with a landing gear model: its lean against its tip angle. */
export type MarginKey = 'vertical' | 'horizontal' | 'slope' | 'roughness' | 'tilt' | 'stability';
type LimitKey = Exclude<MarginKey, 'stability'>;
export type MarginStatus = 'within' | 'marginal' | 'exceeded';

export interface Margin {
  key: MarginKey;
  label: string;
  unit: string;
  value: number;
  limit: number;
  /** value / limit: 1 = exactly at the limit. */
  ratio: number;
  status: MarginStatus;
}

export interface FlightStats {
  flightTimeS: number;
  /** Largest downward speed during the descent, m/s. */
  peakDescentRateMps: number;
  peakSpeedMps: number;
  maxTiltDeg: number;
  /** Peak acceleration felt by the vehicle before contact, in Earth g (from sampled velocity). */
  peakDecelG: number;
  /** Seconds with the engine lit, and mean throttle while lit (0..1). */
  burnTimeS: number;
  meanThrottle: number;
  fuelLoadedKg: number;
  fuelUsedKg: number;
  /** Fuel left at the end as a share of the fuel loaded, 0..1. */
  fuelReserveFraction: number;
  /** Delta-v actually spent, from the rocket equation, m/s. */
  deltaVUsedMps: number;
  /** Speed an unbraked fall from the start state would reach at the ground (no drag), m/s. */
  deltaVIdealMps: number;
  /** deltaVIdeal / deltaVUsed, capped at 1; null when no fuel was burned. */
  propulsiveEfficiency: number | null;
  /** Thrust-to-weight ratio at ignition mass under the simulated gravity. */
  thrustToWeight: number;
  groundTrackM: number;
  hazardsDetected: number;
  diverts: number;
  divertDistanceM: number;
  /** Miss distance from the original target and from where guidance finally aimed, m. */
  distanceFromTargetM: number;
  distanceFromAimM: number;
  fuelLowAtS: number | null;
  fuelOutAtS: number | null;
  /** Height above ground when the fuel ran out, m. */
  fuelOutAltitudeM: number | null;
  dustKickupAltitudeM: number | null;
}

export interface Finding {
  code: string;
  text: string;
}

export interface FlightAssessment {
  outcome: Outcome;
  /** False for a timeout: the touchdown margins are then empty. */
  touchedDown: boolean;
  survivability: number;
  margins: Margin[];
  /** The limit closest to (or furthest past) being exceeded. */
  limitingFactor: Margin | null;
  stats: FlightStats;
  scores: {
    /** 0..100 each; null when the quantity is not meaningful for this outcome. */
    safety: number;
    precision: number | null;
    efficiency: number | null;
    overall: number;
    grade: Grade;
  };
  /** Why the flight failed (empty on success). */
  causes: Finding[];
  /** Conditions that made the landing harder or left little margin; may be present on success. */
  factors: Finding[];
  recommendations: Finding[];
}

export interface AssessmentContext {
  /** The sensor suite flown. Telemetry does not carry it, so sensor findings need it. */
  sensors?: Partial<SensorSuite>;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const pct = (v: number) => `${Math.round(v * 100)}%`;

const MARGIN_DEFS: Array<{ key: LimitKey; label: string; unit: string; limit: keyof TouchdownLimits; digits: number }> = [
  { key: 'vertical', label: 'Sink rate', unit: 'm/s', limit: 'maxVerticalMps', digits: 2 },
  { key: 'horizontal', label: 'Lateral speed', unit: 'm/s', limit: 'maxHorizontalMps', digits: 2 },
  { key: 'slope', label: 'Ground slope', unit: '°', limit: 'maxSlopeDeg', digits: 1 },
  { key: 'roughness', label: 'Roughness under legs', unit: 'm', limit: 'maxRoughnessM', digits: 2 },
  { key: 'tilt', label: 'Vehicle tilt', unit: '°', limit: 'maxTiltDeg', digits: 1 },
];

export function assessFlight(flight: FlightTelemetry, context: AssessmentContext = {}): FlightAssessment {
  const summary = flight.summary;
  if (!summary) throw new Error('assessFlight: the flight has not ended (no summary).');
  const { lander, samples, events, environment: env } = flight;
  const touchedDown = summary.outcome !== 'timeout';

  // --- margins -----------------------------------------------------------------------------
  const values: Record<LimitKey, number> = {
    vertical: summary.verticalSpeedMps,
    horizontal: summary.horizontalSpeedMps,
    slope: summary.slopeDeg,
    roughness: summary.roughnessM,
    tilt: summary.tiltDeg,
  };
  // With a landing gear model, slope, tilt and lateral speed do not fail a landing one by one:
  // together they decide whether it tips (the 'stability' margin below). Over their own guide
  // value they are shown as marginal unless the vehicle did go over.
  const gear = touchedDown ? summary.gear : undefined;
  const combined = (key: MarginKey) => !!gear && (key === 'slope' || key === 'tilt' || key === 'horizontal');
  const margins: Margin[] = !touchedDown ? [] : MARGIN_DEFS.map((d) => {
    const limit = lander.limits[d.limit];
    const ratio = values[d.key] / limit;
    const over = ratio > 1 && (!combined(d.key) || gear!.tipped || (d.key === 'horizontal' && ratio > 2));
    return {
      key: d.key, label: d.label, unit: d.unit, value: values[d.key], limit, ratio,
      status: over ? 'exceeded' : ratio > SCORING.marginalRatio ? 'marginal' : 'within',
    };
  });
  if (gear) {
    const ratio = gear.tipped ? Math.max(1.01, Math.min(2, gear.tipRatio)) : gear.peakLeanDeg / gear.staticTipDeg;
    margins.push({
      key: 'stability', label: 'Lean towards tip-over', unit: '°', value: gear.peakLeanDeg, limit: Math.round(gear.staticTipDeg * 10) / 10, ratio,
      status: gear.tipped ? 'exceeded' : ratio > SCORING.marginalRatio ? 'marginal' : 'within',
    });
  }
  const limitingFactor = margins.reduce<Margin | null>((worst, m) => (!worst || m.ratio > worst.ratio ? m : worst), null);
  const margin = (key: MarginKey) => margins.find((m) => m.key === key);

  // --- in-flight statistics ----------------------------------------------------------------
  // The final sample is recorded after contact with the velocity zeroed, so it is left out of
  // the speed and acceleration peaks.
  const flown = touchedDown && samples.length > 1 ? samples.slice(0, -1) : samples;
  let peakDescent = 0, peakSpeed = 0, maxTilt = 0, peakFelt = 0, burnTime = 0, throttleTime = 0, track = 0;
  for (let i = 0; i < flown.length; i++) {
    const s = flown[i];
    peakDescent = Math.max(peakDescent, -s.vz);
    peakSpeed = Math.max(peakSpeed, Math.hypot(s.vx, s.vy, s.vz));
    maxTilt = Math.max(maxTilt, s.tiltDeg);
    if (i === 0) continue;
    const p = flown[i - 1];
    const dt = s.t - p.t;
    if (dt <= 0) continue;
    // felt (proper) acceleration = dv/dt minus gravity
    peakFelt = Math.max(peakFelt, Math.hypot((s.vx - p.vx) / dt, (s.vy - p.vy) / dt, (s.vz - p.vz) / dt + env.gravity));
    if (p.throttle > 0) { burnTime += dt; throttleTime += p.throttle * dt; }
  }
  for (let i = 1; i < samples.length; i++) track += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);

  const first = samples[0];
  const last = samples[samples.length - 1];
  const m0 = lander.dryMassKg + lander.fuelKg;
  const m1 = lander.dryMassKg + summary.fuelRemainingKg;
  const deltaVUsed = lander.ispS * G0 * Math.log(m0 / m1);
  const drop = first && last ? Math.max(0, first.z - last.z) : 0;
  const v0 = first ? Math.hypot(first.vx, first.vy, first.vz) : 0;
  const deltaVIdeal = Math.sqrt(v0 * v0 + 2 * env.gravity * drop);
  const fuelOut = events.find((e) => e.type === 'fuelOut');
  const fuelLow = events.find((e) => e.type === 'fuelLow');
  const dust = events.find((e) => e.type === 'dustKickup');
  const divertEvents = events.filter((e) => e.type === 'divert');
  const altitudeAt = (t: number) => (samples.find((s) => s.t >= t) ?? last)?.altitudeAGL ?? 0;

  const stats: FlightStats = {
    flightTimeS: summary.flightTimeS,
    peakDescentRateMps: peakDescent,
    peakSpeedMps: peakSpeed,
    maxTiltDeg: maxTilt,
    peakDecelG: peakFelt / G0,
    burnTimeS: burnTime,
    meanThrottle: burnTime > 0 ? throttleTime / burnTime : 0,
    fuelLoadedKg: lander.fuelKg,
    fuelUsedKg: summary.fuelUsedKg,
    fuelReserveFraction: lander.fuelKg > 0 ? summary.fuelRemainingKg / lander.fuelKg : 0,
    deltaVUsedMps: deltaVUsed,
    deltaVIdealMps: deltaVIdeal,
    propulsiveEfficiency: deltaVUsed > 0 ? clamp(deltaVIdeal / deltaVUsed, 0, 1) : null,
    thrustToWeight: lander.maxThrustN / (m0 * env.gravity),
    groundTrackM: track,
    hazardsDetected: events.filter((e) => e.type === 'hazardDetected').length,
    diverts: divertEvents.length,
    divertDistanceM: divertEvents.reduce((sum, e) => sum + (e.type === 'divert' ? e.distanceM : 0), 0),
    distanceFromTargetM: summary.distanceFromTargetM,
    distanceFromAimM: Math.hypot(summary.landingPoint.x - summary.finalAimPoint.x, summary.landingPoint.y - summary.finalAimPoint.y),
    fuelLowAtS: fuelLow ? fuelLow.t : null,
    fuelOutAtS: fuelOut ? fuelOut.t : null,
    fuelOutAltitudeM: fuelOut ? altitudeAt(fuelOut.t) : null,
    dustKickupAltitudeM: dust && dust.type === 'dustKickup' ? dust.altitudeM : null,
  };

  // --- scores ------------------------------------------------------------------------------
  const safety = summary.survivability;
  // Precision is measured from where guidance finally aimed, so a deliberate hazard divert
  // is not counted as a miss.
  const precision = !touchedDown ? null
    : Math.round(100 * clamp(1 - (stats.distanceFromAimM - SCORING.precisionFullM) / (SCORING.precisionZeroM - SCORING.precisionFullM), 0, 1));
  // Efficiency only means something when the vehicle was actually braked to a landing.
  const braked = summary.outcome === 'success' || summary.outcome === 'hard-landing' || summary.outcome === 'tip-over';
  const efficiency = braked && stats.propulsiveEfficiency !== null ? Math.round(100 * stats.propulsiveEfficiency) : null;
  const parts: Array<[number | null, number]> = [
    [safety, SCORING.weights.safety], [precision, SCORING.weights.precision], [efficiency, SCORING.weights.efficiency],
  ];
  const weight = parts.reduce((s, [v, w]) => s + (v === null ? 0 : w), 0);
  const weighted = parts.reduce((s, [v, w]) => s + (v === null ? 0 : v * w), 0) / (weight || 1);
  const overall = Math.round(Math.min(weighted, SCORING.outcomeCap[summary.outcome]));
  const grade = SCORING.grades.find(([min]) => overall >= min)?.[1] ?? 'F';

  // --- findings ----------------------------------------------------------------------------
  const causes: Finding[] = [];
  const factors: Finding[] = [];
  const recommendations: Finding[] = [];
  const add = (list: Finding[], code: string, text: string) => { if (!list.some((f) => f.code === code)) list.push({ code, text }); };
  const exceeded = (key: MarginKey) => margin(key)?.status === 'exceeded';
  const hazardSensor = context.sensors?.hazard;
  const windSpeed = Math.hypot(env.wind.x, env.wind.y);
  const unpowered = fuelOut !== undefined && (stats.fuelOutAltitudeM ?? 0) > 1;
  const lowTW = stats.thrustToWeight < SCORING.lowThrustToWeight;

  if (!touchedDown) {
    const alt = last?.altitudeAGL ?? 0;
    add(causes, 'no-touchdown', `The time limit was reached ${alt.toFixed(0)} m above the ground${summary.fuelRemainingKg > 0 ? ` with ${summary.fuelRemainingKg.toFixed(0)} kg of fuel left` : ''}; the vehicle never committed to a descent.`);
    add(recommendations, 'descend', 'Reduce throttle earlier and hold a steady descent rate instead of hovering.');
  }

  if (exceeded('vertical') || exceeded('horizontal')) {
    if (unpowered) {
      add(causes, 'fuel-out', `Fuel ran out ${stats.fuelOutAltitudeM!.toFixed(0)} m above the ground, ${(summary.flightTimeS - stats.fuelOutAtS!).toFixed(1)} s before contact; the vehicle fell the rest of the way unpowered.`);
      add(recommendations, 'more-fuel', `Load more fuel or brake more efficiently: this flight spent ${stats.deltaVUsedMps.toFixed(0)} m/s of delta-v against an unbraked arrival speed of ${stats.deltaVIdealMps.toFixed(0)} m/s.`);
    }
    if (lowTW) {
      add(causes, 'low-thrust', `Thrust-to-weight ratio was only ${stats.thrustToWeight.toFixed(2)} at ignition mass, leaving little authority to stop the descent.`);
      add(recommendations, 'more-thrust', 'Raise thruster force or reduce vehicle mass so the thrust-to-weight ratio is comfortably above 1.3.');
    }
  }
  if (exceeded('vertical') && !unpowered && !lowTW) {
    add(causes, 'late-braking', `The final braking did not remove enough speed: sink rate was ${values.vertical.toFixed(2)} m/s at contact after a peak of ${stats.peakDescentRateMps.toFixed(1)} m/s.`);
    add(recommendations, 'brake-earlier', flight.strategy === 'manual' ? 'Start the braking burn higher and arrive at the last 20 m already below the sink-rate limit.' : 'Give guidance more margin: a higher thrust-to-weight ratio or more fuel lets it brake earlier.');
  }
  // After the fuel is gone the vehicle cannot steer, so drift and tilt are consequences, not causes.
  if (exceeded('horizontal') && !unpowered) {
    add(causes, 'lateral-speed', `Lateral speed was not nulled before contact (${values.horizontal.toFixed(2)} m/s)${windSpeed >= 3 ? ` in a ${windSpeed.toFixed(1)} m/s wind` : ''}.`);
    add(recommendations, 'null-lateral', windSpeed >= 3 ? 'Fly in lighter wind, or level out and cancel drift higher above the ground.' : 'Cancel sideways drift before the final descent and touch down level.');
  }
  if (exceeded('tilt') && !unpowered) {
    add(causes, 'tilted', `The vehicle was still tilted ${values.tilt.toFixed(1)}° at contact, i.e. still manoeuvring when it reached the ground.`);
    add(recommendations, 'level-out', 'Finish lateral corrections earlier so the vehicle is upright for the last few metres.');
  }
  if (gear && exceeded('vertical'))
    add(causes, 'stroke-bottomed', `The legs ran out of travel: a ${values.vertical.toFixed(2)} m/s sink rate needs ${(gear.strokeRatio * gear.strokeM).toFixed(2)} m of stroke and the gear has ${gear.strokeM.toFixed(2)} m (it absorbs up to ${gear.maxSinkMps.toFixed(2)} m/s).`);
  if (gear?.tipped) {
    add(causes, 'tipped', `The vehicle went over: it met the ground leaning ${gear.groundLeanDeg.toFixed(1)}° (slope plus tilt) and its ${values.horizontal.toFixed(2)} m/s of lateral speed and the rebound of the legs carried it past the ${gear.staticTipDeg.toFixed(1)}° tip angle of its stance under ${env.gravity.toFixed(2)} m/s² gravity.`);
    add(recommendations, 'wider-stance', 'Fit a wider or six-leg gear, land on flatter ground, or cancel sideways drift before contact. Softer damping also returns less rebound.');
  }
  if (gear && exceeded('vertical')) add(recommendations, 'more-stroke', 'Fit a gear with more stroke or more damping, or arrive slower.');
  if (exceeded('slope') || exceeded('roughness')) {
    const what = [exceeded('slope') ? `a ${values.slope.toFixed(1)}° slope` : '', exceeded('roughness') ? `${values.roughness.toFixed(2)} m of relief under the legs` : ''].filter(Boolean).join(' and ');
    add(causes, 'bad-ground', `The touchdown point had ${what}, beyond what this vehicle tolerates.`);
    if (hazardSensor === 'none') {
      add(causes, 'no-hazard-sensor', 'No hazard sensor was fitted, so guidance could not see or avoid the ground it landed on.');
      add(recommendations, 'fit-sensor', 'Fit a hazard sensor (lidar is least affected by glare) so guidance can divert to safer ground.');
    } else if (flight.strategy === 'manual') {
      add(recommendations, 'pick-ground', 'Steer for flatter ground before the final descent, or let the autonomous strategy choose the site.');
    } else if (hazardSensor === 'camera' && env.interference.glare >= 0.4) {
      add(causes, 'glare', `Glare interference of ${pct(env.interference.glare)} degraded the camera's view of the hazards.`);
      add(recommendations, 'use-lidar', 'Switch the hazard sensor to lidar, which is far less affected by glare.');
    } else if (summary.diverted) {
      add(causes, 'divert-insufficient', `Guidance diverted ${stats.divertDistanceM.toFixed(0)} m but the new site was still outside the limits.`);
      add(recommendations, 'tolerance', 'Choose a smoother landing area, or a vehicle with a higher slope tolerance.');
    } else {
      add(recommendations, 'tolerance', 'Choose a smoother landing area, or a vehicle with a higher slope tolerance.');
    }
  }

  // contributing conditions, also reported on success
  if (env.interference.dust >= 0.5 && (exceeded('vertical') || exceeded('horizontal')))
    add(factors, 'dust', `Dust interference of ${pct(env.interference.dust)} degraded altitude and velocity readings near the ground.`);
  if (touchedDown && !unpowered && stats.fuelReserveFraction < SCORING.lowReserveFraction) {
    add(factors, 'low-reserve', `Only ${pct(stats.fuelReserveFraction)} of the fuel (${summary.fuelRemainingKg.toFixed(0)} kg) was left at touchdown.`);
    add(recommendations, 'reserve', 'Carry a larger fuel reserve; a divert or a gust would have exhausted this one.');
  }
  for (const m of margins) if (m.status === 'marginal')
    add(factors, `marginal-${m.key}`, `${m.label} used ${pct(m.ratio)} of its limit (${m.value.toFixed(2)} of ${m.limit} ${m.unit}).`);
  if (summary.diverted && summary.outcome === 'success')
    add(factors, 'diverted', `Guidance detected a hazard at the target and diverted ${stats.divertDistanceM.toFixed(0)} m to safer ground.`);
  if (touchedDown && precision !== null && precision < 50 && !causes.length) {
    add(factors, 'imprecise', `Touchdown was ${stats.distanceFromAimM.toFixed(0)} m from the aim point.`);
    add(recommendations, 'precision', 'Null the position error earlier in the approach to land closer to the aim point.');
  }

  return {
    outcome: summary.outcome, touchedDown, survivability: summary.survivability, margins, limitingFactor, stats,
    scores: { safety, precision, efficiency, overall, grade }, causes, factors, recommendations,
  };
}
