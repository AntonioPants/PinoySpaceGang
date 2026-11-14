# Planetary Analog game — team direction

Confirmed by Eyad on 14 November 2026. This document supersedes earlier descriptions
of the product as a website or a flow beginning with an Earth arrival cutscene.
React, Vite and Three.js are the current implementation technology; final desktop
packaging or distribution is not decided. Do not migrate engines as part of integration.

## Intended player journey

1. Select a lunar or Martian region on the planetary globe.
2. See similar Earth terrain candidates, based on the catalog's proposed pairings
   and terrain descriptors. Inspect evidence and choose the Earth test site.
3. Select the spacecraft equipment/loadout to test. Preserve editable vehicle and
   sensor settings; simulation presets are not real spacecraft specifications.
4. Enter the game on the selected Moon/Mars region, including a planetary arrival
   scene when available. The selected planetary site is the departure setting.
5. Inside a 3D ship, interact with screens and control-center equipment to choose
   data and experiment conditions, including wind, sensors and control strategy.
6. Launch from the ship controls. Lock one mission configuration before liftoff.
7. Play departure/liftoff, then the transition and Earth approach/landing visuals.
8. Run Tim's actual descent physics on the selected Earth terrain. Cinematics
   illustrate the journey; only physics determines the flight outcome.
9. Play outcome visuals appropriate to telemetry, then show the engineering debrief.

The trip from Moon/Mars to Earth is game framing, not a simulated interplanetary
trajectory. A Moon/Mars physics scenario over an Earth grid is still distinct from
an Earth field test. Never silently switch physics because a scene changes location.

## Current implementation

- Main through `a1c7e5b` includes Tim's sensor controls, site interference, modelled
  Earth weather, guided comparison and stress-test scores. Existing physics remains
  the authoritative simulation. Scores are model outputs, not validated equivalence.
- The shared catalog now has 11 Earth packs and 7 planetary targets, including
  Haughton, Qaidam and Lucus Planum. The UI reads this catalog rather than a second list.
  Runtime-selected catalog entries pass through the console, physics and both reports.
  Full source records and provenance remain expandable on the Earth testbed screen.
- Tim's `tim/nhb-report-trial` is merged as an optional report view; the black/gold
  game interface remains the default. Both presentations use the same final mission.
- `web/src/game/GameSession.tsx` owns the scene sequence and final mission snapshot.
  It validates settings/terrain/weather before departure, ignores late completion
  callbacks, and passes the exact flown mission to the report.
- The control-center stage is Tim's third-person ship bridge (`web/src/game/interior/`,
  see "Ship interior" below). The flat 2D systems console remains as its fallback. The
  planetary start scene is still pending.
- The descent flies in Furgan's live 3D view (`app/flightlab/view.ts`, wrapped by
  `web/src/components/Descent3D.tsx`). The view steps Tim's physics each frame and draws its
  true state; at touchdown it plays the ending for the real outcome, so the `outcome` slot is
  null. The 2D side view (`Descent2D.tsx`) remains as an alternative: a "2D view" button
  (the choice is remembered), and the automatic choice when 3D cannot start. With reduced
  motion the 3D view still opens and a note points to the calmer 2D view.
- Furgan's opening cutscene is registered as `earthApproach` (adapter in
  `web/src/game/scenes/`) and hands over at the simulation's start state. Sound starts off. With reduced motion a
  still card is shown first, with the option to play the cinematic anyway.
  `liftoff` and `planetaryArrival` remain null and are skipped. The standalone test bench is
  still available with `?cutscene-demo`.
- All earlier planner controls remain available as initial setup/debug controls.
  When the 3D interior is ready, preserve the console as an accessibility fallback.

## Ship interior (control center)

The player sets up the mission on the bridge of the ship, in third person: they walk a
low-poly astronaut round a wide bridge that is flying in space, use three wall
monitors, then sit in the pilot seat to start. Registered as `controlCenter` and implementing
`ControlCenterProps`; `App.tsx` and `GameSession.tsx` are unchanged. Everything is generated
in code (`cabin.ts`, `astronaut.ts`, `exterior.ts`, shared helpers in `lowpoly.ts`); there are
no model files.

**Stations.**

| Key | Station | What it does |
|---|---|---|
| 1 | Mission control | Read-only. Departure site, Earth test site, catalogue terrain score, test physics, and the go / no-go checklist. The parent's launch `error` appears here as a hold. |
| 2 | Equipment | Loadout cards (`equipmentLoadouts`) and sliders for propellant, dry mass, maximum thrust and slope limit, with live thrust to weight. |
| 3 | Flight configuration | Control mode, hazard sensor, sensor interference (site data, or dust and glare sliders), test physics, wind slider or modelled weather (drop-down). |
| 4 | Pilot seat | The astronaut sits and the launch menu opens: open checklist items, a "Play cinematics" tick box, "Start mission" (`onLaunch`) and "Stand up". Starting cuts straight to the departure cinematic. |

"Back to setup" in the toolbar calls `onExit`.

**Controls.** W A S D walk, relative to the camera; ← → or dragging turns the camera (no
pointer lock, so the cursor stays free for the monitors); E uses the monitor or seat in reach
(a prompt names it); 1–4 go straight to a station; Escape steps back. Keyboard only: the
toolbar buttons and Tab reach every control, and focusing a control brings the astronaut and
camera to its monitor. With reduced motion the camera snaps instead of gliding and the stars
do not drift. Movement rules (walls, furniture, where to stand, what is in reach) are pure
functions in `player.ts` and are unit-tested.

**How the monitors work.** Each monitor's content is a real page (React, via a portal) placed
in the scene with Three.js `CSS3DRenderer`, sharing one camera with the WebGL picture. That
keeps text sharp and gives real sliders, buttons, focus and screen-reader access. The pages
sit *underneath* a transparent WebGL canvas, and each monitor is a see-through "hole" in the
3D picture, so the astronaut and furniture pass in front of the screens correctly. Rules that
follow from it:

- The canvas has `pointer-events: none`; clicks go through it to the pages, and dragging to
  look is handled on the surrounding `.cabin-view`.
- A monitor page must not scroll (`overflow` other than visible). The browser does not
  hit-test a scrolling box placed in 3D, so its controls stop receiving clicks. Content has
  to fit the 840 × 490 px page in every state; trim it rather than scroll it.
- The page layer uses `overflow: clip`. Focusing a control otherwise makes the browser scroll
  the layer "into view" and the screens slide off their monitors.
- A page's +Z must face the room: `rotationY = atan2(nx, nz)`, or its text is mirrored.
- Monitor controls come from `screens/ui.tsx` (`Segmented`, `Slider`, `Dropdown`, `Light`).
  The drop-down is drawn inside the page
  because a native menu would open outside the 3D screen.

**Cinematics choice.** The launch menu stores "Play cinematics" in localStorage
(`analog-atlas-cinematics`). `scenes/SceneFrame.tsx` reads it: ticked plays the cinematic even
when the system asks for reduced motion (the menu says so), unticked skips to the descent.

**Go / no-go checklist** (`checklist.ts`). Settings valid (hold if not), thrust to weight in
the gravity the descent will fly (caution below 1; it is a valid experiment that will
probably crash), weather profile present when modelled weather is selected (hold if not).
It only reports. The parent still validates and locks the mission at launch.

**Fallback.** "Use flat console" switches to `SystemsConsole`, and it is used automatically
when WebGL cannot start or the window is narrower than 760 px. Settings carry over both ways.

**Look.** The bridge should read as an engineered crew cabin (Orion, Dragon, ISS, Shuttle
flight deck), not neon sci-fi. Keep to these rules when adding to it:

- Neutral palette: off-white wall panels with seams, grey structure, dark floor and console tops.
- Only these emit light: the monitors, the ceiling light panels, the dim dashboard displays and
  a few small indicators. No glowing trim, floor strips or coloured lights.
- Colour carries meaning: blue and yellow handrails, one yellow/black caution stripe (the
  hatch sill), red only on guarded switches.
- Monitor pages follow flight displays: near-black background, grey text, one muted blue for
  the selected state and slider fill; green / amber / red only for go / caution / hold.
- Light: ACES tone mapping, the Sun through the window and a soft overhead light, both casting
  shadows, plus neutral fill. The finished cabin is merged into one mesh per material
  (`mergeStatic` in `lowpoly.ts`); without that the frame rate halves.

**What is illustrative.** The bridge, the astronaut and the view outside are a stage, not a
model of a real spacecraft or a real orbit. The Moon or Mars in the window (chosen by
`mission.planetaryTarget.body`) and the distant Earth wear NASA imagery, listed with sources
in `web/public/textures/bridge/SOURCES.md`: LRO/LROC colour mosaic (NASA SVS CGI Moon Kit),
Viking MDIM 2.1 colour mosaic (NASA/JPL/USGS) and Blue Marble (NASA GSFC). They are
decoration: sizes, distances and lighting are for looks and they do not show the selected
sites. The instrument pages on the dashboard are dressing with made-up values.

**Adding a station.** Add it to `STATIONS` in `stations.ts` (id, title, key, wall position,
inward normal), add an obstacle box if it has a console, write its screen in
`screens/`, and add one portal line in `ShipInterior.tsx`. The cabin builds the monitor
housing and console from the station list.

## Contracts and ownership

`web/src/game/contracts.ts` is the active integration contract. Older
`ApproachCutsceneProps` / `OutcomeCutsceneProps` in `lib/types.ts` are legacy proposals;
new scenes should use the game contracts, which carry the full mission/telemetry.

Tim: implement `ControlCenterProps` for the ship interior; optionally implement
`SceneProps` for `planetaryArrival`. Read `settings`, call `onSettingsChange` with
updated settings, and call `onLaunch` only for an explicit player launch. Render
the supplied `error` when launch validation fails. The parent owns mission creation.
Use the selected `mission.planetaryTarget` for the exterior/starting environment.

Furgan: implement independent `SceneProps` components for `liftoff` and
`earthApproach`, and `OutcomeSceneProps` for `outcome`. Register them in
`web/src/game/integrations.ts`. Arrival uses `mission.planetaryTarget`; Earth visuals
use `mission.earthAnalog`. `flight.summary` is authoritative for success/crash/timeout.
Never replace a timeout with a successful landing animation.

For example, a new `EarthApproach` component can export a function accepting
`SceneProps`, then be imported and assigned to `gameIntegrations.earthApproach`.
Do not edit `App.tsx`, `GameSession.tsx`, or Tim's engine merely to attach a scene.
Large scene modules may be registered with `React.lazy`; the host supplies Suspense.

Scene rules:

- Call `onComplete()` on completion; the host provides Skip with the same action.
  Call `onExit()` to return to setup. Duplicate or late completion calls are ignored.
- Honor `reducedMotion` and expose a keyboard-usable path. No mandatory audio or
  pointer lock just to progress. Audio requires a player gesture.
- Release timers, animation loops, event listeners, pointer lock, audio and WebGL
  resources on unmount. Render within the parent; no independent router or root.
- Do not start physics during a cinematic. It starts once after Earth approach.
  Do not mutate the passed mission. The final snapshot and actual telemetry feed debrief.
- Report failed asset loads and allow completion/Skip. Render errors have a host
  fallback; missing assets must not strand the player.

Eyad: maintain game orchestration, equipment/setup, ranked Earth selection,
settings import/export and reports. Yousef/Antonio: catalog, terrain and provenance.

## Merge and verification checklist

Work on a feature branch; fetch main and review overlapping changes. Avoid importing
the archived `field-shift-app` crop application. Keep assets and scene components in
separate folders to minimize overlapping edits. Do not force-push shared branches.

Run `cd web && pnpm build && pnpm test`, then from root
`node scripts/catalog/check-consumers.mjs`. Browser checks should cover selecting a
new location, changing a loadout, boarding, changing console conditions, launching,
completion/Skip, descent outcome and debrief. Confirm the report uses console edits.
Test return-to-setup, rapid duplicate completion, reduced motion and a missing asset.
Include scene credits/licences. No placeholder success results or invented imagery claims.

## Integration verification (14 November 2026)

- Production TypeScript/Vite build passes; a bundle-size advisory remains.
- 115 web/physics tests pass, including all 11 Earth packs through load/export/simulation,
  scene ordering, duplicate completion guards and wrong-site weather rejection.
- Catalog consumer checks and all four Node environment tests pass.
- Browser: equipment → console edits → automatic descent → touchdown → both report
  styles → retry retains the flown settings. Invalid wind blocks launch. Console
  checked at 390 px width without horizontal overflow.
- Python publication tests were not run in this checkout because pytest is not installed.
  The catalog assets are consumed unchanged from main and pass the JavaScript checks.
