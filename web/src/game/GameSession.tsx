import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { EnvironmentProfile } from '../../../app/lib/environment.mjs';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { CatalogSite } from '../../../app/sim/src/catalog';
import { buildMission, validateSettings } from '../lib/mission';
import { toSimInput } from '../lib/simulation';
import type { MissionConfig, MissionSettings, PlanetarySite, TerrainProfile } from '../lib/types';
import { completePhase, nextPhase, type GamePhase } from './contracts';
import { gameIntegrations } from './integrations';
import SystemsConsole from './SystemsConsole';

const Descent = lazy(() => import('../components/Descent'));
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export default function GameSession({ initialMission, settings: initialSettings, target, entry, profile, weather, weatherAvailable, onReport, onExit }: {
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
  const complete = (expected: GamePhase) => setPhase(current => completePhase(current, expected, gameIntegrations));
  const sceneProps = { mission, reducedMotion, onExit: exit, onComplete: () => complete(phase) };
  function launch() {
    try {
      const errors = validateSettings(settings); if (errors.length) throw new Error(errors.join(' '));
      if (settings.environment === 'earth' && settings.realWeatherMonth > 0 && !weatherAvailable) throw new Error('This site has no weather profile. Select manual wind.');
      const locked = buildMission(target, profile, settings, { terrainBase: mission.earthAnalog.terrainBaseUrl, analogName: mission.earthAnalog.name, terrainScore: mission.evidence.quantitativeSimilarityScore, weatherAvailable });
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
  return <div className="game-session">
    <Suspense fallback={<p role="status">Loading mission systems…</p>}>
      {phase === 'controlCenter' && <SceneBoundary fallback={<SystemsConsole {...consoleProps} />}><ControlCenter {...consoleProps} /></SceneBoundary>}
      {Cinematic && <SceneBoundary key={phase} fallback={fallback}><Cinematic {...sceneProps} /><button className="subtle-button scene-skip" onClick={sceneProps.onComplete}>Skip cinematic</button></SceneBoundary>}
      {phase === 'descent' && <Descent mission={mission} profile={profile} entry={entry} weather={weather} autoStart onExit={exit} onReport={report => { setFlight(report); complete('descent'); }} />}
      {phase === 'outcome' && flight && Outcome && <SceneBoundary key="outcome" fallback={fallback}><Outcome {...sceneProps} flight={flight} /><button className="subtle-button scene-skip" onClick={sceneProps.onComplete}>Skip cinematic</button></SceneBoundary>}
    </Suspense>
  </div>;
}
