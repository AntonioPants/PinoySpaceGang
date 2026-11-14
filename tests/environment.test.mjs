import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createSimulationInputs, loadEnvironmentProfile, requireGroundParameters } from '../app/lib/environment.mjs';
const directory = new URL('../data/environment/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', directory)));
const profiles = await Promise.all(catalog.sites.map(async s => JSON.parse(await readFile(new URL(s.file, directory)))));

test('all six sites support every month/season and both coherent scenarios', () => {
  for (const profile of profiles) {
    for (const selection of [...Array.from({length: 12}, (_,i) => ({month: i+1})), ...['DJF','MAM','JJA','SON'].map(season => ({season}))]) {
      for (const scenario of ['typical','high_wind']) {
        const input = createSimulationInputs(profile, {...selection, scenario});
        assert.ok(input.weather.air_temperature_k > 0);
        const [x,y,z] = input.weather.wind_vector_m_s;
        assert.equal(y, 0);
        assert.ok(Math.abs(Math.hypot(x,z)-input.weather.wind_speed_m_s) < 1e-8);
        assert.equal(input.missingGroundParameters.length, 5);
        assert.equal(input.ground.bearing_capacity_pa.value, null);
        assert.equal(input.radiationContext.albedo.units, '1');
        assert.equal(input.weather.albedo, undefined);
      }
    }
  }
});

test('reject ambiguous selection and unsupported material defaults', () => {
  const profile = profiles[0];
  for (const selection of [{}, {month: 1,season:'DJF'}, {month:13}, {month:1.5}, {season:'summer'}, {month:1,scenario:'gust'}]) assert.throws(() => createSimulationInputs(profile, selection));
  assert.throws(() => createSimulationInputs(profile, {month:1,materialOverrides:{contact_friction:{value:0.5}}}), /evidence and source/);
  const input = createSimulationInputs(profile, {month:1,materialOverrides:{contact_friction:{value:0.5,evidence:'assumed',source:'test-only scenario'}}});
  requireGroundParameters(input,['contact_friction']);
  assert.throws(() => requireGroundParameters(input,['bearing_capacity_pa']), /unavailable/);
  assert.throws(() => requireGroundParameters(input,['typo']), /Unknown/);
  assert.equal(input.ground.contact_friction.evidence,'assumed');
  assert.equal(profile.soil.bearing_capacity_pa,null);
});

test('meteorological north wind points south in the terrain coordinate frame', () => {
  const profile = structuredClone(profiles[0]);
  Object.assign(profile.months['1'].scenarios.typical,{wind_speed_m_s:10,wind_from_deg:0,wind_east_m_s:0,wind_north_m_s:-10});
  assert.deepEqual(createSimulationInputs(profile,{month:1}).weather.wind_vector_m_s,[0,0,10]);
  profile.months['1'].scenarios.typical.pressure_pa = null;
  assert.throws(() => createSimulationInputs(profile,{month:1}), /invalid weather/);
});

test('HTTP loader serves profiles and handles invalid IDs / missing files', async () => {
  const server = createServer(async (req,res) => {
    const site = catalog.sites.find(s => `/${s.file}` === req.url);
    if (!site) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type','application/json');
    res.end(await readFile(new URL(site.file,directory)));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/`;
    const loaded = await loadEnvironmentProfile(base,'kilbourne_hole');
    assert.equal(loaded.site.id,'kilbourne_hole');
    await assert.rejects(loadEnvironmentProfile(base,'../secrets'), /Invalid site/);
    await assert.rejects(loadEnvironmentProfile(base,'unknown'), /404/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
