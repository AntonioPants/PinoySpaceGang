/**
 * Debrief model shared by both report views: the engine's post-flight assessment of the flown
 * mission, plus a comparison of that flight with the fidelity rehearsal flights.
 */
import { assessFlight, type FlightAssessment } from '../../../app/sim/src/assessment';
import type { FidelityResult } from '../../../app/sim/src/fidelity';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { MissionConfig } from './types';

export function debriefFor(flight: FlightTelemetry, mission: MissionConfig): FlightAssessment {
  return assessFlight(flight, { sensors: { hazard: mission.strategy.hazardSensor } });
}

/**
 * How the landing gear fared, for the flight statistics: stroke used, how close the vehicle came
 * to going over, and what the gear was good for. Empty when the lander had no gear model or
 * never reached the ground.
 */
export function gearRows(flight: FlightTelemetry): Array<[string, string]> {
  const g = flight.summary?.gear;
  if (!g || flight.summary!.outcome === 'timeout') return [];
  const used = Math.round(Math.min(g.strokeRatio, 1) * 100);
  return [
    ['Shock compression', g.strokeRatio > 1 ? `${g.strokeM.toFixed(2)} m of ${g.strokeM.toFixed(2)} m (bottomed out: needed ${(g.strokeRatio * g.strokeM).toFixed(2)} m)` : `${g.strokeUsedM.toFixed(2)} m of ${g.strokeM.toFixed(2)} m (${used}% of stroke)`],
    ['Tip margin', g.tipped ? `Went over (tips at ${g.staticTipDeg.toFixed(1)}°)` : `${g.tipMarginDeg.toFixed(1)}° from overturn (leaned ${g.peakLeanDeg.toFixed(1)}° of ${g.staticTipDeg.toFixed(1)}°)`],
    ['Gear absorbs up to', `${g.maxSinkMps.toFixed(2)} m/s sink rate`],
  ];
}

export interface RehearsalRow { label: string; unit: string; digits: number; flown: number; planetary: number; analog: number }

/**
 * The flown touchdown beside the mean of the autonomous rehearsal flights over the planetary
 * target's own terrain and over the Earth analog. Null when the flight never touched down.
 */
export function rehearsalRows(flight: FlightTelemetry, guided: FidelityResult): RehearsalRow[] | null {
  const s = flight.summary;
  if (!s || s.outcome === 'timeout') return null;
  const { planetary: p, analog: a } = guided;
  return [
    { label: 'Sink rate', unit: 'm/s', digits: 2, flown: s.verticalSpeedMps, planetary: p.meanSinkMps, analog: a.meanSinkMps },
    { label: 'Lateral speed', unit: 'm/s', digits: 2, flown: s.horizontalSpeedMps, planetary: p.meanLateralMps, analog: a.meanLateralMps },
    { label: 'Ground slope', unit: '°', digits: 1, flown: s.slopeDeg, planetary: p.meanSlopeDeg, analog: a.meanSlopeDeg },
    { label: 'Roughness under legs', unit: 'm', digits: 2, flown: s.roughnessM, planetary: p.meanRoughnessM, analog: a.meanRoughnessM },
    { label: 'Fuel used', unit: 'kg', digits: 0, flown: s.fuelUsedKg, planetary: p.meanFuelUsedKg, analog: a.meanFuelUsedKg },
  ];
}
