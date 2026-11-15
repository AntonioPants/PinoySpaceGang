import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import raw from '../../../public/sites.json';
import { targets, catalogSites } from '../../data/sites';
import { parseCatalog } from '../../lib/catalog';
import { computeFidelity } from '../../lib/fidelity';
import { buildMission, defaultSettings, loadProfile } from '../../lib/mission';
import { toSimInput } from '../../lib/simulation';
import { debriefFor } from '../../lib/debrief';
import { evidenceFor } from '../../components/AnalogEvidence';
import { runSim } from '../../../../app/sim/src/engine';
import { analogDimensions, buildReportExport, buildSections, stepIndex, surfaceOpsAssessment } from './sections';
import { earthElevationFromMoonDeg } from './LanderSchematic';

afterEach(() => vi.unstubAllGlobals());
async function fly() {
  vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(new URL(`../../../public${url}`, import.meta.url))));
  const profile = await loadProfile();
  const target = targets.find(t => t.id === 'marius-hills')!;
  const mission = buildMission(target, profile, defaultSettings);
  return { profile, target, mission, flight: runSim(toSimInput(mission, profile)) };
}

it('steps round the carousel in both directions', () => {
  expect(stepIndex(0, 1, 8)).toBe(1);
  expect(stepIndex(7, 1, 8)).toBe(0);
  expect(stepIndex(0, -1, 8)).toBe(7);
  expect(stepIndex(2, 3, 8)).toBe(5);
});

it('leads with why the pair is an analog, then where it breaks down, then the real flight', async () => {
  const { profile, target, mission, flight } = await fly();
  const fidelity = await computeFidelity(mission, profile, catalogSites.find(s => s.id === profile.manifest.id), catalogSites.find(s => s.id === target.id));
  const catalog = parseCatalog(raw), earthId = profile.manifest.id;
  const match = catalog.matching?.comparisons.find(p => p.planetary_id === target.id && p.earth_id === earthId);
  const evidence = evidenceFor(catalog, target.id, earthId);
  const analogEntry = catalogSites.find(s => s.id === profile.manifest.id), planetaryEntry = catalogSites.find(s => s.id === target.id);
  const input = { flight, mission, profile, match, evidence, fidelity: { status: 'done' as const, result: fidelity }, analogEntry, planetaryEntry };
  const sections = buildSections(input);
  expect(sections.map(s => s.title)).toEqual(['Why this analog', 'What is similar, how similar, and what is not', 'Where the analogy breaks down', 'Terrain and geology', 'Environment and conditions',
    'Landing behaviour on both terrains', 'This flight beside the rehearsals', 'Landing outcome', 'Touchdown against limits', 'Flight statistics', 'How this analog helps exploration']);
  const html = Object.fromEntries(sections.map(s => [s.id, renderToStaticMarkup(<>{s.content}</>)]));
  const summary = flight.summary!, a = debriefFor(flight, mission);

  // The catalog's own evidence for the pair, not generic text.
  expect(html.why).toContain(mission.planetaryTarget.name);
  expect(html.why).toContain(mission.earthAnalog.name);
  expect(html.why).toContain('Why it matches');
  expect(renderToStaticMarkup(<>{evidence.matches[0]}</>)).not.toBe('');
  expect(html.why).toContain(renderToStaticMarkup(<>{evidence.matches[0]}</>));
  expect(html['breaks-down']).toContain('What Earth cannot reproduce');
  expect(html['breaks-down']).toContain('9.81 m/s²');
  expect(html['breaks-down']).toContain(`${mission.planetaryTarget.gravity} m/s²`);
  if (evidence.differences.length) expect(html['breaks-down']).toContain(renderToStaticMarkup(<>{evidence.differences[0]}</>));

  expect(html.environment).toContain(`${flight.environment.gravity} m/s²`);
  expect(html.rehearsal).toContain('Earth analog, mean');
  expect(html.fidelity).toContain(`${fidelity.stress.score} / 100`);
  expect(html.fidelity).toContain('Catalog landing baseline');
  expect(html.fidelity).toMatch(/>(Success|Failure)</);
  expect(html.outcome).toContain(`${summary.verticalSpeedMps.toFixed(2)} m/s`);
  expect(html.outcome).toContain(`${summary.fuelRemainingKg.toFixed(1)} kg`);
  expect(html.outcome).toContain(`${a.scores.overall} / 100`);
  expect(html.outcome).toContain('not engineering ratings');
  expect(html.limits).toContain('Roughness under legs');
  expect(html.statistics).toContain('Delta-v spent');
  expect(html.why).toContain('Field test complete');
  expect(html.why).not.toContain('Analog field test');

  // The challenge's dimensions, each rated from data with its source; Earth's limits are always weak.
  const dims = analogDimensions(input);
  expect(dims.map(d => d.id)).toEqual(['terrain', 'geology', 'temperature', 'water', 'atmosphere', 'biology', 'subsurface', 'operations', 'limits']);
  for (const d of dims) { expect(d.source).not.toBe(''); expect(html.dimensions).toContain(renderToStaticMarkup(<>{d.name}</>)); }
  expect(dims.find(d => d.id === 'limits')!.fit).toBe('poor');
  expect(dims.find(d => d.id === 'biology')!.fit).toBe('na');   // a lunar target
  const t = match?.terrain_similarity_percent ?? null;
  expect(dims.find(d => d.id === 'terrain')!.fit).toBe(t === null ? 'unknown' : t >= 70 ? 'strong' : t >= 50 ? 'partial' : 'poor');

  const all = Object.values(html).join('');
  // A reached target is never a raw "0.0 m", unknowns are never dressed up, and nothing claims microgravity.
  expect(all).not.toMatch(/>0\.0 m<|micro-gravity|Evidence coverage/);
  // Every figure of the form "x m/s²" on the pages comes from the mission or the flight, plus Earth's 9.81.
  const allowed = new Set([9.81, mission.planetaryTarget.gravity, mission.environment.gravityMs2, flight.environment.gravity].map(String));
  for (const [, value] of all.matchAll(/([\d.]+) m\/s²/g)) expect(allowed).toContain(value);

  // The download carries the same report as data.
  const file = buildReportExport(input);
  expect(file.pair.planetaryTarget.id).toBe(target.id);
  expect(file.whyThisAnalog.matches).toEqual(evidence.matches);
  expect(file.analogyByDimension).toEqual(dims);
  expect(file.terrainAndGeology.elevationSources.earth?.url).toMatch(/^https:/);
  expect(file.whyThisAnalog.analogScorePercent).toBe(match?.analog_score_percent ?? null);
  expect(file.whereItBreaksDown.earthCannotReproduce.gravity).toEqual({ targetMs2: mission.planetaryTarget.gravity, earthMs2: 9.81, flownMs2: mission.environment.gravityMs2 });
  expect(file.flight.touchdown).toBe(flight.summary);
  expect(file.flight.statistics).toEqual(a.stats);
  expect(file.landingBehaviour).toMatchObject({ stress: { score: fidelity.stress.score } });
  expect(() => JSON.stringify(file)).not.toThrow();

  // Schematic: six parts, each with spec, flight status and analog delta; struts carry the contact margins.
  expect(html.limits).toContain('Lander schematic');
  expect(file.subsystems.map(r => r.id)).toEqual(['comms', 'sensors', 'avionics', 'engine', 'struts', 'payload']);
  for (const r of file.subsystems) for (const list of [r.spec, r.status, r.analogDelta]) expect(list.length).toBeGreaterThan(0);
  const struts = file.subsystems.find(r => r.id === 'struts')!;
  expect(struts.spec.join(' ')).toContain(`sink ${flight.lander.limits.maxVerticalMps} m/s`);
  for (const m of a.margins.filter(m => m.key !== 'tilt')) expect(struts.status.join(' ')).toContain(m.label);
  if (a.margins.filter(m => m.key !== 'tilt').every(m => m.status === 'within')) expect(struts.level).toBe('nominal'); else expect(['caution', 'exceeded']).toContain(struts.level);
  expect(file.subsystems.find(r => r.id === 'engine')!.status.join(' ')).toContain(`${a.stats.fuelUsedKg.toFixed(0)} of ${a.stats.fuelLoadedKg.toFixed(0)} kg`);
  // Marius Hills is a near-side lunar target: Earth is above the horizon.
  expect(file.subsystems.find(r => r.id === 'comms')!.headline).toBe('Earth in view');

  // Section 10: lunar target, so habitability is marked not applicable rather than scored.
  expect(html['surface-ops']).toContain('Water, ice and ISRU');
  expect(html['surface-ops']).toContain('Not applicable');
  const ops = file.surfaceOperations;
  expect(ops.map(o => o.id)).toEqual(['water-isru', 'mobility', 'subsurface', 'habitability']);
  expect(ops.find(o => o.id === 'habitability')).toMatchObject({ applies: false, level: 'not_applicable' });
});

it('says so instead of showing empty sections while rehearsals run or when no pairing exists', async () => {
  const { profile, mission, flight } = await fly();
  const working = buildSections({ flight, mission, profile, fidelity: { status: 'working' } });
  const text = (id: string, list = working) => renderToStaticMarkup(<>{list.find(s => s.id === id)!.content}</>);
  expect(text('fidelity')).toContain('still running');
  expect(text('rehearsal')).toContain('still running');
  expect(text('why')).toContain('No catalog pairing');
  expect(text('why')).toContain('No pair-specific match evidence');
  expect(text('breaks-down')).toContain('No pair-specific differences');
  expect(text('environment')).toContain('No environment comparison');
  const failed = buildSections({ flight, mission, profile, fidelity: { status: 'unavailable', reason: 'terrain missing' } });
  expect(text('fidelity', failed)).toContain('terrain missing');
  expect(buildReportExport({ flight, mission, profile, fidelity: { status: 'working' } }).landingBehaviour).toEqual({ status: 'working' });
});

it('works out Earth visibility from the Moon and keeps habitability for Mars targets only', async () => {
  expect(earthElevationFromMoonDeg(0, 0)).toBeCloseTo(90);
  expect(earthElevationFromMoonDeg(0, 180)).toBeCloseTo(-90);
  expect(earthElevationFromMoonDeg(-89.55, 0)).toBeCloseTo(0.45, 1);

  const { profile } = await fly();
  const mars = targets.find(t => t.id === 'jezero')!, mission = buildMission(mars, profile, defaultSettings);
  const marsFlight = runSim(toSimInput(mission, profile));
  const ops = surfaceOpsAssessment({ flight: marsFlight, mission, profile, fidelity: { status: 'working' },
    analogEntry: catalogSites.find(s => s.id === profile.manifest.id), planetaryEntry: catalogSites.find(s => s.id === mars.id) });
  const life = ops.find(o => o.id === 'habitability')!;
  expect(life.applies).toBe(true);
  expect(life.level).not.toBe('supported');   // never claimed without biosignature data
  expect(life.landed.join(' ')).toContain('No biosignature');
});

it('ignores negated catalog sentences when looking for caves and pits', async () => {
  const { profile, mission, flight } = await fly();
  const site = (description: string) => ({ ...catalogSites.find(s => s.id === profile.manifest.id)!, name: 'Test site', description, identifiers: [] });
  const subsurface = (description: string) => surfaceOpsAssessment({ flight, mission, profile, fidelity: { status: 'working' }, analogEntry: site(description) })
    .find(o => o.id === 'subsurface')!.analog[0];
  expect(subsurface('Regional volcanic terrain; no cave or safe landing claim.')).toContain('No pit, cave');
  expect(subsurface('Collapse pit studied as a skylight into a lava tube.')).toContain('describes pits, caves');
});

it('names the measured minerals on the terrain page, or says why there are none, and exports them', async () => {
  const { profile, mission, flight } = await fly();
  const base = { flight, mission, profile, fidelity: { status: 'working' as const } };
  const terrain = (input: Parameters<typeof buildSections>[0]) => renderToStaticMarkup(<>{buildSections(input).find(s => s.id === 'terrain')!.content}</>);
  const layer = (key: string, name: string, mean: number, unit = '%') => ({ key, name, unit, min: mean, max: mean, mean, values: [mean] });
  const map = { id: mission.planetaryTarget.id, body: 'moon' as const, kind: 'map' as const, grid: { rows: 1, columns: 1 }, extent_m: { width: 4800, depth: 4800 },
    source: { dataset: 'SELENE/Kaguya Multiband Imager mineral maps', citation: 'Lemelin et al.', page: 'https://example.org', native_resolution_m: 59, retrieved: '2026-01-01' },
    layers: [layer('olivine', 'Olivine', 8.5), layer('feo', 'Iron oxide (FeO)', 19.6, 'wt%'), layer('orthopyroxene', 'Orthopyroxene', 36.4)], caveats: ['a', 'b', 'c'] };
  const withMap = terrain({ ...base, targetMinerals: { map, reason: '' } });
  // most abundant first, with units and the dataset named
  expect(withMap).toMatch(/Orthopyroxene 36%.*Iron oxide \(FeO\) 20 wt%.*Olivine 8\.5%/);
  expect(withMap).toContain('SELENE/Kaguya Multiband Imager mineral maps');
  expect(withMap).toContain('measured across the site');
  const without = terrain({ ...base, targetMinerals: { map: null, reason: 'The Kaguya mineral maps cover 50°N to 50°S only; this site is nearer a pole.' } });
  expect(without).toContain('cover 50°N to 50°S only');
  expect(terrain(base)).not.toContain('Minerals at');   // still loading: nothing claimed
  const file = buildReportExport({ ...base, targetMinerals: { map, reason: '' } });
  expect(file.minerals.target?.layers).toHaveLength(3);
  expect(file.minerals.earth).toBeNull();
  expect(buildReportExport({ ...base, targetMinerals: { map: null, reason: 'none here' } }).minerals.targetUnavailable).toBe('none here');
});
