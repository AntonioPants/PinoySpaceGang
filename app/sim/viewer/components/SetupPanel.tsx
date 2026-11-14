import { useState } from 'react';
import { parseSites } from '../../src/index.ts';
import type { SimInput, SiteTerrain } from '../../src/index.ts';
import { PRESETS } from '../sites.ts';
import type { UnavailableSite } from '../catalog.ts';
import { CatalogDetails } from './CatalogDetails.tsx';

export interface Setup {
  siteKey: string;
  strategy: SimInput['strategy'];
  hazard: 'lidar' | 'camera' | 'none';
  velocimeter: boolean;
  /** Derive dust & glare from the site's soil, albedo, snow and sun data. */
  siteConditions: boolean;
  dust: number;
  glare: number;
  /** null = use the site's rock abundance. */
  rocks: number | null;
  env: 'target' | 'native';
  fuelKg: number;
  thrustKN: number;
  seed: number;
}

export const DEFAULT_SETUP: Setup = {
  siteKey: 'preset:moon',
  strategy: 'autonomous',
  hazard: 'lidar',
  velocimeter: true,
  siteConditions: true,
  dust: 0,
  glare: 0,
  rocks: null,
  env: 'target',
  fuelKg: 1500,
  thrustKN: 45,
  seed: 1,
};

interface Props {
  setup: Setup;
  onChange: (s: Setup) => void;
  fileSites: Map<string, SiteTerrain>;
  unavailable: UnavailableSite[];
  onSitesLoaded: (sites: SiteTerrain[], fileName: string) => void;
  onError: (msg: string) => void;
  speed: number;
  onSpeed: (n: number) => void;
  paused: boolean;
  onLaunch: () => void;
  onTogglePause: () => void;
}

export function SetupPanel(p: Props) {
  const { setup } = p;
  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => p.onChange({ ...setup, [k]: v });
  const [fileKey, setFileKey] = useState(0);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      p.onSitesLoaded(parseSites(JSON.parse(await file.text())), file.name);
    } catch (err) {
      p.onError(`sites.json error: ${(err as Error).message}`);
      setFileKey((k) => k + 1);
    }
  };

  return (
    <aside>
      <label htmlFor="site">Site</label>
      <select id="site" value={setup.siteKey} onChange={(e) => set('siteKey', e.target.value)}>
        {Object.entries(PRESETS).map(([k, v]) => (
          <option key={k} value={`preset:${k}`}>{v.label}</option>
        ))}
        {[...p.fileSites.values()].map((s) => (
          <option key={s.id} value={`file:${s.id}`}>{s.name ?? s.id}</option>
        ))}
        {p.unavailable.map(s => (
          <option key={s.id} value={`unavailable:${s.id}`} disabled>{s.name} — unavailable: {s.reason}</option>
        ))}
      </select>
      <p className="hint">Pairings are proposed analog comparisons, not validated landing sites.</p>
      <CatalogDetails site={setup.siteKey.startsWith('file:') ? p.fileSites.get(setup.siteKey.slice(5)) : undefined} />

      <label htmlFor="sitesFile">Load sites.json (synthetic format)</label>
      <input key={fileKey} type="file" id="sitesFile" accept=".json,application/json" onChange={(e) => loadFile(e.target.files?.[0])} />

      <label htmlFor="strategy">Strategy</label>
      <select
        id="strategy"
        value={setup.strategy}
        onChange={(e) => {
          const strategy = e.target.value as Setup['strategy'];
          p.onChange({ ...setup, strategy });
          p.onSpeed(strategy === 'manual' ? 1 : 4);
        }}
      >
        <option value="autonomous">Autonomous (hazard avoidance)</option>
        <option value="manual">Manual (keyboard)</option>
      </select>

      <label htmlFor="hazard">Hazard sensor</label>
      <select id="hazard" value={setup.hazard} onChange={(e) => set('hazard', e.target.value as Setup['hazard'])}>
        <option value="lidar">Lidar</option>
        <option value="camera">Camera</option>
        <option value="none">None</option>
      </select>
      <label className="check">
        <input type="checkbox" checked={setup.velocimeter} onChange={(e) => set('velocimeter', e.target.checked)} />
        <span>Doppler velocimeter</span>
      </label>

      <label className="check">
        <input type="checkbox" checked={setup.siteConditions} onChange={(e) => set('siteConditions', e.target.checked)} />
        <span>Dust &amp; glare from site data</span>
      </label>
      <fieldset disabled={setup.siteConditions}>
        <label htmlFor="dust">Dust interference {setup.dust}</label>
        <input type="range" id="dust" min={0} max={1} step={0.05} value={setup.dust} onChange={(e) => set('dust', Number(e.target.value))} />
        <label htmlFor="glare">Glare interference {setup.glare}</label>
        <input type="range" id="glare" min={0} max={1} step={0.05} value={setup.glare} onChange={(e) => set('glare', Number(e.target.value))} />
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={setup.rocks === null} onChange={(e) => set('rocks', e.target.checked ? null : 0.05)} />
        <span>Rock abundance from site data</span>
      </label>
      <fieldset disabled={setup.rocks === null}>
        <label htmlFor="rocks">Rock abundance {((setup.rocks ?? 0) * 100).toFixed(0)}%</label>
        <input type="range" id="rocks" min={0} max={0.25} step={0.01} value={setup.rocks ?? 0} onChange={(e) => set('rocks', Number(e.target.value))} />
      </fieldset>

      <label htmlFor="env">Gravity &amp; atmosphere</label>
      <select id="env" value={setup.env} onChange={(e) => set('env', e.target.value as Setup['env'])}>
        <option value="target">Target body (Moon/Mars)</option>
        <option value="native">Native (where the terrain is)</option>
      </select>

      <div className="row">
        <div>
          <label htmlFor="fuel">Fuel kg</label>
          <input type="number" id="fuel" min={0} step={100} value={setup.fuelKg} onChange={(e) => set('fuelKg', Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="thrust">Thrust kN</label>
          <input type="number" id="thrust" min={1} step={1} value={setup.thrustKN} onChange={(e) => set('thrustKN', Number(e.target.value))} />
        </div>
      </div>
      <div className="row">
        <div>
          <label htmlFor="seed">Seed</label>
          <input type="number" id="seed" value={setup.seed} onChange={(e) => set('seed', Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="speed">Speed</label>
          <select id="speed" value={p.speed} onChange={(e) => p.onSpeed(Number(e.target.value))}>
            {[1, 2, 4, 8].map((n) => (
              <option key={n} value={n}>{n}×</option>
            ))}
          </select>
        </div>
      </div>

      <div className="buttons">
        <button className="primary" onClick={p.onLaunch}>Launch</button>
        <button onClick={p.onTogglePause}>{p.paused ? 'Resume' : 'Pause'}</button>
      </div>

      <div className="keys">
        Manual: <kbd>W</kbd>/<kbd>S</kbd> throttle · <kbd>←</kbd>
        <kbd>→</kbd> tilt x · <kbd>↑</kbd>
        <kbd>↓</kbd> tilt y · <kbd>X</kbd> cut engine
        <br />
        Anytime: <kbd>Space</kbd> pause · <kbd>R</kbd> relaunch
      </div>
    </aside>
  );
}
