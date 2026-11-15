/**
 * Lander schematic for the debrief: an inline SVG of the vehicle with leader lines from six
 * subsystems to their callouts. Selecting a part shows three things for it: the craft's own
 * specification and tolerance, what this flight did to it, and how far the Earth analog's
 * rehearsal tested it against the target.
 *
 * Every value comes from the flown telemetry (including the lander configuration the engine
 * flew), the engine's assessment, the rehearsal flights or the site catalog. Where the
 * simulator has no model for a part (radio links, structural g-limits, rover deployment) the
 * callout says so instead of inventing a tolerance.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { HAZARD_SENSORS } from '../../../../app/sim/src/hazardSensors';
import type { HazardSensorId } from '../../../../app/sim/src/types';
import { landingGear } from '../opening/equipmentCatalog';
import { isLargeVehicle, vehicleName } from '../equipment';
import { GEAR } from '../../components/cutscene/lander';
import { liveries } from '../../lib/landerAppearance';
import type { FlightTelemetry } from '../../../../app/sim/src/types';
import type { CatalogSite } from '../../../../app/sim/src/catalog';
import type { FlightAssessment, Margin } from '../../../../app/sim/src/assessment';
import { DUST_ALTITUDE_M, FUEL_LOW_FRACTION } from '../../../../app/sim/src/constants';
import { gearRows, type RehearsalRow } from '../../lib/debrief';
import type { FidelityReport } from '../../lib/fidelity';
import type { MissionConfig } from '../../lib/types';

export type SubsystemId = 'comms' | 'sensors' | 'avionics' | 'engine' | 'struts' | 'payload';
export type SubsystemLevel = 'nominal' | 'caution' | 'exceeded' | 'not_modelled';
export interface SubsystemReading {
  id: SubsystemId; name: string; short: string; level: SubsystemLevel; headline: string;
  spec: string[]; status: string[]; analogDelta: string[];
}
export interface SchematicInput {
  flight: FlightTelemetry; mission: MissionConfig; assessment: FlightAssessment;
  fidelity: FidelityReport | null; rehearsal: RehearsalRow[] | null;
  analogEntry?: CatalogSite; planetaryEntry?: CatalogSite;
}

const LEVEL_WORD: Record<SubsystemLevel, string> = { nominal: 'Nominal', caution: 'Caution', exceeded: 'Limit exceeded', not_modelled: 'Not modelled' };
const RANK: Record<SubsystemLevel, number> = { not_modelled: 0, nominal: 1, caution: 2, exceeded: 3 };
const worst = (levels: SubsystemLevel[]) => levels.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'nominal' as SubsystemLevel);
const fromMargin = (m?: Margin): SubsystemLevel => (!m ? 'not_modelled' : m.status === 'exceeded' ? 'exceeded' : m.status === 'marginal' ? 'caution' : 'nominal');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const value = (site: CatalogSite | undefined, key: string) => {
  const q = site?.conditions?.[key] as { value?: number | null; unit?: string } | undefined;
  return typeof q?.value === 'number' && Number.isFinite(q.value) ? q.value : null;
};
const row = (rows: RehearsalRow[] | null, label: string) => rows?.find(r => r.label === label);
/** Rehearsal means on both terrains; differences under 5% (or below display precision) count as the same. */
const compare = (r: RehearsalRow | undefined, body: string) => {
  if (!r) return null;
  const close = Math.abs(r.analog - r.planetary) <= Math.max(0.05 * Math.abs(r.planetary), 0.5 * 10 ** -r.digits);
  const verdict = close ? ', so the analog tests it about as hard' : r.analog < r.planetary ? ', so the analog under-tests it' : ', so the analog tests it harder';
  return `Rehearsal ${r.label.toLowerCase()}: ${r.planetary.toFixed(r.digits)} ${r.unit} on ${body} terrain vs ${r.analog.toFixed(r.digits)} ${r.unit} on the Earth analog${verdict}.`;
};

/** Angular elevation of Earth above the local horizon at a near-side lunar point, ignoring libration (about ±7°). */
export function earthElevationFromMoonDeg(lat: number, lon: number) {
  const r = Math.PI / 180;
  const angle = Math.acos(Math.max(-1, Math.min(1, Math.cos(lat * r) * Math.cos(lon * r)))) / r;
  return 90 - angle;
}

/** The six subsystem readings, as shown in the schematic and saved in the report download. */
export function subsystemReadings({ flight, mission, assessment: a, fidelity, rehearsal, analogEntry, planetaryEntry }: SchematicInput): SubsystemReading[] {
  const lander = flight.lander, limits = lander.limits, env = flight.environment, s = a.stats, summary = flight.summary!;
  const target = mission.planetaryTarget, body = target.body;
  const margin = (key: Margin['key']) => a.margins.find(m => m.key === key);
  const sensor = mission.strategy.hazardSensor;

  // ---- comms
  // Coordinates come from the catalog record; without it Earth visibility is not worked out.
  const lat = typeof planetaryEntry?.latitude === 'number' ? planetaryEntry.latitude : null;
  const lon = typeof planetaryEntry?.longitude === 'number' ? planetaryEntry.longitude : null;
  const earthElevation = body === 'Moon' && lat !== null && lon !== null ? earthElevationFromMoonDeg(lat, lon) : null;
  const commsStatus = body === 'Moon' && earthElevation === null ? 'Study-site coordinates are not available, so Earth visibility is not worked out.'
    : earthElevation === null
    ? 'Mars turns daily, so Earth is in view only for part of each sol and the link time depends on the date. Relay through an orbiter is the usual path.'
    : earthElevation < -7 ? `Earth is ${Math.abs(earthElevation).toFixed(0)}° below the horizon at ${target.name}: no direct link, a relay orbiter is required.`
    : earthElevation < 7 ? `Earth sits ${earthElevation.toFixed(0)}° from the horizon at ${target.name}; libration makes it rise and set, so the direct link is intermittent.`
    : `Earth stays about ${earthElevation.toFixed(0)}° above the horizon at ${target.name}, so a direct link is geometrically available.`;

  // ---- sensors
  const profile = HAZARD_SENSORS[sensor] ?? HAZARD_SENSORS.lidar;   // the figures the descent flew (hazardSensors.ts)
  const sensorLevel: SubsystemLevel = !profile.map ? 'caution' : profile.glareNoiseM >= 0.5 && env.interference.glare >= 0.4 ? 'caution' : 'nominal';

  // ---- avionics and thermal
  const tiltRatio = s.maxTiltDeg / lander.maxTiltDeg;
  const earthSurface = value(analogEntry, 'surface_temperature');
  const targetMin = value(planetaryEntry, 'bolometric_temperature_min'), targetMax = value(planetaryEntry, 'bolometric_temperature_max');
  const thermal = targetMin !== null && targetMax !== null
    ? `Target surface (LRO Diviner regional bins): ${(targetMin - 273.15).toFixed(0)} to ${(targetMax - 273.15).toFixed(0)} °C. Earth analog surface mean (NASA POWER, 2024): ${earthSurface !== null ? `${earthSurface.toFixed(0)} °C` : 'not recorded'}. The rehearsal does not test this thermal range.`
    : `No thermal record for ${target.name} in the catalog; Earth analog surface mean ${earthSurface !== null ? `${earthSurface.toFixed(0)} °C (NASA POWER, 2024)` : 'not recorded'}. Thermal stress is not simulated.`;

  // ---- engine
  const fuelOut = s.fuelOutAtS !== null, fuelLow = s.fuelReserveFraction < FUEL_LOW_FRACTION;
  const fuelRow = row(rehearsal, 'Fuel used');

  // ---- struts
  const strutKeys: Margin['key'][] = ['vertical', 'horizontal', 'slope', 'roughness'];
  const struts = strutKeys.map(margin).filter((m): m is Margin => !!m);
  const strutLevel = a.touchedDown ? worst(struts.map(fromMargin)) : 'not_modelled';

  // ---- payload deployment
  const tilt = margin('tilt'), slope = margin('slope');
  const deployLevel = a.touchedDown ? worst([fromMargin(tilt), fromMargin(slope)]) : 'not_modelled';
  const p95 = (site?: CatalogSite) => value(site, 'slope_p95');

  return [
    { id: 'comms', name: 'High-gain antenna', short: 'Antenna', level: 'not_modelled', headline: earthElevation === null ? (body === 'Moon' ? 'Earth visibility unknown' : 'Earth link varies by sol') : earthElevation < -7 ? 'Relay required' : earthElevation < 7 ? 'Intermittent Earth link' : 'Earth in view',
      spec: ['No radio or antenna model in the simulator; the link is not part of the flight.'],
      status: [commsStatus, ...(lat !== null && lon !== null ? [`Study centre: ${lat.toFixed(2)}°, ${lon.toFixed(2)}° E.`] : [])],
      analogDelta: ['On Earth the analog site has terrestrial networks and a sky-wide view of satellites, so it does not rehearse the target’s link geometry or delay.'] },
    { id: 'sensors', name: 'Hazard sensor', short: 'Hazard sensor', level: sensorLevel, headline: sensor === 'none' ? 'No hazard sensor fitted' : `${profile.name} · ${pct(env.interference.glare)} glare`,
      spec: [sensor === 'none' ? 'No hazard sensor: guidance cannot see or divert around hazards.' : !profile.map ? `${profile.name}: speed to ±${profile.velocitySigmaMps} m/s, but no hazard map, so guidance cannot divert.` : `${profile.name} hazard map read ${profile.scanAltitudeM} m up at ${profile.cellM} m detail, divert up to ${profile.divertRadiusM} m; noise ${profile.baseNoiseM} m plus ${profile.glareNoiseM} m per unit glare.`,
        `Dust degrades the altimeter and velocimeter below ${DUST_ALTITUDE_M} m while the engine fires. A camera degrades badly at 40% glare or more.`],
      status: [`Dust interference ${pct(env.interference.dust)}, glare ${pct(env.interference.glare)} (${mission.environment.interferenceSource === 'site' ? 'from site data' : 'manual'}).`,
        `${s.hazardsDetected} hazard${s.hazardsDetected === 1 ? '' : 's'} detected; ${s.diverts ? `${s.diverts} divert of ${s.divertDistanceM.toFixed(0)} m` : 'no divert'}.`,
        ...(s.dustKickupAltitudeM !== null ? [`Plume dust first kicked up at ${s.dustKickupAltitudeM.toFixed(0)} m.`] : [])],
      analogDelta: [`Dust and glare come from ${mission.earthAnalog.name}’s albedo and latitude, not from ${target.name}. Glare at the target depends on its own sun angle${body === 'Moon' && lat !== null && Math.abs(lat) > 80 ? ', which is very low near the pole' : ''}.`] },
    { id: 'avionics', name: 'Avionics and thermal core', short: 'Avionics', level: tiltRatio > 0.999 ? 'caution' : 'nominal', headline: `${s.peakDecelG.toFixed(2)} g peak · ${s.maxTiltDeg.toFixed(0)}° max tilt`,
      spec: [`Attitude controller tilt limit ${lander.maxTiltDeg}°; dry mass ${lander.dryMassKg.toLocaleString()} kg.`, 'No structural g-limit or thermal limit is modelled.'],
      status: [`Peak deceleration ${s.peakDecelG.toFixed(2)} g; maximum tilt in flight ${s.maxTiltDeg.toFixed(1)}° (${pct(tiltRatio)} of the controller limit${tiltRatio > 0.999 ? ': the attitude controller was saturated during the braking manoeuvre' : ''}).`, `Flight time ${s.flightTimeS.toFixed(0)} s.`],
      analogDelta: [thermal] },
    { id: 'engine', name: 'Descent engine and plume', short: 'Engine', level: fuelOut ? 'exceeded' : fuelLow ? 'caution' : 'nominal', headline: `${pct(s.fuelReserveFraction)} fuel reserve`,
      spec: [`${(lander.maxThrustN / 1000).toFixed(1)} kN maximum thrust, Isp ${lander.ispS} s, throttle down to ${pct(lander.minThrottle)}.`, `${lander.fuelKg} kg propellant; low-fuel warning at ${pct(FUEL_LOW_FRACTION)}. Thrust-to-weight at ignition ${s.thrustToWeight.toFixed(2)}.`],
      status: [`Used ${s.fuelUsedKg.toFixed(0)} of ${s.fuelLoadedKg.toFixed(0)} kg; ${fuelOut ? `ran dry at T+${s.fuelOutAtS!.toFixed(1)} s` : `${pct(s.fuelReserveFraction)} left`}.`,
        `Delta-v spent ${s.deltaVUsedMps.toFixed(0)} m/s against an unbraked arrival speed of ${s.deltaVIdealMps.toFixed(0)} m/s.`,
        `Plume in ${env.airDensity < 1e-6 ? 'vacuum: ejecta flies on ballistic paths and is not slowed by air' : `air of ${env.airDensity.toFixed(3)} kg/m³`}; ejecta damage is not simulated.`],
      analogDelta: [compare(fuelRow, body) ?? 'Rehearsal fuel comparison not available yet.', 'On Earth the plume expands into air, so plume-surface interaction is not rehearsed.'] },
    { id: 'struts', name: 'Landing struts and footpads', short: 'Struts', level: strutLevel, headline: a.touchedDown ? (strutLevel === 'exceeded' ? 'Contact limit exceeded' : strutLevel === 'caution' ? 'Contact limit marginal' : 'Within contact limits') : 'No touchdown',
      spec: [`Footpads ${lander.legRadiusM.toFixed(1)} m from the centre. Limits: sink ${limits.maxVerticalMps} m/s, lateral ${limits.maxHorizontalMps} m/s, slope ${limits.maxSlopeDeg}°, roughness ${limits.maxRoughnessM} m.`],
      status: a.touchedDown ? [...gearRows(flight).map(([name, value]) => `${name}: ${value}.`), ...struts.map(m => `${m.label}: ${m.value.toFixed(m.unit === '°' ? 1 : 2)} of ${m.limit} ${m.unit} (${pct(m.ratio)}${m.status === 'exceeded' ? ', over limit' : m.status === 'marginal' ? ', marginal' : ''}).`), ...summary.failureReasons]
        : ['The vehicle never touched down; there are no contact loads.'],
      analogDelta: [compare(row(rehearsal, 'Ground slope'), body), compare(row(rehearsal, 'Roughness under legs'), body), compare(row(rehearsal, 'Sink rate'), body),
        fidelity ? `Blind landings: ${pct(fidelity.stress.planetary.successRate)} landable on ${body} terrain vs ${pct(fidelity.stress.analog.successRate)} on Earth.` : null]
        .filter((t): t is string => !!t).concat(rehearsal ? [] : ['Rehearsal comparison not available yet.']) },
    { id: 'payload', name: 'Payload and rover bay', short: 'Payload bay', level: deployLevel, headline: a.touchedDown ? `${summary.tiltDeg.toFixed(1)}° tilt · ${summary.slopeDeg.toFixed(1)}° ground` : 'No touchdown',
      spec: ['No rover or deployment model. Judged against the lander’s own limits: ' + `tilt ${limits.maxTiltDeg}°, ground slope ${limits.maxSlopeDeg}°.`],
      status: a.touchedDown ? [`Resting tilt ${summary.tiltDeg.toFixed(1)}° (${pct(tilt?.ratio ?? 0)} of limit) on ${summary.slopeDeg.toFixed(1)}° ground (${pct(slope?.ratio ?? 0)} of limit).`] : ['No resting attitude: the vehicle did not land.'],
      analogDelta: [p95(planetaryEntry) !== null && p95(analogEntry) !== null
        ? `95th-percentile slope over each study area: ${p95(planetaryEntry)!.toFixed(1)}° at ${target.name} vs ${p95(analogEntry)!.toFixed(1)}° at ${mission.earthAnalog.name} (catalog, each on its own grid).`
        : 'Slope distributions for both sites are not available in the catalog.'] },
  ];
}

/* ---- Drawing: a front elevation built from the same geometry as the 3D lander (components/cutscene/lander.ts),
   so the vehicle, gear, solar arrays, antenna, hazard sensor and livery match what the player chose. Metres,
   foot level at y = 0, x to the right; drawn at a fixed scale so a wider stance really looks wider. */
type Pt = [number, number];
const VIEW = { width: 540, height: 340, cx: 270, ground: 312, scale: 29 };
const px = ([x, y]: Pt): Pt => [VIEW.cx + x * VIEW.scale, VIEW.ground - y * VIEW.scale];
const path = (points: Pt[], close = true) => points.map((p, i) => `${i ? 'L' : 'M'}${px(p).map(v => v.toFixed(1)).join(' ')}`).join(' ') + (close ? ' Z' : '');
const line = (a: Pt, b: Pt) => path([a, b], false);
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface LanderShape { vehicleId?: string; landingGearId?: string; hazardSensor?: HazardSensorId; liveryId?: string; solarArrayId?: string; antennaId?: string }

function geometry(spec: LanderShape) {
  const payload = isLargeVehicle(spec.vehicleId);
  const gear = GEAR[spec.landingGearId ?? ''] ?? GEAR['standard-four'];
  const bodyY = payload ? 2.35 : 2.2, bodyH = payload ? 1.75 : 1.4, radius = payload ? 1.88 : 1.63;
  const upperY = payload ? 3.65 : 3.35, roof = upperY + .45;
  const colours = liveries.find(l => l.id === spec.liveryId) ?? liveries[0];
  const sections = spec.solarArrayId === 'extended' ? 3 : spec.solarArrayId === 'compact' ? 1 : 2;
  const span = spec.solarArrayId === 'compact' ? .82 : .88, wingTilt = spec.solarArrayId === 'compact' ? .48 : .13;
  const legs = Array.from({ length: gear.legs }, (_, k) => {
    const a = Math.PI / gear.legs + k * 2 * Math.PI / gear.legs, c = Math.cos(a), depth = Math.sin(a);
    const foot: Pt = [c * gear.radius, .14], hip: Pt = [c * radius, bodyY + .35];
    const knee: Pt = [hip[0] + (foot[0] - hip[0]) * .54, hip[1] + (foot[1] - hip[1]) * .54];
    return { foot, hip, knee, brace: [c * radius, bodyY - .6] as Pt, depth };
  }).sort((p, q) => p.depth - q.depth);   // far legs first, near legs drawn over them
  const bell: Pt[] = [[.68, .68], [.61, .78], [.47, 1.0], [.3, 1.3], [.27, 1.53]].map(([r, y]) => [r * (payload ? 1.2 : 1), y]);
  return { payload, gear, bodyY, bodyH, radius, upperY, roof, colours, sections, span, wingTilt, legs, bell };
}

/** Where each subsystem's leader line starts, and where its label sits. */
function anchors(g: ReturnType<typeof geometry>, spec: LanderShape): Record<SubsystemId, { at: Pt; label: [number, number]; side: 'left' | 'right' }> {
  const antennaTop: Pt = spec.antennaId === 'relay' ? [.84, g.roof + .2 + 1.0] : spec.antennaId === 'whip' ? [.94, g.roof + .2 + 1.15] : [.6, g.roof + .2 + .7];
  const nearFoot = [...g.legs].filter(l => l.foot[0] > 0).sort((p, q) => q.depth - p.depth)[0] ?? g.legs[g.legs.length - 1];
  return {
    comms: { at: antennaTop, label: [418, 34], side: 'right' },
    sensors: { at: [0, g.bodyY - .15], label: [6, 118], side: 'left' },
    avionics: { at: [-g.radius * .55, g.bodyY + .3], label: [6, 62], side: 'left' },
    engine: { at: [0, .75], label: [6, 262], side: 'left' },
    struts: { at: nearFoot.foot, label: [418, 300], side: 'right' },
    payload: { at: g.payload ? [.35, 2.5] : [.95, g.upperY], label: [418, 150], side: 'right' },
  };
}

function Craft({ spec, part }: { spec: LanderShape; part: (id: SubsystemId) => { className: string; onMouseEnter: () => void; onClick: () => void } }) {
  const g = geometry(spec), hull = hex(g.colours.hull), accent = hex(g.colours.accent);
  const top = g.bodyY + g.bodyH / 2, bottom = g.bodyY - g.bodyH / 2, r = g.radius;
  const upperBottom = g.payload ? 1.55 : 1.3, upperTop = g.payload ? 1.2 : 1;
  return <>
    {/* solar wings: decorative, not a monitored subsystem */}
    <g className="lsc-wings">{[-1, 1].map(side => {
      const root: Pt = [side * (r + .35), g.upperY - .35], length = g.sections * (g.span + .07), dir: Pt = [side * Math.cos(g.wingTilt), -Math.sin(g.wingTilt)];
      const end: Pt = [root[0] + dir[0] * length, root[1] + dir[1] * length], n: Pt = [-dir[1] * .09, dir[0] * .09 * side];
      return <g key={side}>
        <path d={line([side * (r - .1), g.upperY - .35], root)} />
        <path d={path([[root[0] - n[0], root[1] - n[1]], [end[0] - n[0], end[1] - n[1]], [end[0] + n[0], end[1] + n[1]], [root[0] + n[0], root[1] + n[1]]])} />
        {Array.from({ length: g.sections - 1 }, (_, i) => { const t = (i + 1) * (g.span + .07); return <path key={i} d={line([root[0] + dir[0] * t - n[0], root[1] + dir[1] * t - n[1]], [root[0] + dir[0] * t + n[0], root[1] + dir[1] * t + n[1]])} />; })}
      </g>;
    })}</g>
    <g {...part('struts')}>{g.legs.map((l, i) => <g key={i} className={l.depth < 0 ? 'far' : ''}>
      <path d={line(l.hip, l.knee)} /><path d={line(l.knee, l.foot)} /><path d={line(l.brace, l.foot)} className="thin" />
      <path d={line([l.foot[0] - g.gear.pad, .05], [l.foot[0] + g.gear.pad, .05])} className="lsc-pad" />
    </g>)}</g>
    <g {...part('engine')}>
      <path d={path([...g.bell, ...g.bell.map(([x, y]) => [-x, y] as Pt).reverse()])} />
      <path d={line([-.9, .45], [.9, .45])} className="lsc-plume" />
    </g>
    <g {...part('avionics')} style={{ ['--hull' as string]: hull }}>
      <path d={path([[-r, bottom], [r, bottom], [r * .96, top], [-r * .96, top]])} className="lsc-hull" />
      <path d={line([-r * .9, g.bodyY + g.bodyH * .27], [r * .9, g.bodyY + g.bodyH * .27])} style={{ stroke: accent }} className="thin" />
      {[-1, 1].map(s => <path key={s} d={path([[s * (r + .08) - .17, g.bodyY + .28], [s * (r + .08) + .17, g.bodyY + .28], [s * (r + .08) + .17, g.bodyY + .56], [s * (r + .08) - .17, g.bodyY + .56]])} className="thin" />)}
    </g>
    <g {...part('payload')}>
      <path d={path([[-upperBottom, g.upperY - .45], [upperBottom, g.upperY - .45], [upperTop, g.upperY + .45], [-upperTop, g.upperY + .45]])} />
      <path d={path([[-upperTop * 1.03, g.roof - .05], [upperTop * 1.03, g.roof - .05], [upperTop * 1.03, g.roof + .05], [-upperTop * 1.03, g.roof + .05]])} className="thin" />
      {[-1, 1].map(s => <path key={s} d={path([[s * .42 - .29, g.upperY - .09], [s * .42 + .29, g.upperY - .09], [s * .42 + .29, g.upperY + .25], [s * .42 - .29, g.upperY + .25]])} className="lsc-glass" />)}
      {g.payload && <path d={path([[-.48, 1.92], [.48, 1.92], [.48, 3.08], [-.48, 3.08]])} className="lsc-tank" style={{ stroke: accent }} />}
    </g>
    {spec.hazardSensor !== 'none' && <g {...part('sensors')}>
      <path d={path([[-.31, g.bodyY - .34], [.31, g.bodyY - .34], [.31, g.bodyY + .04], [-.31, g.bodyY + .04]])} />
      {spec.hazardSensor === 'camera'
        ? [-.17, .17].map(x => <circle key={x} cx={px([x, g.bodyY - .15])[0]} cy={px([x, g.bodyY - .15])[1]} r={.1 * VIEW.scale} className="lsc-glass" />)
        : <path d={path([[-.19, g.bodyY + .04], [.19, g.bodyY + .04], [.19, g.bodyY + .3], [-.19, g.bodyY + .3]])} className="lsc-glass" />}
    </g>}
    <g {...part('comms')}>{(() => {
      const base: Pt = [.42, g.roof + .2];
      if (spec.antennaId === 'relay') return <>
        <path d={line([base[0], g.roof], [base[0], base[1] + .55])} /><path d={line([base[0] - .675, base[1] + .55], [base[0] + .675, base[1] + .55])} />
        {[-1, 1].map(s => <path key={s} d={path([[base[0] + s * .42 - .25, base[1] + .33], [base[0] + s * .42 + .25, base[1] + .33], [base[0] + s * .42 + .25, base[1] + 1.0], [base[0] + s * .42 - .25, base[1] + 1.0]])} />)}</>;
      if (spec.antennaId === 'whip') return <>{[-1, 1].map(s => <path key={s} d={line([base[0] + s * .35, g.roof], [base[0] + s * .52, base[1] + 1.15])} />)}</>;
      const tilt = -.45, rim = (x: number, y: number): Pt => [base[0] + x * Math.cos(tilt) - y * Math.sin(tilt), base[1] + .4 + x * Math.sin(tilt) + y * Math.cos(tilt)];
      return <><path d={line([base[0], g.roof], [base[0], base[1] + .35])} />
        <path d={path([rim(-.48, .23), rim(-.3, .09), rim(-.14, .02), rim(0, 0), rim(.14, .02), rim(.3, .09), rim(.48, .23)], false)} />
        <path d={line(rim(0, 0), rim(0, .57))} className="thin" /></>;
    })()}</g>
  </>;
}

export default function LanderSchematic({ readings, shape = {}, children }: { readings: SubsystemReading[]; shape?: LanderShape; children?: ReactNode }) {
  const [active, setActive] = useState<SubsystemId>(readings.find(r => r.level === 'exceeded' || r.level === 'caution')?.id ?? 'struts');
  const selected = readings.find(r => r.id === active)!;
  const g = geometry(shape), spots = anchors(g, shape);
  const key = (id: SubsystemId) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { setActive(id); e.preventDefault(); } };
  const part = (id: SubsystemId) => ({ className: `lsc-part${id === active ? ' on' : ''} ${readings.find(r => r.id === id)!.level}`, onMouseEnter: () => setActive(id), onClick: () => setActive(id) });
  const vehicle = vehicleName(shape.vehicleId);
  const gearName = landingGear.find(g => g.id === shape.landingGearId)?.name.toLowerCase() ?? 'four-leg gear';
  return <div className="lsc">
    <div className="lsc-left">
      <svg className="lsc-drawing" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} role="group" aria-label={`Lander schematic: ${vehicle}, ${gearName}. Choose a subsystem.`}>
        <defs><pattern id="lsc-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" className="lsc-gridline" /></pattern></defs>
        <rect width={VIEW.width} height={VIEW.height} fill="url(#lsc-grid)" />
        <path d={`M0 ${VIEW.ground + 2}H${VIEW.width}`} className="lsc-ground" />
        <text x={VIEW.width / 2} y={VIEW.height - 6} className="lsc-caption">{vehicle} · {gearName} · front elevation, to scale</text>
        <Craft spec={shape} part={part} />
        {readings.map(r => {
          const { at, label: [lx, ly], side } = spots[r.id], [ax, ay] = px(at), width = 104, edge = side === 'left' ? lx + width : lx;
          return <g key={r.id} className={`lsc-callout ${r.level}${r.id === active ? ' on' : ''}`} role="button" tabIndex={0} aria-pressed={r.id === active}
            aria-label={`${r.name}: ${LEVEL_WORD[r.level]}. ${r.headline}`} onMouseEnter={() => setActive(r.id)} onFocus={() => setActive(r.id)} onClick={() => setActive(r.id)} onKeyDown={key(r.id)}>
            <polyline points={`${ax},${ay} ${edge},${ly} ${side === 'left' ? lx : lx + width},${ly}`} className="lsc-leader" />
            <circle cx={ax} cy={ay} r="3.2" className="lsc-dot" />
            <rect x={lx - 4} y={ly - 22} width={width + 8} height="26" className="lsc-hit" />
            <circle cx={lx + 4} cy={ly - 9} r="3.4" className="lsc-light" />
            <text x={lx + 12} y={ly - 5} className="lsc-label">{r.short}</text>
          </g>;
        })}
      </svg>
      {children}
    </div>
    <article className={`lsc-detail ${selected.level}`} aria-live="polite">
      <header><h4>{selected.name}</h4><span className="lsc-badge">{LEVEL_WORD[selected.level]}</span></header>
      <p className="lsc-headline">{selected.headline}</p>
      <h5>Craft spec and tolerance</h5><ul>{selected.spec.map(t => <li key={t}>{t}</li>)}</ul>
      <h5>This flight</h5><ul>{selected.status.map(t => <li key={t}>{t}</li>)}</ul>
      <h5>Earth analog vs target</h5><ul>{selected.analogDelta.map(t => <li key={t}>{t}</li>)}</ul>
    </article>
  </div>;
}
