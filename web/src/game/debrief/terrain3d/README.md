# Drop-in terrain comparison

This module does not change `sections.tsx` or `DebriefScene.tsx`. Import its default
component and exported `TerrainComparison3DProps` into the appropriate carousel slot:

```tsx
<TerrainComparison3D
  earthProfile={profile}
  targetProfile={loadedTargetProfile}
  earthEntry={analogEntry}
  targetEntry={planetaryEntry}
  rehearsalPoints={[{ x: earthTouchdown.x, y: earthTouchdown.y, footprintRadiusM: 2 }]}
/>
```

The caller owns `loadProfile()`/abort handling for the target. Null/empty buffers
use a clearly labelled synthetic statistical illustration **only when catalog
relief is available**. A corrupt nonempty buffer is an error, never quietly
substituted. Source arrays and catalog objects are not mutated.

`touchdown` is target-local x/east, y/north metres from patch centre. Do not feed
Earth-flight coordinates to it and imply a measured Moon/Mars landing. Earth
telemetry belongs in `rehearsalPoints`. Marker labels can be supplied for the
integrator's surrounding telemetry copy. Out-of-bounds/nodata markers are omitted.
An omitted footprint radius assumes 2 m and says so. Rings are metric; the beacon
and its endpoint are visual locators, not scale spacecraft models.

One renderer, two scissored orthographic views and two synchronized OrbitControls
maintain equal metres/pixel and 1× relief. Each patch mean is removed independently;
planetary and Earth vertical datums are not compared. The scale bar is explicitly
in the camera/view plane, not a distance along a tilted terrain surface. Drag or
touch either pane; right-drag pans, wheel/pinch zooms. Reset and +/- buttons are
keyboard accessible; focused panes also accept +, -, and 0 (reset).

Natural mode uses illustrative body tints and solar geometry, with a 5° default
at lunar polar sites if latitude is supplied, 45° on Earth and 30° otherwise.
Override using metadata solar angles. These are never claimed as acquisition-time
ephemerides, measured albedo, or mapped minerals. The heatmap uses DEM-derived
slopes: <3°, 3–5°, >5°; these are screening bands, not a vehicle's actual tolerance
or a safe-landing certification. Wireframe shows triangles at the supplied grid
resolution. Nodata quads are omitted.

Fallback synthesis is seeded by site ID, scales relief exactly and performs a
bounded search for approximate mean slope and 3×3 local RMS targets. Its actual
mean/P95/relief/RMS are reported; fitting aggregate stats cannot recover real
terrain and catalog RMS support may differ. No synthetic grid feeds simulation,
matching, exports, or the catalog. Missing statistics remain unknown. Without
footprint metadata, the assumed 4.8 km extent is explicitly labelled.

Rendering is demand-driven (no idle animation loop). Resize observers, controls,
geometry, materials, shadow textures, renderer and WebGL context are disposed on
unmount. WebGL failure preserves textual metadata and offers retry. CSS is scoped
under `tc3d`; no global debrief styles are changed.

Verify: `cd web && npm test -- src/game/debrief/terrain3d/data.test.tsx` and
`npm run build`. Integration must mount this component only when its slide is
active so the renderer is freed when navigating away.
