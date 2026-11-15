# Cutscenes and VFX (Furgan)

See also `app/flightlab/README.md`: the Flight Lab flies the physics live in 3D with sliders and
uses this module for its scene and endings.

Opening and ending cutscenes in Three.js, driven by Tim's physics (`app/sim`) and shown on the
data team's terrain packs. No asset files: lander, particles and sound are generated in code.

## Try it now

Open `docs/previews/cutscene-preview.html` in a browser. One file, everything inlined: the Kilbourne Hole pack
and five flights recorded from `app/sim` (success, hard landing, tip-over, two crashes).

## Add to the repo

The module lives in `web/src/components/cutscene/`, with recorded test flights in
`web/public/cutscene-demo/`. It uses the web app's `three` and React. Test bench: run the web app
and open it with `?cutscene-demo` (the original Next.js demo page became `CutsceneDemo.tsx`).

## Use with the physics

    import { Cutscene } from "./components/cutscene";
    const lander = useLanderSim();
    const env = { name: site.name, subtitle: "Earth analog for ...", preset: "desert" };

    // 1. before the flight: hands over exactly at the sim's start state
    <Cutscene kind="opening" env={env} terrainUrl="/terrain/kilbourne-hole-v1/"
      start={simInput.start} target={simInput.target}
      onDone={() => lander.launch(simInput)} />

    // 2. when lander.summary is set: replays the real flight
    <Cutscene kind="ending" env={env} terrainUrl="/terrain/kilbourne-hole-v1/"
      flight={lander.sim.telemetry()} onDone={showReport} />

What follows the physics:

- **Liftoff** (`kind="liftoff"`): the rocket (`rocket.ts`, painted in the lander's livery) stands
  on a pad with a service tower, lights its core and four boosters, raises a dust and steam
  sheet, climbs and pitches over. It flies no physics.
- **Opening:** the same rocket arrives braking, drops its four strap-on boosters (4.0 s), opens
  and sheds its fairing (5.2 s) and releases the lander (6.4 s), which unfolds its legs and solar
  arrays (`Lander.setGear` / `setArrays`). The lander flies a straight line at `start.velocity`
  and is at `start.position` on the last frame (defaults match the sim: 1000 m up, 400 m west
  of the target, 25 m/s east, 20 m/s down). The landing target is marked on the ground.
- **Ending:** replays the last 7 s of `flight.samples` (4.5 s for a crash) in real time: path,
  throttle (plume, dust, sound) and tilt. Then by `summary.outcome`:
  - `success`: legs settle, beacon deploys.
  - `hard-landing`: heavier impact, sparks, amber beacon.
  - `tip-over`: the lander falls over downhill on the real slope.
  - `crash`: explosion scaled by impact speed, debris thrown along the flight direction and
    falling under the simulated gravity.
  - `timeout`: caption only.
- Captions show the sim's numbers and its first failure reason.
- The scene is centred on the sim's target (opening) or `summary.landingPoint` (ending), converted
  to the pack with `simToPack`. This assumes the site was made with `terrainPackToSite` (grid
  centred on 0, 0), as `app/sim` does.

`kind="success"` and `kind="crash"` still exist as stand-ins without a flight
(`params={{ vy, vx, tiltDeg, reason }}`).

Other props: `terrain={pack}` if the pack is already loaded, `muted`, `onDone`. Mount the
component after a user click, otherwise the browser blocks sound. Without React:
`new CutsceneEngine(div, env, { terrain, landing }).play("ending", { flight })`.

## Terrain

- Heights are 1:1 with the pack. The whole pack is drawn, plus a finer patch within 400 m of the
  landing point with about a metre of procedural detail and scattered rocks. Those are for looks,
  not data. Beyond the pack edge the ground is extended flat to the horizon.
- The Copernicus credit required by the pack's licence is shown at the bottom of every cutscene.
- Colours come from `preset` / `look` (desert, ice, volcanic, crater, lunar, mars); packs have no imagery.
- Without a pack a procedural landscape is used.

## Approximations

- Telemetry has tilt size but not direction; the lander leans the way its horizontal acceleration points.
- The cutscene shows the Earth site with Earth sky and dust even when the sim flies it with Moon or Mars gravity.
- The opening shows the engine lighting 2 s before hand-over; the sim starts with throttle 0.

## Tuning

Timings and cameras: `opening()` and `ending()` in `engine.ts`. `engine.seek(kind, seconds, params)`
shows a single frame.

## Not done

- VFX inside Tim's live 2D viewer (`app/sim/viewer`). These are separate full-screen cutscenes.
- Sound was written but never heard. Everything was checked as still frames in headless Chrome,
  not in motion. The cutscenes are not yet wired into the mission planner's descent screen.

AI disclosure for the submission: this code was generated with Claude (Anthropic).
