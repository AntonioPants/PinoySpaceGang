/** Run from app/sim: npx tsx ../../scripts/environment/run_landing.ts */
import { readFileSync } from 'node:fs';
import { terrainPackToSite, runSim } from '../../app/sim/src/index.ts';
import { createEarthLandingInput } from '../../app/lib/environment-site.ts';
import type { EnvironmentProfile } from '../../app/lib/environment.mjs';

const root = new URL('../../', import.meta.url);
const pack = new URL('web/public/terrain/kilbourne-hole-v1/', root);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', pack), 'utf8'));
const raw = readFileSync(new URL('elevation.f32', pack));
const terrain = terrainPackToSite(manifest, raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), { analogOf: 'moon' });
const profile: EnvironmentProfile = JSON.parse(readFileSync(new URL('data/environment/kilbourne_hole.json', root), 'utf8'));
const { input, environment } = createEarthLandingInput(terrain, profile, { month: 7, scenario: 'high_wind' }, {
  // PROJ EPSG:32613 meridian convergence at 31.972 N, -106.969 E.
  gridNorthBearingDeg: -1.042894636235898,
});
const telemetry = runSim(input);
console.log(JSON.stringify({
  site: input.site.id, sourceHour: environment.weather.timestamp_utc,
  windGridEastNorthMps: input.site.wind, atmosphere: telemetry.environment,
  missingGroundParameters: environment.missingGroundParameters,
  summary: telemetry.summary,
  note: 'Default lunar-class engine is underpowered for Earth gravity. Failure is a valid result; this example does not tune the vehicle to force success.',
}, null, 2));
