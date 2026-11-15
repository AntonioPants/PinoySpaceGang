import { Component, lazy, startTransition, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { EnvironmentProfile } from '../../../app/lib/environment.mjs';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { CatalogSite } from '../../../app/sim/src/catalog';
import { buildMission, validateSettings } from '../lib/mission';
import { flightSetup, toSimInput } from '../lib/simulation';
import type { MissionConfig, MissionSettings, PlanetarySite, TerrainProfile } from '../lib/types';
import { completePhase, nextPhase, type GamePhase } from './contracts';
import { gameIntegrations, preloadScenes } from './integrations';
import { loadoutFor } from './equipment';
import SystemsConsole from './SystemsConsole';

const Descent = lazy(() => import('../components/Descent'));
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function GameSession({ initialMission, settings: initialSettings, target, entry, profile, weather, weatherAvailable, onReport, onExit, immersive = false }: {
  immersive?: boolean;
  initialMission: MissionConfig; settings: MissionSettings; profile: TerrainProfile;
  target: PlanetarySite; entry?: CatalogSite;
  weather: EnvironmentProfile | null; weatherAvailable: boolean;
  onReport: (flight: FlightTelemetry, mission: MissionConfig, settings: MissionSettings) => void;
  onExit: (settings: MissionSettings) => void;
}) {
  const [phase, setPhase] = useState<GamePhase>(() => nextPhase(null, gameIntegrations));
  const [settings, setSettings] = useState(initialSettings), [mission, setMission] = useState(initialMission);
  const [flight, setFlight] = useState<FlightTelemetry | null>(null), [error, setError] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const reported = useRef(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('mission-title')?.focus({ preventScroll: true });
  }, [phase]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (phase === 'report' && flight && !reported.current) { reported.current = true; onReport(flight, mission, settings); } }, [phase, flight, mission, settings, onReport]);
  const exit = () => onExit(settings);
  useEffect(preloadScenes, []);
  // The Earth site's terrain is loaded and painted in the background from the bridge on, so the
  // Earth approach and the descent start without a freeze.
  useEffect(() => {
    const ctl = new AbortController(), url = mission.earthAnalog.terrainBaseUrl;
    if (url) void import('../components/cutscene').then(async c => {
      const pack = await c.loadTerrainPack(url, ctl.signal);
      const { prepareTerrain } = await import('../components/cutscene/terrain');
      await prepareTerrain(pack, c.simToPack(pack, flightSetup(mission).target ?? { x: 0, y: 0 }), 7, ctl.signal);
    }).catch(() => { /* the scenes paint it themselves */ });
    return () => ctl.abort();
  }, [mission]);
  // As a transition: the current scene stays on screen until the next one is ready to draw, so a
  // scene change never passes through a loading message or an empty screen.
  const complete = (expected: GamePhase) => startTransition(() => setPhase(current => completePhase(current, expected, gameIntegrations)));
  const sceneProps = { mission, reducedMotion, immersive, onExit: exit, onComplete: () => complete(phase) };
  function launch() {
    try {
      const errors = validateSettings(settings); if (errors.length) throw new Error(errors.join(' '));
      if (settings.environment === 'earth' && settings.realWeatherMonth > 0 && !weatherAvailable) throw new Error('This site has no weather profile. Select manual wind.');
      const locked = buildMission(target, profile, settings, { terrainBase: mission.earthAnalog.terrainBaseUrl, analogName: mission.earthAnalog.name, terrainScore: mission.evidence.quantitativeSimilarityScore, weatherAvailable, landingTarget: mission.earthAnalog.landingTargetM });
      if (mission.equipment) locked.equipment = { ...mission.equipment, vehicleId: loadoutFor(settings) ?? mission.equipment.vehicleId, hazardSensor: settings.hazardSensor,
        // the bridge can refit the gear: the settings hold the one that flies
        landingGearId: settings.landingGearId ?? mission.equipment.landingGearId, gearPhysics: locked.strategy.landingGear ? 'model' : mission.equipment.gearPhysics };
      toSimInput(locked, profile, entry, weather); // Validate the complete handoff before any departure scene.
      setMission(locked); setError(''); complete('controlCenter');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare the mission.'); }
  }
  const consoleProps = { ...sceneProps, settings, onSettingsChange: (next: MissionSettings) => { setSettings(next); setError(''); }, onLaunch: launch, error, weatherAvailable, weather };
  const ControlCenter = gameIntegrations.controlCenter;
  const cinematic = phase === 'planetaryArrival' || phase === 'liftoff' || phase === 'earthApproach' ? gameIntegrations[phase] : null;
  const Cinematic = cinematic;
  const Outcome = gameIntegrations.outcome;
  const fallback = <section className="systems-console"><h2>Scene unavailable</h2><p>The cinematic could not be displayed. Your mission is preserved.</p><button className="primary-button" onClick={sceneProps.onComplete}>Continue mission</button><button className="text-button" onClick={exit}>Return to equipment</button></section>;
  return <div className={`game-session${immersive ? ' immersive-game-session' : ''}`} data-phase={phase}>
    <Suspense fallback={<p role="status" className="late-status">Loading mission systems…</p>}>
      {phase === 'controlCenter' && <SceneBoundary fallback={<SystemsConsole {...consoleProps} />}><ControlCenter {...consoleProps} /></SceneBoundary>}
      {Cinematic && <SceneBoundary key={phase} fallback={fallback}><Cinematic {...sceneProps} /><button className="subtle-button scene-skip" onClick={sceneProps.onComplete}>Skip cinematic</button></SceneBoundary>}
      {phase === 'descent' && <Descent mission={mission} profile={profile} entry={entry} weather={weather} autoStart onExit={exit} onReport={report => { setFlight(report); complete('descent'); }} />}
      {phase === 'outcome' && flight && Outcome && <SceneBoundary key="outcome" fallback={fallback}><Outcome {...sceneProps} flight={flight} /><button className="subtle-button scene-skip" onClick={sceneProps.onComplete}>Skip cinematic</button></SceneBoundary>}
    </Suspense>
  </div>;
}
