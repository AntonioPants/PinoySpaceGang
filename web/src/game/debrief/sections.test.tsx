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
import { runSim } from '../../../../app/sim/src/engine';
import { buildSections, stepIndex } from './sections';

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

it('splits the flown report into carousel sections that carry the real telemetry', async () => {
  const { profile, target, mission, flight } = await fly();
  const fidelity = await computeFidelity(mission, profile, catalogSites.find(s => s.id === profile.manifest.id), catalogSites.find(s => s.id === target.id));
  const match = parseCatalog(raw).matching?.comparisons.find(p => p.planetary_id === target.id && p.earth_id === profile.manifest.id);
  const sections = buildSections({ flight, mission, profile, match, fidelity: { status: 'done', result: fidelity } });
  expect(sections.map(s => s.title)).toEqual(['Touchdown', 'Landing assessment', 'Touchdown against limits', 'Flight statistics', 'Rehearsal flights', 'Analog fidelity', 'Analog match', 'Site conditions']);
  const html = Object.fromEntries(sections.map(s => [s.id, renderToStaticMarkup(<>{s.content}</>)]));
  const summary = flight.summary!, a = debriefFor(flight, mission);
  expect(html.touchdown).toContain(`${summary.verticalSpeedMps.toFixed(2)} m/s`);
  expect(html.touchdown).toContain(`${summary.fuelRemainingKg.toFixed(1)} kg`);
  expect(html.assessment).toContain(`${a.scores.overall} / 100`);
  expect(html.assessment).toContain('not engineering ratings');
  expect(html.limits).toContain('Roughness under legs');
  expect(html.statistics).toContain('Delta-v spent');
  expect(html.rehearsal).toContain('Earth analog, mean');
  expect(html.fidelity).toContain(`${fidelity.stress.score} / 100`);
  expect(html.fidelity).toMatch(/>(Success|Failure)</);
  expect(html.conditions).toContain(`${flight.environment.gravity} m/s²`);
  expect(html.touchdown).toContain('What Earth cannot reproduce');
  expect(html.touchdown).toContain('9.81 m/s²');
  expect(html.fidelity).toContain('Catalog landing baseline');
  // No telemetry download and no raw "0.0 m" for a reached target.
  expect(Object.values(html).join('')).not.toMatch(/Download|>0\.0 m</);
});

it('says so instead of showing empty sections while rehearsals run or when no pairing exists', async () => {
  const { profile, mission, flight } = await fly();
  const working = buildSections({ flight, mission, profile, fidelity: { status: 'working' } });
  const text = (id: string, list = working) => renderToStaticMarkup(<>{list.find(s => s.id === id)!.content}</>);
  expect(text('rehearsal')).toContain('still running');
  expect(text('fidelity')).toContain('still running');
  expect(text('match')).toContain('No catalog pairing');
  const failed = buildSections({ flight, mission, profile, fidelity: { status: 'unavailable', reason: 'terrain missing' } });
  expect(text('fidelity', failed)).toContain('terrain missing');
});
