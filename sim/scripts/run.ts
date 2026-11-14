/**
 * Headless flight from the command line.
 *   npx tsx scripts/run.ts [--site moon|mars|earth-mars|earth-native|<sites.json>:<id>]
 *                          [--strategy autonomous|manual] [--hazards] [--dust 0..1] [--glare 0..1]
 *                          [--sensor lidar|camera|none] [--seed N] [--out file.json]
 * Prints the summary and writes the full telemetry JSON (for mocking the report screen).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runSim, syntheticTerrain, parseSites, createManualPilot } from '../src/index.ts';
import type { SimInput, SiteTerrain } from '../src/index.ts';

const args = process.argv.slice(2);
const opt = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name: string) => args.includes(`--${name}`);

const siteArg = opt('site', 'moon')!;
const hazards = flag('hazards') ? [{ center: { x: 0, y: 0 }, radiusM: 25, count: 60 }] : [];
let site: SiteTerrain;
let gravity: SimInput['gravity'] = 'target';
if (siteArg.includes(':')) {
  const [file, id] = siteArg.split(':');
  const found = parseSites(JSON.parse(readFileSync(file, 'utf8'))).find((s) => s.id === id);
  if (!found) throw new Error(`site ${id} not in ${file}`);
  site = found;
} else if (siteArg === 'moon' || siteArg === 'mars') {
  site = syntheticTerrain({ id: `synthetic-${siteArg}`, body: siteArg, craters: 6, boulderFields: hazards });
} else if (siteArg === 'earth-mars' || siteArg === 'earth-native') {
  site = syntheticTerrain({ id: 'synthetic-earth-analog', body: 'earth', analogOf: 'mars', wind: { x: 5, y: 0 }, boulderFields: hazards });
  if (siteArg === 'earth-native') gravity = 'native';
} else {
  throw new Error(`unknown --site ${siteArg}`);
}

const strategy = (opt('strategy', 'autonomous') as SimInput['strategy']);
const input: SimInput = {
  site,
  strategy,
  gravity,
  atmosphere: gravity,
  sensors: { hazard: (opt('sensor', 'lidar') as 'lidar' | 'camera' | 'none') },
  interference: { dust: Number(opt('dust', '0')), glare: Number(opt('glare', '0')) },
  seed: Number(opt('seed', '1')),
};

// a deliberately naive scripted "pilot" so manual mode can run headless
const pilot = createManualPilot();
const tel = runSim(input, {
  manual:
    strategy === 'manual'
      ? (s) => pilot.update({ throttleAxis: s.velocity.z < -6 ? 1 : -1, stickX: s.velocity.x > 1 ? -1 : 0, stickY: 0 }, 1 / 120)
      : undefined,
});

const s = tel.summary!;
console.log(`site ${tel.siteId}  g=${tel.environment.gravity} m/s²  ρ=${tel.environment.airDensity} kg/m³  strategy=${strategy}`);
console.log(`outcome: ${s.outcome}  survivability ${s.survivability}%  t=${s.flightTimeS.toFixed(1)} s`);
console.log(`touchdown: sink ${s.verticalSpeedMps.toFixed(2)} m/s, lateral ${s.horizontalSpeedMps.toFixed(2)} m/s, slope ${s.slopeDeg.toFixed(1)}°, rocks ${s.roughnessM.toFixed(2)} m, tilt ${s.tiltDeg.toFixed(1)}°`);
console.log(`fuel: used ${s.fuelUsedKg.toFixed(0)} kg, left ${s.fuelRemainingKg.toFixed(0)} kg   miss ${s.distanceFromTargetM.toFixed(1)} m${s.diverted ? ' (diverted)' : ''}`);
if (s.failureReasons.length) console.log(`reasons: ${s.failureReasons.join('; ')}`);
console.log(`events: ${tel.events.map((e) => e.type).join(', ')}`);

const out = opt('out', 'out/telemetry.json')!;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(tel, null, 2));
console.log(`telemetry → ${out} (${tel.samples.length} samples)`);
