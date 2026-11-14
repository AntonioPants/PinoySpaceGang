import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanderSim } from '../react/useLanderSim.ts';
import type { SimInput, SiteTerrain, Vec2 } from '../src/index.ts';
import { DEFAULT_SETUP, SetupPanel, type Setup } from './components/SetupPanel.tsx';
import { SideView } from './components/SideView.tsx';
import { TopView } from './components/TopView.tsx';
import { Hud } from './components/Hud.tsx';
import { EventLog } from './components/EventLog.tsx';
import { ResultCard } from './components/ResultCard.tsx';
import { PRESETS, resolveSite } from './sites.ts';
import { loadViewerCatalog, type UnavailableSite } from './catalog.ts';

function toInput(setup: Setup, fileSites: Map<string, SiteTerrain>): SimInput {
  return {
    site: resolveSite(setup.siteKey, fileSites),
    strategy: setup.strategy,
    sensors: { hazard: setup.hazard, velocimeter: setup.velocimeter },
    interference: setup.siteConditions ? undefined : { dust: setup.dust, glare: setup.glare },
    rockAbundance: setup.rocks ?? undefined,
    gravity: setup.env,
    atmosphere: setup.env,
    lander: { fuelKg: setup.fuelKg, maxThrustN: setup.thrustKN * 1000 },
    seed: setup.seed || 1,
  };
}

// URL shortcuts: ?site=moonRocks&speed=8&launch&at=85
const params = new URLSearchParams(location.search);
const initialSetup: Setup = {
  ...DEFAULT_SETUP,
  siteKey: params.get('site')
    ? PRESETS[params.get('site')!]
      ? `preset:${params.get('site')}`
      : `file:${params.get('site')}`
    : DEFAULT_SETUP.siteKey,
};

export function App() {
  const lander = useLanderSim({ speed: Number(params.get('speed')) || 4 });
  const [setup, setSetup] = useState<Setup>(initialSetup);
  const [fileSites, setFileSites] = useState(new Map<string, SiteTerrain>());
  const [unavailable, setUnavailable] = useState<UnavailableSite[]>([]);
  const [message, setMessage] = useState<string | null>('Pick a setup and launch');

  const launch = useCallback(
    (at?: number) => {
      try {
        lander.launch(toInput(setup, fileSites), { at });
        setMessage(null);
      } catch (err) {
        setMessage((err as Error).message);
      }
    },
    [lander.launch, setup, fileSites],
  );

  // keyboard shortcuts that need the latest launch()
  const launchRef = useRef(launch);
  launchRef.current = launch;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        lander.togglePause();
      }
      if (e.code === 'KeyR') launchRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lander.togglePause]);

  useEffect(() => {
    loadViewerCatalog()
      .then(({ sites, unavailable }) => {
        setUnavailable(unavailable);
        setFileSites((prev) => {
          const next = new Map(prev);
          for (const s of sites) next.set(s.id, s);
          return next;
        });
      })
      .catch((err) => setMessage(`Could not load terrain packs: ${(err as Error).message}`));
  }, []);

  // ?launch: start once the chosen site is available (terrain packs load asynchronously)
  const autoLaunched = useRef(false);
  useEffect(() => {
    if (autoLaunched.current || !params.has('launch')) return;
    if (setup.siteKey.startsWith('file:') && !fileSites.has(setup.siteKey.slice(5))) return;
    autoLaunched.current = true;
    launchRef.current(Number(params.get('at')) || undefined);
  }, [fileSites, setup.siteKey]);

  const { sim, input } = lander;
  const aim: Vec2 = useMemo(() => {
    let a = input?.target ?? { x: 0, y: 0 };
    for (const e of lander.events) if (e.type === 'divert') a = e.to;
    return a;
  }, [lander.events, input]);

  const status =
    message ??
    (sim && input ? `${input.site.id} · g = ${sim.gravity} m/s² · ρ = ${sim.airDensity} kg/m³ · ${input.strategy}` : '');

  return (
    <>
      <header>
        <h1>Lander sim viewer</h1>
        <span className="hint">{status}</span>
      </header>

      <SetupPanel
        setup={setup}
        onChange={setSetup}
        fileSites={fileSites}
        unavailable={unavailable}
        onSitesLoaded={(sites, name) => {
          const next = new Map(fileSites);
          for (const s of sites) next.set(s.id, s);
          setFileSites(next);
          setSetup({ ...setup, siteKey: `file:${sites[0].id}` });
          setMessage(`Loaded ${sites.length} site(s) from ${name}`);
        }}
        onError={setMessage}
        speed={lander.speed}
        onSpeed={lander.setSpeed}
        paused={lander.paused}
        onLaunch={() => launch()}
        onTogglePause={lander.togglePause}
      />

      <main>
        <SideView onFrame={lander.onFrame} paused={lander.paused} />
      </main>

      <section className="right">
        <div>
          <h2>Top view</h2>
          <TopView onFrame={lander.onFrame} input={input} />
        </div>
        <Hud hud={lander.hud} lander={sim?.lander ?? null} aim={aim} />
        {lander.summary && sim && input && (
          <ResultCard
            summary={lander.summary}
            getTelemetry={() => sim.telemetry()}
            fileName={`telemetry-${input.site.id}-seed${input.seed}.json`}
          />
        )}
        <EventLog events={lander.events} />
      </section>
    </>
  );
}
