# sim/ — descent physics engine (Tim)

A headless TypeScript physics engine for the lander. It has no runtime dependencies and imports nothing from the DOM or Three.js, so it works with whichever renderer Eyad picks.

```bash
cd sim && npm install
npm test                 # vitest: physics, autopilot, sites.json parsing
npm run typecheck
npx tsx scripts/run.ts --site moon --hazards            # prints a summary, writes out/telemetry.json
npx tsx scripts/run.ts --site earth-native              # Earth gravity with a lunar engine → crash
npx tsx scripts/run.ts --site path/sites.json:<id>      # fly a real site
```

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

## Using it from the app (Eyad / Furgan)

```ts
import { createSim, createManualPilot, keysToPilotInput, parseSites } from '../sim/src/index.ts';

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

The contracts are in `src/types.ts` (`SimInput`, `SimEvent`, `FlightTelemetry`). The proposed `sites.json` shape is in `fixtures/sites.example.json`, and `parseSite()` validates it.
