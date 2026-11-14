import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import raw from '../../public/sites.json';
import { targets, catalogSites } from '../data/sites';
import { parseCatalog } from './catalog';
import { computeFidelity } from './fidelity';
import { buildMission, defaultSettings, loadProfile } from './mission';
import { toSimInput } from './simulation';
import { debriefFor, rehearsalRows } from './debrief';
import { runSim } from '../../../app/sim/src/engine';
import FlightDebrief from '../components/FlightDebrief';

afterEach(() => vi.unstubAllGlobals());
function localFetch() {
  vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(new URL(`../../public${url}`, import.meta.url))));
}
async function fly(settings = defaultSettings) {
  localFetch();
  const profile = await loadProfile();
  const target = targets.find(t => t.id === 'marius-hills')!;
  const mission = buildMission(target, profile, settings);
  return { profile, target, mission, flight: runSim(toSimInput(mission, profile)) };
}

it('debriefs the flown mission with scores, margins, statistics, rehearsal and match evidence', async () => {
  const { profile, target, mission, flight } = await fly();
  const a = debriefFor(flight, mission);
  expect(a.outcome).toBe(flight.summary!.outcome);
  expect(a.margins).toHaveLength(5);

  const fidelity = await computeFidelity(mission, profile, catalogSites.find(s => s.id === profile.manifest.id), catalogSites.find(s => s.id === target.id));
  const rows = rehearsalRows(flight, fidelity.guided)!;
  expect(rows.map(r => r.flown)).toEqual([flight.summary!.verticalSpeedMps, flight.summary!.horizontalSpeedMps, flight.summary!.slopeDeg, flight.summary!.roughnessM, flight.summary!.fuelUsedKg]);
  expect(rows.every(r => Number.isFinite(r.planetary) && Number.isFinite(r.analog))).toBe(true);

  const match = parseCatalog(raw).matching?.comparisons.find(p => p.planetary_id === target.id && p.earth_id === profile.manifest.id);
  const html = renderToStaticMarkup(<FlightDebrief flight={flight} mission={mission} fidelity={fidelity} match={match} />);
  for (const text of ['Landing assessment', 'Survivability', 'Touchdown against limits', 'Roughness under legs', 'Flight statistics', 'Delta-v spent', 'Your touchdown beside the rehearsal flights', 'not engineering ratings'])
    expect(html).toContain(text);
  expect(html.includes('Analog match evidence')).toBe(Boolean(match));
  expect(html).toContain(`>${a.scores.grade}<`);
});

it('explains a fuel-starved flight and omits the sections that need missing data', async () => {
  const { mission, flight } = await fly({ ...defaultSettings, fuelMassKg: 50, dryMassKg: 5000 });
  const a = debriefFor(flight, mission);
  expect(a.outcome).toBe('crash');
  expect(a.causes.map(c => c.code)).toContain('fuel-out');
  const html = renderToStaticMarkup(<FlightDebrief flight={flight} mission={mission} />);
  for (const text of ['Why the flight ended this way', 'Fuel ran out', 'For the next flight', 'over limit']) expect(html).toContain(text);
  for (const text of ['rehearsal flights', 'Analog match evidence']) expect(html).not.toContain(text);
});
