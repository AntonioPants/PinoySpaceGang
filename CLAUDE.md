# Current team agreement

Read [TEAM_HANDOFF.md](docs/TEAM_HANDOFF.md). Its ownership and current implementation supersede the historical notes below.

# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project: Planetary Analog Landing Simulator (NASA Space Apps)

Read [AGENTS.md](AGENTS.md) and [docs/GAME_VISION.md](docs/GAME_VISION.md) first.
They define the current game direction and supersede older website-only framing.

Team PinoySpaceGang is building a playable planetary analog game using React/Three.js.
Select a Moon/Mars region, match an Earth testbed, choose equipment, enter the
planetary ship environment, configure conditions on interactive ship screens,
launch, transition to Earth descent, and debrief the actual physics outcome.

The game opens on a title screen and runs full-screen: worlds, region, Earth test site,
equipment bay, Tim's third-person ship bridge (`web/src/game/interior/`), Furgan's liftoff,
Furgan's Earth-approach cutscene, the live 3D descent and the debrief. The old planner is at
`?planner`; the flat console is the bridge's fallback. Register scenes with
web/src/game/integrations.ts; see contracts.ts in that directory. Do not duplicate the
simulation or mission state.

Local testing and CI: `npm run setup`, `npm run dev`, `npm run check` from the repo root
(see [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md)); `.github/workflows/ci.yml` runs the same
checks on every push. The live site is https://analog.timhufnagel.org (see
[deploy/README.md](deploy/README.md)).

## Repo layout — read this first

The Field Shift crop tool is gone. `main` was rebuilt as the simulator (see `README.md`):

- `data/`: the terrain data pipeline (owned by Yousef & Antonio). `terrain_profile.schema.json` is the
  JSON terrain format, `catalog_manifest.json` lists the data sources, and `processed/` holds the
  committed profiles.
- `scripts/`: the Python fetch/extract tools (`extract_profile.py` etc.). Run tests with `pytest`.
- `web/public/terrain/<id>/`: browser-ready terrain packs (e.g. `kilbourne-hole-v1`: `manifest.json`
  + `elevation.f32` + `terrain.glb`).
- `app/`: the real-time frontend and physics engine.
  - `app/sim/` is the descent physics engine (TypeScript, zero runtime deps, Vitest), owned by Tim.
    Run `cd app/sim && npm install && npm test`, `npm run typecheck`, `npm run viewer` (React + Vite
    dev viewer), `npx tsx scripts/run.ts --site moon --hazards`. The contracts are in
    `app/sim/src/types.ts`. React integration goes through `app/sim/react/useLanderSim.ts`. Loaders
    for the team's terrain formats are `profileToSite()` (terrain_profile JSON) and
    `terrainPackToSite()` (manifest + `.f32`). See `app/sim/README.md`.

Eyad's mission frontend is React/TypeScript + Vite in `web/`, beside the terrain
pack's existing public assets. It uses Three.js globes and a local measured 3D
terrain explorer, JSON/text condition import, and connects to Tim's engine through
`web/src/lib/simulation.ts` and the unchanged `useLanderSim` hook. Flight reports
consume actual telemetry. Run `cd web && pnpm install && pnpm dev`; `pnpm build`
typechecks/builds and `pnpm test` includes frontend and physics tests. See
`web/INTEGRATION.md` for coordinate conventions and cutscene interfaces.
Furgan's cutscenes (Three.js, generated in code) are in `web/src/components/cutscene/`; test bench:
open the web app with `?cutscene-demo`. His opening cutscene plays as `earthApproach` and his live 3D
view flies the descent and its ending (`web/src/components/Descent3D.tsx`). His Flight
Lab (live 3D descent with sliders) is in `app/flightlab/`: `npm install && npm run build` writes
`dist/flight-lab.html`. Prebuilt previews are in `docs/previews/`.
The game registry has arrival, liftoff, Earth approach and outcome slots: liftoff is Furgan's
blast-off cutscene (`web/src/game/scenes/LiftoffScene.tsx`), Earth approach is Furgan's cutscene,
arrival is still empty, and outcome is null because the 3D descent plays the ending.

## Team roles and ownership

### 🌍 Yousef & Antonio: Geospatial & Planetary Data Leads

**Goal:** Supply the real-world space and Earth terrain data that powers the map and physics.

- Pull open datasets from NASA Earthdata, LRO/Diviner, PDS, CSA RADARSAT and ESA Copernicus.
- Select 4–6 target Moon/Mars landing sites based on topography, geology, environment and
  resources.
- Identify and characterize matching Earth analog locations. Combine known sites with newly
  discovered, under-characterized analogs.
- Calculate similarity scores between each planetary site and its Earth analog.
- Export clean elevation slices and environmental stats (slope, wind, albedo, soil type) into a
  shared **`sites.json`** for Eyad and Tim.

### 🌐 Eyad: Frontend, 3D Globes & Mission UI Lead

**Goal:** Build the game shell, interactive globes, equipment setup, mission orchestration and reports.

- **3D Moon/Mars Globe** with highlighted landing zones, plus camera transitions to the
  **Earth Analog Map** view.
- **Strategy & Analog Configurator**, where users pick a landing method and enter test
  parameters: fuel, thrust, sensor suite, and Earth-to-Moon/Mars gravity and atmosphere
  adjustments.
- **Post-Flight Engineering Report** showing landing telemetry, survivability and an
  **Analog Fidelity Score**.
- Wire every screen into one smooth end-to-end flow.

### ⚙️ Tim: Descent Simulation & Physics Lead

**Goal:** Build the core landing mechanics, the physics engine and the pass/fail logic.

- Descent physics engine driven by the terrain elevation profiles from `sites.json`: gravity,
  thruster force, fuel burn, wind drag and terrain collision.
- Selectable landing strategies: autonomous hazard avoidance vs. manual thruster/gimbal control.
- Environmental sensor interference, such as dust or snow glare.
- Touchdown thresholds (vertical and horizontal velocity, fuel remaining, ground slope tilt)
  that decide success or crash.
- Output the final flight telemetry object to Eyad's report screen.

### 🎬 Furgan: Cutscenes, VFX & Game Visuals Lead

**Goal:** Bring the simulation to life with cinematic sequences, visual polish and feedback.

- **Departure and Earth Approach Cutscenes**: leave the selected Moon/Mars region after ship-console launch, then enter the chosen Earth analog before the
  simulation begins.
- **Ending Cutscenes**:
  - On failure: crash/explosion with fireballs, debris particles and camera shake.
  - On success: clean touchdown, dust dissipation and beacon deployment.
- Lander visuals, thruster exhaust, dust plumes, terrain textures and sound effects, all driven
  by Tim's physics events.

## Interfaces between workstreams

These are the integration contracts. Keep them stable, and when one changes, update every
consumer in the same change.

- **Terrain data** (owned by Yousef & Antonio, formerly called `sites.json`): planetary sites, their
  Earth analogs, similarity scores, elevation slices and environmental stats (slope, wind, albedo,
  soil type). Delivered as `data/terrain_profile.schema.json` profiles and `web/public/terrain/<id>/` packs.
  - **Hour 6 checkpoint:** lock the key structure early, even with sample numbers, so Eyad and
    Tim can build against real keys immediately.
- **Simulation input** (from Eyad to Tim & Furgan): the chosen site plus strategy inputs
  (method, fuel, thrust, sensors, gravity/atmosphere adjustments) go into the simulation canvas.
- **Physics events** (from Tim to Furgan): events such as thruster firing, dust kick-up,
  touchdown and crash, which trigger VFX, cutscenes and sound.
- **Flight telemetry** (from Tim to Eyad): the final telemetry object (touchdown velocities,
  fuel remaining, slope tilt, success/crash, survivability inputs) that feeds the report screen.

Once the exact schemas for these contracts exist, document them here or link to them, for
example `docs/sites.schema.json` and `docs/telemetry.md`.

## Working conventions

- Use real open data (NASA, CSA, ESA) and cite the source dataset for every number shown to
  users.
- Build against the agreed contracts with sample data first. Do not block on final data.
- Before editing another person's area, keep changes within that role's ownership above or
  coordinate through the shared contracts.
