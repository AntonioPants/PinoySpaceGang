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
- The control-center stage is Tim's first-person lander cabin (`web/src/game/interior/`,
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

The player sets up the mission from inside the lander, in first person. The camera is the
character; there is no visible body. Registered as `controlCenter` and implementing
`ControlCenterProps`; `App.tsx` and `GameSession.tsx` are unchanged.

**Stations.** Four monitors and a porthole on the walls of an eight-sided cabin:

| Key | Station | What it does |
|---|---|---|
| 1 | Mission control | Read-only. Departure site, Earth test site, catalogue terrain score, test physics, and the go / no-go checklist. The parent's launch `error` appears here as a hold. |
| 2 | Equipment | Loadout choice (`EquipmentPicker`, `equipmentLoadouts`) and the manifest. |
| 3 | Flight configuration | Strategy, hazard sensor, test environment, wind or modelled weather, dust and glare. The same `ConsoleControls` component as the flat console. |
| 4 | Launch | Open checklist items, "Launch mission" (`onLaunch`) and "Return to equipment" (`onExit`). |
| 5 | Window | The Moon or Mars outside, by `mission.planetaryTarget.body`. Changes nothing. |

**Controls.** W A S D walk and sidestep; arrow keys walk and turn; drag to look (no pointer
lock, so the cursor stays free for the monitors); E steps up to the nearest monitor; 1–5 go to
a station; Escape steps back from a field. Keyboard only: the toolbar buttons and Tab reach
every control, and focusing a control walks the player to its monitor. With reduced motion the
camera snaps to stations instead of gliding.

**How the monitors work.** Each monitor's content is a real page (React, via a portal) placed
in the scene with Three.js `CSS3DRenderer`, layered over the WebGL canvas with one shared
camera. That keeps text sharp and gives real buttons, menus, focus and screen-reader access.
Two rules follow from it:

- A monitor page must not scroll (`overflow` other than visible). The browser does not
  hit-test a scrolling box placed in 3D, so its controls stop receiving clicks. Content has
  to fit the monitor; trim it rather than scroll it.
- The pages are drawn on top of the canvas, so nothing in the cabin can pass in front of a
  monitor. Keep fittings off the line of sight to the screens.

**Go / no-go checklist** (`checklist.ts`). Settings valid (hold if not), thrust to weight in
the gravity the descent will fly (caution below 1; it is a valid experiment that will
probably crash), weather profile present when modelled weather is selected (hold if not).
It only reports. The parent still validates and locks the mission at launch.

**Fallback.** "Use flat console" switches to `SystemsConsole`, and it is used automatically
when WebGL cannot start or the window is narrower than 760 px. Settings carry over both ways.

**What is illustrative.** The cabin is a stage generated in code, not a model of a real
spacecraft. The view outside is a generic lunar or Martian surface in the cutscene module's
colour presets, not the selected site: the catalogue's planetary terrain is 150–500 m per
sample, far too coarse to stand on.

**Adding a station.** Add it to `STATIONS` in `stations.ts` (id, title, key, wall angle in
steps of 45°), write its screen in `screens/`, and add one portal line in `ShipInterior.tsx`.
The cabin builds the monitor housing from the station list.

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
