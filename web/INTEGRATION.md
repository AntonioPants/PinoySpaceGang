# Team integration boundary

## Game session (current handoff)

Read `../docs/GAME_VISION.md` for the agreed game direction. `src/game/GameSession.tsx`
now wraps the descent. It preserves equipment and selected sites through planetary
arrival, control center, liftoff, Earth approach, descent and outcome. Missing
cinematics skip cleanly; the 2D systems console remains playable until Tim's interior
arrives. Register new scenes in `src/game/integrations.ts` using `contracts.ts`.
The console edits `MissionSettings`; launch validates and rebuilds `MissionConfig`
before any departure sequence. The report receives this final mission and real
telemetry. New scenes use the game contracts; older props in `lib/types.ts` are
legacy proposals. Weather is checked against terrain ID.

## Update: catalog, fidelity, sensors, real weather

The merged report retains both guided and stress-test fidelity from Tim's branch.
It uses the runtime-selected catalog entries and the shared strict terrain loader;
the mission catalog remains fetched from `/sites.json`. These simulation scores
remain separate from the catalog's terrain-descriptor score and do not validate
geological equivalence or landing safety.

Data-team build, staging, recovery and validation commands are in
[`docs/CATALOG_PUBLICATION.md`](../docs/CATALOG_PUBLICATION.md). Per-location
environmental coverage and remaining scientific gaps are in
[`docs/DATA_COVERAGE.md`](../docs/DATA_COVERAGE.md).

- **Sites come from the catalog.** `src/lib/catalog.ts` reads `public/sites.json`: every
  planetary target, every Earth analog with a terrain pack, and the proposed pairings (best
  terrain score first). `src/data/sites.ts` uses that same parser for static consumers and legacy-ID support. Terrain loads from each
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


Integrated with the expanded 18-site catalog: 11 Earth terrain packs (including Haughton
and Qaidam) and seven planetary targets. Qaidam has a proposed yardang comparison with
Lucus Planum. All pairings remain unvalidated. The Earth testbed page exposes the same complete
catalog-details component as the physics viewer, including provenance and seasonal data.
The alternate profile importer now rejects missing elevation values instead of filling
them. Catalog JSON is written with LF bytes before hashing on all platforms.

## Tim: physics (connected)

`src/lib/simulation.ts` maps frontend `MissionConfig` to Tim's `SimInput`.
`Descent.tsx` uses his unchanged `useLanderSim` hook and `SideView` renderer.
`FlightReport.tsx` consumes the actual `FlightTelemetry`, including its summary.
Vite deduplicates React across the two directories; no second physics install is needed.

- The full binary grid goes through `catalogSiteToSite` / `terrainPackToSite`, which flips north-to-south
  input rows into physics south-to-north rows. Physics coordinates are x east,
  y north, z up, centred on the patch. Elevations remain absolute EGM2008 metres.
- The frontend's exported centre-row transect remains relative to the pack's
  per-pack vertical offset. It is a separate 2D convenience field and is not fed
  to the full-grid engine. Do not confuse these frames or subtract twice.
- Scenario gravity is passed explicitly. Native Earth: 9.81 m/s2, 1.225 kg/m3;
  lunar vacuum: 1.62 m/s2, zero density/wind; Mars: UI gravity 3.72 m/s2,
  constant 0.02 kg/m3 density. These are simplified scenario assumptions.
- The frontend overrides dry mass, fuel, maximum thrust, and slope limit.
  Other lander settings use the engine defaults (311 s Isp, drag coefficient 1.2,
  reference area 15 m2, 2.5 m leg radius). Hazard sensors follow the mission choice;
  the velocimeter remains enabled.
  UI dust/glare are scenario interference inputs; the new engine also derives site
  interference from catalog substrate, albedo and latitude with provenance.
  Manual wind is the explicit UI speed toward east. Selected Earth weather supplies
  a modelled wind vector and air density instead of the constant Earth defaults.
  Seed is 1. Time limit is 300 simulated seconds.
- Start: x=-400 m, y=0, altitude 1000 m AGL; velocity=(25,0,-20) m/s.
  Target is (0,0). These are shown in the preflight screen.
- The view stops flights leaving the measured patch instead of showing an outcome
  based on clamped edge terrain. Restart/configure remains available.
- Report values are model outcomes, not readiness certification. Calculated terrain
  similarity and flight fidelity remain scientifically unvalidated; metre-scale safety
  cannot be established by a 30 m DEM.
- JSON exports include the frontend mission and raw flight telemetry.

## Conditions import

`importSettings.ts` validates flat/partial settings, a template envelope, or a
frontend mission export. The UI limits files to 128 KB and previews changed
settings before Apply. Legacy target IDs are migrated to shared catalog IDs.
Only imported fields are applied. Changing controls invalidates an open preview.

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

Implement `SceneProps` for liftoff/Earth approach and `OutcomeSceneProps` for the
telemetry-driven outcome, from `src/game/contracts.ts`. Register components in
`src/game/integrations.ts`; no planner or physics changes are needed. The host provides
Skip. Size to the parent, respect reduced motion, and keep sound muted until explicit
user interaction. Call `onComplete` once per playback and clean up resources on unmount.
See `../docs/GAME_VISION.md` for the full sequence and Tim's control-center interface.

## Data team

`src/data/sites.ts` projects `public/sites.json` into navigation labels; it does
not own separate scientific records. Eleven Earth packs and seven planetary regions
are available, including Haughton, Qaidam and Lucus Planum. Proposed pairings sort
first, ranked by available terrain scores; other sites remain usable as experiments.
`loadProfile` supports both Kilbourne's original manifest and the new compact
catalog manifests, deriving width and relief from actual samples. It validates
every sample and the selected site ID. Exports retain the selected pack path.
A stale profile cannot be passed to another site's mission. Planetary DEMs feed
the report's comparisons and catalog terrain scores appear for proposed pairings.
Scientific equivalence and fidelity remain explicitly unvalidated.

## Ownership

Frontend work is in `web/`. Shared data and physics changes arrive through merges
from main; no teammate's engine or graphics implementation has been replaced.
Theme tokens and component styles are in `src/styles.css`; see `DESIGN.md`.
The renderer, hook and simulation engine still have a single owner in `app/sim/`.
