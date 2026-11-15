# Game ownership and delivery requirements

Confirmed by Eyad, 14 November 2026. This is the current ownership agreement;
it supersedes earlier allocations in planning notes and agent context.

## Shared player journey

Title (a ship racing in; click anywhere) → flight in to the three worlds → choose Moon/Mars → choose a study region → transition to
Earth → select a proposed matching site → fly continuously into its measured terrain
→ flag a landing point on it → Select Equipment → configure the lander using arrow controls → Launch Journey
→ Furgan's departure cinematics → Tim's playable character and ship controls
→ launch the landing experiment → Earth approach → live physics → landing outcome
→ Antonio's in-character report.

The worlds' layout is staged for navigation. Terrain heights come from the selected
pack; surface colours are illustrative. Earth analog comparisons are proposals,
not established scientific equivalence. A cinematic must never decide a flight result.

## Eyad — opening experience and integration

Own `web/src/game/opening/OpeningGame.tsx`, `WorldScene.tsx`, `opening.css` and the
opening-to-mission handoff. Deliver interactive world selection, region selection,
Earth matching presentation, a continuous globe-to-terrain camera, and transitions
into the equipment bay. Preserve Antonio's catalog ordering/evidence.

Current delivery: the opening is the default app. The prior engineering planner is
retained at `?engineering-planner`. Cesium streams Moon, Mars and Google Photorealistic
3D Tiles for Earth reconnaissance when available; the original Three.js globe is the
fallback. Screen-projected catalog markers remain clickable over each Cesium view.
The measured Earth DEM is the default site approach and remains the authoritative
simulation terrain; Google 3D imagery is available through a view toggle. Reduced motion snaps camera flights.
Missing WebGL still permits setup through the site lists.

The game occupies one fixed viewport at every stage, including cinematics and live
descent. Starting from the title requests browser fullscreen when supported; rejecting or exiting
browser fullscreen must leave a fully playable viewport game. Do not restore page
headers, max-width wrappers or aspect-ratio video windows around gameplay. Use compact
HUD overlays and internally scrolling controls on small screens.

`earthSurface.ts` attaches the DEM to its geographic tangent frame on a curved Earth
cap, using the globe's reference texture. DEM relief is 1:1 inside its footprint;
the outer curved context is explicitly unmeasured and must never enter physics.
`earthFlight` interpolates above the sphere within the measured DEM view, including
interrupted flights and opposite-side site changes. Keep Earth visible throughout that
approach, and preserve the departing patch until the next approach finishes. Google
imagery is visual context, not measured terrain or landing safety evidence.

## Yousef — equipment and landing gear

Own `web/src/game/opening/equipmentCatalog.ts` and the future equipment model/data
assets. `EquipmentBay.tsx` is the working interactive screen scaffold: arrow buttons
cycle spacecraft, legs and sensors, updating the visible procedural lander.

Replace prototype entries with equipment IDs, names, visual assets, units, provenance,
compatibility and physical parameters. Agree mappings with Tim for mass, leg radius,
stroke/damping/contact behaviour and touchdown limits. Supply each item's limitations.
The three gears are simulated with prototype figures (below), clearly labelled as such, not measured hardware;
while spacecraft mass/thrust/fuel and hazard sensor do feed the existing physics.

The selected IDs travel in `MissionConfig.equipment`, and the gear itself in the settings
(`landingGearId`, `gearStrokeM`, `gearDampingRatio`), resolved by `buildMission` into
`MissionConfig.strategy.landingGear` (`gearPhysics: 'model'`). The model is in `app/sim/src/gear.ts`:
stroke and damping set the sink rate the legs absorb (v = sqrt(2 * 15 m/s2 * stroke * damping)),
the stance and leg count set the static tip angle (atan(R cos(pi/N) / h)) and an energy check
decides a tip-over from slope, tilt, lateral speed, rebound and gravity; pads and stroke set the
relief it stands on; its mass is added to the dry mass in the engine. Presets (`GEAR_PRESETS`):
standard-four 4 legs, 3.0 m, 0.45 m stroke, 75 kg, rated 12 deg; wide-four 4 legs, 3.8 m, 0.40 m,
110 kg, rated 16 deg; survey-six 6 legs, 3.3 m, 0.60 m, 135 kg, rated 14 deg. The rating is the
slope guidance avoids (`maxSlopeToleranceDeg`); the outcome is decided by the dynamics, so the same
touchdown can stay upright in Earth gravity and go over on the Moon. Replace the preset figures
with measured ones there; the drawn stance in `cutscene/lander.ts` must match (a test checks it).
A mission without a gear in its settings keeps the fixed limits. `equipmentSettings` is the mapping seam;
preserve the player's environmental settings when applying equipment. The screen's
`EquipmentBayProps` uses a controlled selection and `onChange` callback.

## Furgan — all cutscenes and performance across systems

Own `web/src/components/cutscene/`, scene/VFX assets, cinematic audio, rendering quality
tiers and performance validation across supported systems. Define supported platforms
and record hardware/browser, FPS, load times and memory; do not claim universal support
from one laptop. Coordinate shared rendering changes with Eyad and Tim.

Register planetary arrival, liftoff and Earth approach in `game/integrations.ts` using
`SceneProps`; any separate outcome takes `OutcomeSceneProps` and actual telemetry. The
Earth opening is attached through Tim's adapter in `game/scenes/`. His `Descent3D`
now flies Furgan's live view and plays the actual outcome itself, so the registry's
separate outcome slot is null to avoid replaying the ending twice. No Earth scene
is mislabeled as a planetary departure. Planetary arrival and liftoff remain empty.
The shared procedural model now draws selected spacecraft, gear and sensor IDs in the
equipment bay, liftoff, Earth approach and live descent. Optional appearance IDs
(`liveryId`, `solarArrayId`, `antennaId`) follow the same mission equipment handoff;
missing IDs use the heritage/standard/dish appearance. They are cosmetic only. Keep Skip available, honor reduced
motion, release renderers/listeners/timers on exit, and start audio only after consent.
Terrain-load failure offers continuation rather than silently substituting terrain.

The host passes optional `SceneProps.immersive` to registered scenes. Forward it to
`Cutscene.fullscreen`: the renderer fills the host, resizes to its actual aspect ratio,
and removes cinema bars in game mode. Embedded planner/demo sizing is unchanged.
Scene controls (sound, skip) float above the scene; the game adds a Credits overlay.

## Tim — playable character, ship controls and physics

Own the character, locomotion/input, in-ship interaction and landing settings plus
`app/sim/`. The third-person ship bridge from `tim/ship-interior` is integrated as
`controlCenter`: three interactive monitors, a pilot seat that opens the launch menu, and a
flat console fallback (see "Ship interior" in `docs/GAME_VISION.md`).
Keep it satisfying `ControlCenterProps`. Read settings, call `onSettingsChange`, show launch errors and
call `onLaunch` for an explicit player action. The host rebuilds and locks the mission.
Keep the systems console as a functional accessibility fallback.

Implement Yousef's real gear parameters in the authoritative physics and telemetry.
Preserve x-east/y-north/z-up metres, site identity, weather identity and the selected
Moon/Mars versus Earth experiment environment. Only the simulation decides outcomes.

## Antonio — terrain matching and in-character debrief

Own proposed pairings, matching methodology and evidence in the shared catalog and
its generation/validation tooling, plus the final scene where the character receives
the landing report. Keep per-pair limitations and uncertainty inspectable; do not
replace reproducibility/sensitivity checks with claims of physical validation.

The opening uses `analogsFor` / `pairingOf` from the runtime catalog. The current final
report is `components/FlightReport.tsx`. Its inputs are the exact flown mission,
terrain, catalog entries and `FlightTelemetry`. Wrap/present these in the character
scene; retain telemetry export, failure reasons, scenario distinctions and retry.
Coordinate with Furgan: landing-outcome visuals finish before the character debrief.

Current delivery: `web/src/game/debrief/DebriefScene.tsx` replaces the flat report in the
game's `report` stage. The astronaut walks to the mission-control monitor, the camera
pushes into its screen, and the report opens there as an eight-section carousel
(`sections.tsx`) with left/right arrows, arrow keys and a burst of TV static between
sections. It reuses Tim's cabin, astronaut and camera helpers read-only and shows only
the flown telemetry. Reduced motion or missing WebGL opens the report directly; "Skip to
report" is always available. Telemetry export was removed at Antonio's request; retry is
kept. Test bench: `?debrief-demo`. The planner still uses `components/FlightReport.tsx`.

## Shared boundaries and integration

- `game/contracts.ts` owns scene and control-center props; `game/integrations.ts`
  registers modules. Add independent scene files rather than modifying the planner.
- `GameSession` owns phase ordering, final mission and duplicate-callback guards.
- Scene modules get the full mission; completion and skip share `onComplete`.
- The landing point flagged on the terrain travels as `MissionConfig.earthAnalog.landingTargetM`
  (x east, y north, metres from the patch centre; absent = centre). `flightSetup` in
  `lib/simulation.ts` turns it into the sim's `target` and moves the approach start with it, so
  the cutscenes, the descent and the report all follow it. `lib/landing.ts` keeps it 600 m inside
  the patch; `GameSession` carries it through the console's relaunch.
- Hardware IDs survive the console and report. The console's sensor change updates
  the final equipment sensor too. Physics remains single-source in `app/sim/`.
- Fetch and merge the latest shared branch before work. Do not force-push or overwrite
  another owner's module. Coordinate contract changes in this document.

Checks: `cd web; pnpm build; pnpm test`, then root
`node scripts/catalog/check-consumers.mjs`. Exercise Moon and Mars selection, a matching
Earth site, terrain zoom/back, every equipment arrow, Launch Journey, console, cinematic
skip, flight, outcome and debrief. Verify small screens, reduced motion and missing assets.

Known remaining work: planetary departure/liftoff, measured equipment
data (the gear physics runs on prototype figures), selected-gear cinematic models, character debrief, performance
profiling and final packaging. These are explicit handoffs, not completed features.

## Lander appearance update (15 November 2026)

The shared `components/cutscene/lander.ts` model adds panel seams, inspection windows,
fasteners, attitude-control pods, a curved engine bell, leg pistons, layered pads and
framed solar cells. Static geometry is merged by material; the flame and deployable
beacon remain separate animation objects. The model stays within 12 meshes for all
45 tested appearance combinations, including payload/six-leg/camera hardware. This
is a draw-call budget check, not a measured frame-rate or device-support claim.

`lib/landerAppearance.ts` owns five coordinated liveries, three solar-array layouts
and three antenna packages. `EquipmentBay` offers Hardware and Appearance sections,
colour swatches, appearance reset and camera reset. Part changes replace the model
without recreating the renderer or resetting the orbit. Controls remain usable when
WebGL initialization fails; reduced motion disables orbit damping. The existing
small-screen rail scrolls internally.

`MissionConfig.equipment` and `EquipmentSelection` now accept the three optional
appearance IDs. Existing spreads preserve them through mission locking and retry.
They do not enter `equipmentSettings` or the physics engine. Foot-circle radii and
pad contact level are unchanged; visual suspension does not imply simulated damping.

Validation: production build and catalog consumer check passed; all 254 tests passed
with `pnpm test --maxWorkers=2`. An unrestricted parallel run timed out in the existing
Earth surface test; it passed with two workers. Live browser QA remains pending:
the local Chromium process cannot open its required socket in this environment,
and the separate remote browser cannot reach the local Vite server. Before merging,
check desktop/mobile layout, all selectors, camera retention/reset, boarding, launch,
cinematic skip, descent, retry, reduced motion and the WebGL fallback.

## Rocket cinematics (15 November 2026)

Liftoff from Earth is now a rocket, not the bare lander: `components/cutscene/rocket.ts`
builds a core stage, four strap-on boosters, an upper stage and a two-piece fairing in
the selected livery, on a launch pad with a service tower. The Earth approach opens on
the same rocket braking in; it jettisons the boosters, splits and sheds the fairing and
releases the player's lander, which then unfolds its legs and solar arrays before
lighting its engine for the unchanged hand-over to the live descent (now 13 s; liftoff
9 s). Legs and arrays are hinged parts of the shared lander model (`setGear`,
`setArrays`, both default to deployed), one draw call each; the static body keeps its
12-mesh budget. Tests check every hardware/appearance combination fits the fairing
folded and returns to the same footprint deployed. The test bench (`?cutscene-demo`)
has Liftoff and a Custom lander toggle. Illustrative only: no rocket physics.

## Polish, click anywhere and first-load (15 November 2026, branch `feature/quest`)

New seams. Nothing in `game/contracts.ts`, `MissionConfig` or the scene registry changed.

- **`WorldScene` is always mounted** from the title to the terrain (Eyad). The Cesium globe
  (`components/MoonGlobe.tsx`, `layered` mode) is a layer above it (`.opening-globe-layer`) that
  fades in once its first tile is visible and the fly-in has finished. `OpeningGame.handCamera`
  passes the camera across through two small handles (`WorldHandle`, `GlobeHandle`): an orbit
  (direction from the world's centre, distance in radii) or a pose over the site (east-north-up
  metres). `WorldScene` takes `paused` and stops drawing while Cesium covers it; `leave()` fades
  Cesium out before a stage change. The Google/measured toggle is the same hand-over, so no
  descent replays. A new site list or pin no longer restarts a camera flight (`framed` key in
  `WorldScene`) or rebuilds the Cesium viewer (points are read through a ref). If Cesium fails
  the player stays on the simple globe; the old offline model is only used by the planner.
- **The site panel is an eggshell card** (`--shell*` tokens in `styles.css`; `opening/DESIGN.md`).
- **A pinned point as a target** (Eyad's opening; Antonio's evidence). `lib/analogClick.ts` calls
  the matching service and builds a synthetic `PlanetarySite` (id `custom-<body>-<lat>-<lon>`).
  In `OpeningGame`, `pin` holds the point and its state; when `pinActive`, `target`, `ranked`
  and `topTen` come from the server's answer, `pairingOf`/`matchOf` are skipped, and
  `AnalogEvidence`, `LandingEvidence`, `MissionControlScreen` and the debrief's match section
  show pinned-point copy (they detect the `custom-` id). `computeFidelity` takes an optional
  planetary profile (Tim: `lib/fidelity.ts`) and then skips the catalog lookup, the pack download
  and the cached baseline; `DebriefScene`, `FlightReport` and `FlightReportNHB` pass it through.
  The mission carries the pin's terrain match as `evidence.quantitativeSimilarityScore` with
  status `unvalidated-pair`.
- **The server** (`supabase/`, new; Antonio's method, Tim's project). One edge function, a cache
  table, the geologic maps and gazetteer in PostGIS. `supabase/README.md` says what is deployed,
  how to verify (`node supabase/verify.ts`) and how to redeploy. Env keys: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` in `web/.env` (public values only). Free-tier projects pause after a
  week idle: restore it in the dashboard before a demo.
- **Pipeline additions** (Antonio): `scripts/catalog/export_click_vectors.py`,
  `scripts/supabase/load_reference.py`, both additive. `web/public/sites.json` is untouched.
- **First load** (Furgan): `vite.config.ts` keeps Vite's preload helper out of the Cesium chunk,
  so the title no longer downloads Cesium; `OpeningGame` fetches it once the worlds settle.

Who should review what: Eyad the opening (`OpeningGame.tsx`, `WorldScene.tsx`, `opening.css`,
`MoonGlobe.tsx`); Antonio the scoring port, the unit-to-family table, the evidence copy and
`docs/ANALOG_MATCHING.md`; Tim `lib/fidelity.ts` and the Supabase project; Furgan `vite.config.ts`.
The rest of the performance pass (quality tiers, hidden-tab pause, lost-context recovery,
renderer audit, GPU warm-up, a lazy catalog) was not done: see the pull request.
