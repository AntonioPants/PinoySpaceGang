# Flight Lab

Live 3D descent over a terrain pack, flown by the physics engine in `app/sim`. Every setting is a
slider; the engine re-flies the descent headlessly on each change and shows the predicted outcome,
then Launch flies the same flight in real time.

    cd app/flightlab
    npm install
    npm run build        # writes dist/flight-lab.html, one self-contained file

Open `dist/flight-lab.html` straight from disk. `npm run build -- <pack-id>` inlines another pack
from `web/public/terrain/`.

## What is real and what is not

- **Physics:** `app/sim` unmodified (`createSim`, `autopilot`, `terrainPackToSite`). The lab only
  builds a `SimInput` from the sliders and passes its own `autopilot({...})` options. The 3D view
  draws `sim.state` every frame: position, `tiltX`/`tiltY`, throttle.
- **Prediction:** a full headless flight with the same seed, so the live flight matches it.
  "Min fuel / min thrust for success" are found by bisection (9 flights each).
- **Terrain heights:** the pack, 1:1. Within 400 m of the target about a metre of procedural
  detail is added for looks; the lander follows the drawn surface below 60 m.
- **Terrain colours (Kilbourne Hole):** assigned from elevation and slope using published
  descriptions of the site (basalt rim cliffs, scree, surge beds, east-side dunes, dry lakebed,
  desert scrub). The pack has no imagery, so this is an interpretation, not a land-cover map.
  See `KILBOURNE_STYLE` in `web/src/components/cutscene/terrain.ts`.
- **Test boulders:** synthetic. When the slider is above 0 the pack is resampled to a 2 m grid
  and the rocks are added to the heightmap the physics flies on, and drawn in the scene.
- **Hazard map:** the dots drawn at the scan use the true terrain and the autopilot's own safety
  rule. The autopilot itself sees a noisier view under glare, so it can disagree with the dots.
- **Plume and dust:** follow the simulated air density, wind and gravity (wide plume and
  ballistic dust in vacuum, billowing wind-blown dust in air). These are visual models, not CFD.

## Files

- `main.ts` sliders, scenarios, prediction, HUD, map, charts.
- `view.ts` `FlightView`, the live 3D view (extends the cutscene engine).
- `build.mjs` bundles everything with esbuild.

URL parameters for testing: `?sc=<scenario>`, `?launch&at=60&run=3` (jump to T+60 s, run 3 s, hold),
`?cam=chase|orbit|ground|top`, `?intro`, `?strategy=manual`.

## Not verified

Checked as still frames in headless Chrome. Not tried by hand: dragging sliders during a flight,
clicking the map, mouse look, keyboard flying, sound.

AI disclosure for the submission: this code was generated with Claude (Anthropic).
