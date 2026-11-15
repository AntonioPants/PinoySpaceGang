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
Do not silently invent gear effects: apart from their footprint width (below) the three gear shapes are visual only,
while spacecraft mass/thrust/fuel and hazard sensor do feed the existing physics.

The selected IDs travel in `MissionConfig.equipment`. The physics already uses each gear's
drawn footprint radius (`web/src/lib/gear.ts`, `gearPhysics: 'footprint'`): slope, roughness
and rocks are measured across it. That is geometry, not gear behaviour; everything else remains pending
until genuine gear behaviour is integrated. `equipmentSettings` is the mapping seam;
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
Use selected equipment IDs for the future animated model; the current cutscene lander
is generic and does not yet depict all selected gear. Keep Skip available, honor reduced
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
data and gear physics, selected-gear cinematic models, character debrief, performance
profiling and final packaging. These are explicit handoffs, not completed features.
