/**
 * Test bench for the in-character debrief: open the app with ?debrief-demo. It flies one
 * autonomous landing on the default terrain and plays the debrief for that real flight.
 * Add &target=<planetary id> to pick the comparison target.
 */
import { useEffect, useState } from 'react';
import type { FlightTelemetry } from '../../../../app/sim/src/types';
import { runSim } from '../../../../app/sim/src/engine';
import { catalogSites, targets } from '../../data/sites';
import { loadCatalog, matchOf, type Catalog } from '../../lib/catalog';
import { buildMission, defaultSettings, loadProfile } from '../../lib/mission';
import { equipmentSettings, initialEquipment, type EquipmentSelection } from '../opening/equipmentCatalog';
import { toSimInput } from '../../lib/simulation';
import type { MissionConfig, TerrainProfile } from '../../lib/types';
import { evidenceFor } from '../../components/AnalogEvidence';
import DebriefScene from './DebriefScene';

export default function DebriefDemo() {
  const [run, setRun] = useState(0), [error, setError] = useState('');
  const [data, setData] = useState<{ flight: FlightTelemetry; mission: MissionConfig; profile: TerrainProfile; catalog: Catalog | null } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      const profile = await loadProfile(abort.signal);
      const wanted = new URLSearchParams(location.search).get('target');
      const target = targets.find(t => t.id === wanted) ?? targets.find(t => t.id === 'shackleton-rim') ?? targets[0];
      // Optional equipment from the URL, e.g. &vehicle=payload&gear=survey-six&antenna=relay&solar=extended&sensor=camera&livery=ember
      const q = new URLSearchParams(location.search), pick = (key: string) => q.get(key) ?? undefined;
      const selection = { ...initialEquipment, ...Object.fromEntries(Object.entries({ vehicleId: pick('vehicle'), landingGearId: pick('gear'), antennaId: pick('antenna'),
        solarArrayId: pick('solar'), hazardSensor: pick('sensor'), liveryId: pick('livery') }).filter(([, v]) => v)) } as EquipmentSelection;
      const mission = buildMission(target, profile, equipmentSettings(selection, defaultSettings));
      mission.equipment = { ...selection, gearPhysics: 'footprint' };
      const catalog = await loadCatalog(abort.signal).catch(() => null);
      if (!abort.signal.aborted) setData({ flight: runSim(toSimInput(mission, profile)), mission, profile, catalog });
    })().catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Could not prepare the demo flight.'); });
    return () => abort.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Flying a demo landing…</p>;
  const { flight, mission, profile, catalog } = data, analogId = profile.manifest.id, targetId = mission.planetaryTarget.id;
  return <div style={{ position: 'fixed', inset: 0, background: '#030405', color: '#eeeae1', fontFamily: "'Inter Variable', sans-serif" }}>
    <DebriefScene key={run} flight={flight} mission={mission} profile={profile}
      match={catalog ? matchOf(catalog, targetId, analogId) : undefined}
      evidence={catalog ? evidenceFor(catalog, targetId, analogId) : undefined}
      analogEntry={catalogSites.find(s => s.id === analogId)} planetaryEntry={catalogSites.find(s => s.id === targetId)}
      reducedMotion={window.matchMedia('(prefers-reduced-motion: reduce)').matches} onRetry={() => setRun(n => n + 1)} />
  </div>;
}
