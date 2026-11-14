# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project: Planetary Analog Landing Simulator (NASA Space Apps)

Team PinoySpaceGang is building a web-based landing simulator.

**Core flow:**

1. Pick a Moon/Mars landing site on a 3D globe.
2. Map it to a matching Earth analog terrain.
3. Configure the landing strategy and test inputs.
4. Watch the approach cutscene and run the descent simulation.
5. View the explosion/success cutscene and the engineering report.

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

The frontend is React. The globe, UI and cutscene layout is not decided yet; record it here once it is.

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

**Goal:** Build the main web app, the interactive globes and the mission control screens.

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

- **Opening Cutscene**: the test lander enters the selected Earth analog environment before the
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
