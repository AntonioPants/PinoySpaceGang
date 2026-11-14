# sim/ — descent physics engine (Tim)

A headless TypeScript physics engine for the lander. It has no runtime dependencies and imports nothing from the DOM or Three.js, so it works with whichever renderer Eyad picks.

```bash
cd app/sim && npm install
npm test                 # vitest: physics, autopilot, sites.json parsing
npm run typecheck
npx tsx scripts/run.ts --site moon --hazards            # prints a summary, writes out/telemetry.json
npx tsx scripts/run.ts --site earth-native              # Earth gravity with a lunar engine → crash
npx tsx scripts/run.ts --site pack:../../web/public/terrain/kilbourne-hole-v1   # real Copernicus DEM
npx tsx scripts/run.ts --site profile:../../data/processed/earth_analogs/<id>.json --analog mars
```

## Real site conditions

- **Boulders below the DEM's resolution:** each site's *rock abundance* (Diviner on the Moon, TES/THEMIS on Mars) becomes a seeded boulder field using the Golombek & Rapp (1997) size–frequency model (`src/surface.ts`). If the site has a `roughness_rms_m` grid, rough patches get more rocks. Lidar and camera hazard scans see the rocks, and touchdown checks for a rock under the footprint.
- **Dust and glare from data** (`src/environment.ts`): dust comes from the soil type, and glare from albedo, snow cover, sun elevation and shadow. The configurator can still override both.
- **Wind and gusts:** a mean wind vector plus gusts.
- **Site catalog:** `catalogSiteToSite()` (`src/catalog.ts`) turns an entry of the data team's `web/public/sites.json` plus its terrain pack into a site, copying substrate, albedo, wind speed and latitude with their sources. The catalog has no wind direction, so that is a scenario option (`windTowardDeg`). For real hourly wind vectors on the six US sites, use Yousef's `app/lib/environment-site.ts`.

## Analog Fidelity Score

`analogFidelity(planetarySite, analogSite)` (`src/fidelity.ts`) flies the same lander on both terrains under the planetary gravity and atmosphere and scores how well the analog flight predicts the planetary one: 40% outcome agreement, 25% touchdown speeds, 20% ground slope and roughness, 15% fuel used.

```bash
npx tsx scripts/fidelity.ts --seeds 3     # every catalog pairing → out/fidelity.json
```

With today's coarse planetary terrain (150–500 m per pixel) and no rock-abundance data, every pairing lands cleanly and scores 93–100, so the score does not yet separate good analogs from poor ones.

## Browser viewer (React)

```bash
npm run viewer        # Vite + React 18, opens http://localhost:5199
```

The viewer has a side view that follows the lander and zooms in as it descends, with dust, explosions and tip-over animations. A top-view hillshade marks unsafe ground in red and shows the hazard-scan ring, the divert point and the flight path. It also shows a live HUD, an event log and a result card with a telemetry JSON download. You can fly manually with <kbd>W</kbd>/<kbd>S</kbd> and the arrow keys, and load a real `sites.json`. URL shortcuts: `?site=moonRocks&speed=8&launch` and `&at=85` to jump to t = 85 s.

## What it models

| | |
|---|---|
| Integrator | fixed step (1/120 s), semi-implicit Euler, seeded RNG, so the same seed gives the same flight |
| Forces | gravity, thrust along the body axis (gimbal rate limited), drag `½ρv²CdA` relative to the site wind |
| Fuel | `ṁ = T / (Isp·g0)` |
| Terrain | bilinear heightmap; slope and rock/rim roughness measured across the leg footprint |
| Touchdown | crash / tip-over / hard-landing / success against Apollo LM limits (3.0 m/s sink, 1.2 m/s lateral, 12° slope) plus a survivability % |
| Autopilot | sink-rate profile + braking to the aim point + Apollo-P66-style hover-and-translate; one ALHAT-style hazard scan at 250 m with a divert to the safest spot |
| Sensors | dust adds noise and dropouts to the altimeter and velocimeter below 30 m; glare blurs a camera's hazard view (lidar is barely affected); no velocimeter means noisier velocity readings |
| Environment | Earth analog sites fly with the **target** body's gravity and air density by default (`gravity: 'native'` or a number overrides) |

Default vehicle: an Apollo LM-class lander (7 t dry, 1.5 t fuel, 45 kN, Isp 311 s). Override it with `input.lander`.

## Using it from React (Eyad / Furgan)

`react/useLanderSim.ts` is the integration hook, and the viewer in `viewer/App.tsx` uses it. The physics steps in a `requestAnimationFrame` loop outside React's render cycle. React state (`hud`, `events`, `summary`) refreshes at about 15 Hz. Canvas or Three.js views draw from `onFrame`:

```tsx
const lander = useLanderSim({ speed: 1 });            // keyboard manual flight built in
lander.launch({ site, strategy: 'autonomous', sensors: { hazard: 'lidar' } });
useEffect(() => lander.onFrame((sim, dt, input) => drawScene(sim.state)), [lander.onFrame]);
// lander.hud → HUD, lander.events → Furgan's VFX triggers, lander.summary → report screen
```

## Using the engine directly (any framework)

```ts
import { createSim, createManualPilot, keysToPilotInput, parseSites } from './sim/src/index.ts'  // path from app/;

const site = parseSites(sitesJson).find((s) => s.id === chosenId)!;
const sim = createSim({
  site,
  strategy: 'autonomous',            // or 'manual'
  sensors: { hazard: 'lidar', velocimeter: true },
  interference: { dust: 0.6, glare: 0.2 },
  gravity: 'target',                 // configurator: 'target' | 'native' | number
  lander: { fuelKg: 1200, maxThrustN: 40000 },
});

sim.on((e) => vfx.handle(e));        // Furgan: engineOn/Off, dustKickup, divert, touchdown, crash, tipOver, ...

const pilot = createManualPilot();
function frame(dt: number) {
  const controls = manual ? pilot.update(keysToPilotInput(pressedKeys), dt) : undefined;
  sim.advance(dt, controls);         // fixed-step accumulator inside
  render(sim.state);                 // position, velocity, tiltX/Y, throttle, fuel
  hud(sim.observe());                // noisy sensor view (what the pilot sees)
  if (sim.state.done) showReport(sim.telemetry()); // Eyad: summary + samples + events
}
```

The contracts are in `src/types.ts` (`SimInput`, `SimEvent`, `FlightTelemetry`). The data team's formats load with `profileToSite()`, for `terrain_profile` JSON from `scripts/extract_profile.py`, and `terrainPackToSite()`, for `web/public/terrain/<id>/manifest.json` + `elevation.f32`. `parseSite()` reads the simpler synthetic format in `fixtures/sites.example.json`.
