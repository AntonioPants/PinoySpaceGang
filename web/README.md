# Analog Atlas — frontend

The current shell for the planetary analog game. See `../docs/GAME_VISION.md`.
Equipment setup now leads to a functional systems console and the live descent.
Tim's 3D interior and Furgan's cinematics attach through `src/game/integrations.ts`.

Eyad's first mission-planner slice: React, TypeScript, Vite and Three.js.
The application lives in `web/` to serve the team's existing `public/terrain/`
pack in place. No Python process, API keys, or backend server is needed.

## Run

Use Node 22.12+ and pnpm 11+ (or npm). From `web/`:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. `pnpm build` performs strict TypeScript
checking and creates `dist/`. `pnpm test` checks the terrain/mission adapter.
With npm, use `npm install`, `npm run dev`, `npm run build`, and `npm test`.
Keep the pnpm lockfile as the team's dependency source of truth.

## Implemented

- Responsive mission workspace with Moon/Mars target selection and orbitable globes.
- Click an available globe marker or location row to open its 3D terrain directly.
  Other candidates still show their missing-data state. Terrain supports orbit/pan/zoom,
  top view and elevation inspection. Zoom smoothly links displayed height exaggeration
  from 1x through 3x to 6x, with preset views and a live scale readout. Elevation colours
  are illustrative; no satellite imagery or global terrain tiles are included.
  Measurements and physics retain their original scale. Reduced-motion preferences
  disable the animated zoom/preset interpolation.
- Shared catalog selection: eleven Earth packs, seven Moon/Mars targets, per-site transects and statistics.
- “Why this analog?” evidence, limitations, sources and model-derived terrain scores.
- Manual/autonomous configuration, mass/thrust/slope inputs, Earth vs planetary environment.
- Lunar vacuum disables wind; initial thrust-to-weight ratio reflects wet mass and scenario gravity.
- Local draft persistence, mission review and downloadable JSON.
- JSON settings import (128 KB maximum), including exported mission files, plus a local
  rule-based condition parser. Both require a preview/apply step and validate units/ranges.
- Tim's real `useLanderSim` hook and side renderer, using the full terrain grid through
  `catalogSiteToSite`. Supports autonomous/manual descent, pause/restart, and playback speed.
- Flight reports and downloadable telemetry, with unvalidated analog fidelity explicitly retained.
- Guided-flight and blind-landing stress comparisons against the planetary terrain.
- Equipment presets, ship systems console, sensor selection, site-derived interference,
  and regional modelled weather at six Earth sites.
- Keyboard-operable alternative site lists, native modal focus handling, reduced-motion camera transitions.
- Loading/retry handling, unavailable-data gating, and a WebGL-unavailable fallback.

Descent and report navigation unlock when a mission and a completed flight exist.
There is no mock flight result. Furgan's cinematic cutscenes are still pending.
See `INTEGRATION.md` and `src/game/contracts.ts` for the live integration boundary.

## Importing conditions

Use **Get template** or upload a previously exported mission JSON. Files stay local.
Partial settings preserve existing values; unknown fields, targets, units, malformed
JSON and out-of-range values are rejected. Review the resulting configuration before
applying it. Lunar vacuum explicitly overrides requested wind to zero.

The text entry is a small deterministic parser, not an AI integration. Example:
`Earth, manual, fuel 500 kg, thrust 20 kN, wind 12 m/s, dust 30%`.
Unrecognized clauses are rejected instead of silently guessing conditions.
No API token is needed. A general-purpose AI interpreter would require a server-side
provider integration; never embed its credentials in the frontend.

`pnpm test` runs both frontend tests and Tim's unchanged physics tests.

## Data boundaries

`src/lib/catalog.ts` loads navigation from `public/sites.json`. Proposed pairings
sort first, ranked by available terrain scores. Haughton and Qaidam now have local packs.
Each available Earth site loads its own measured terrain and retains provenance
through mission export and descent. Planetary DEMs feed report comparisons;
terrain scores and flight fidelity remain scientifically unvalidated model outputs.

Terrain remains under its supplied Copernicus licence and attribution. Globe
images and typography are presentation assets, not scientific evidence; see
`public/textures/ATTRIBUTION.md`. Inter, DM Mono and Michroma are self-hosted via Fontsource under
the SIL Open Font License; all terrain and globe textures are served locally.
See `DESIGN.md` for the black, warm-white and gold interface system.
