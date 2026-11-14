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

## Current repo state — read this first

The code currently on `main` is **not** the simulator. It is **Field Shift**, the team's earlier
crop-rotation decision-support tool:

- `engine/` is a Python FastAPI science engine.
- `web/` is a Next.js 14 + Tailwind + Leaflet + Recharts frontend.
- `data/snapshot/` holds the pilot-farm data.

Treat it as a starting point and a reference, not as the simulator architecture. Ask before
deleting or repurposing Field Shift code. Existing commands (see `Makefile`, Windows:
`scripts/dev.ps1`):

- `make setup` creates the venv and installs the engine and web dependencies.
- `make engine` runs the engine on :8000. `make engine-offline` runs it with no network access.
- `make web` runs Next.js on :3000.
- `make test` runs pytest on the engine and type-checks the web app.
- `make types` regenerates the OpenAPI schema and the TypeScript types.

The simulator's stack and layout are not decided yet. Record them here once they are.

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

- **`sites.json`** (owned by Yousef & Antonio): planetary sites, their Earth analogs,
  similarity scores, elevation slices and environmental stats (slope, wind, albedo, soil type).
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
