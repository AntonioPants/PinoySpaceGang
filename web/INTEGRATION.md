# Team integration boundary — proposed v1

## Update: catalog, fidelity, sensors, real weather

- **Sites come from the catalog.** `src/lib/catalog.ts` reads `public/sites.json`: every
  planetary target, every Earth analog with a terrain pack, and the proposed pairings (best
  terrain score first). `src/data/sites.ts` is now only a test fixture. Terrain loads from each
  site's own pack, so the Kilbourne-only notes below describe the first version.
- **Analog Fidelity Score.** The flight report flies the configured vehicle autonomously on the
  planetary target's own terrain and on the Earth analog (`src/lib/fidelity.ts`, engine
  `app/sim/src/fidelity.ts`) and shows the score, its four components and the catalog terrain
  score. It compares simulated flights over two elevation grids, nothing more.
- **Sensors and interference.** The configurator offers lidar, camera or no hazard sensor. Dust
  and glare default to values derived from the analog's catalog surface data; manual sliders
  remain. `MissionConfig` gained `strategy.hazardSensor`, `environment.interferenceSource`
  and `environment.realWeather`.
- **Real weather.** In an Earth field test, six sites can use a real modelled hour (month plus
  typical or high-wind) from `data/environment` via `app/lib/environment-site.ts`. The catalog
  and weather site IDs differ; the mapping is `WEATHER_PROFILE_ID` in `src/lib/weather.ts`.
  Earth weather is never applied to a Moon or Mars scenario.


Updated after integrating Tim's engine from main at 5491f1e. The physics module remains unchanged; frontend adapters handle the contract differences.

## Tim: physics (connected)

`src/lib/simulation.ts` maps frontend `MissionConfig` to Tim's `SimInput`.
`Descent.tsx` uses his unchanged `useLanderSim` hook and `SideView` renderer.
`FlightReport.tsx` consumes the actual `FlightTelemetry`, including its summary.
Vite deduplicates React across the two directories; no second physics install is needed.

- The full binary grid goes through `terrainPackToSite`, which flips north-to-south
  input rows into physics south-to-north rows. Physics coordinates are x east,
  y north, z up, centred on the patch. Elevations remain absolute EGM2008 metres.
- The frontend's exported centre-row transect remains relative to the pack's
  1194 m vertical offset. It is a separate 2D convenience field and is not fed
  to the full-grid engine. Do not confuse these frames or subtract twice.
- Scenario gravity is passed explicitly. Native Earth: 9.81 m/s2, 1.225 kg/m3;
  lunar vacuum: 1.62 m/s2, zero density/wind; Mars: UI gravity 3.72 m/s2,
  constant 0.02 kg/m3 density. These are simplified scenario assumptions.
- The frontend overrides dry mass, fuel, maximum thrust, and slope limit.
  Other lander settings use the engine defaults (311 s Isp, drag coefficient 1.2,
  reference area 15 m2, 2.5 m leg radius). Lidar and velocimeter are enabled.
  Dust/glare come from the UI. Seed is 1. Time limit is 300 simulated seconds.
- Start: x=-400 m, y=0, altitude 1000 m AGL; velocity=(25,0,-20) m/s.
  Target is (0,0). These are shown in the preflight screen.
- The view stops flights leaving the measured patch instead of showing an outcome
  based on clamped edge terrain. Restart/configure remains available.
- Report values are model outcomes, not readiness certification. Analog similarity
  and fidelity remain unknown; metre-scale safety cannot be established by a 30 m DEM.
- JSON exports include the frontend mission and raw flight telemetry.

## Conditions import

`importSettings.ts` validates flat/partial settings, a template envelope, or a
frontend mission export. The UI limits files to 128 KB and previews all resulting
settings before Apply. Imported target IDs must be in the known UI catalog.

The optional text parser is intentionally local and constrained: comma-separated
clauses with explicit units. It rejects ambiguous or unrecognized clauses and
repeated fields. It does not call an AI model and never transmits file contents.

## Terrain explorer

`TerrainExplorer.tsx` renders the full measured binary grid with the pack's
north-to-south convention (Three.js x east, y up, z south). Its default vertical
scale is 1. Zoom continuously interpolates the display scale up to 6x; the
1x/3x/6x presets smoothly move the camera to the corresponding zoom. The readout
shows the current displayed scale, and elevation picking divides out that same
rendered scale. Exaggeration is display-only, never a physics input.
This is a local terrain patch reached from the Earth globe, not a streamed global
terrain service. Further fidelity requires georeferenced imagery and finer DEMs.

## Furgan: cutscenes

`ApproachCutsceneProps` contains `{ config, onComplete }`.
`OutcomeCutsceneProps` contains `{ result, onComplete }`.
Provide a Skip action, size to the parent, respect reduced motion, and keep sound
muted until explicit user interaction. Call `onComplete` once per playback.

## Data team

Kilbourne's binary-grid manifest is distinct from the Python pipeline's generic
`data/terrain_profile.schema.json`. `extractProfile` currently supports the
Kilbourne format only; it validates dimensions, bytes, finite samples, spacing,
and offset. Add a separately tested adapter when generic JSON grids arrive.

For validated analog ranking, supply planetary footprints, comparable-resolution
descriptors, component scores, weighting rules, uncertainty, and citations.
`sites.ts` is a temporary UI catalog; don't mistake it for completed science.

## Ownership

Frontend additions are confined to `web/` plus root ignore/readme updates.
The committed terrain pack, Python scripts, and existing Python tests are unchanged.
No teammate's engine or graphics implementation has been replaced.
