# Terrain comparison viewer

The measured Earth site opens with the selected Moon/Mars DEM superimposed as a cyan
hologram. The live 3D descent has the same overlay; the 2D descent draws a dashed cyan
west-to-east transect at the lander's current northing over the Earth profile.
The **Terrain comparison: on/off** button changes only the reference visualization;
it does not restart a flight. Its preference is shared across the opening and descent
and remembered locally. The existing 2D/3D view switch still starts a new flight.

## Alignment and limits

- Catalog target IDs resolve their terrain manifest URLs; no fixed planetary site.
- Pack centres and their centre elevations coincide. X is east, north remains north,
  and horizontal and vertical distances remain in metres, without relief exaggeration.
- The reference is clipped to the intersection of the two measured footprints.
  Heights are bilinearly sampled; unequal footprints are never stretched to fit.
- 3D uses a translucent surface plus a grid visible through Earth, so a reference
  below the Earth surface is still inspectable. Grid rendering is capped at 128 cells
  per axis. The opening applies the Earth cap's curvature and geographic frame; descent
  uses the actual landing target's origin and Earth reference elevation.
- 2D uses the same camera and scale for both profiles. A large relief difference can
  put the cyan profile outside the chase camera's current window.
- The expandable legend gives alignment, both grid spacings and planetary attribution.
  It labels the match as proposed, not landing validation. The existing Earth credit stays.
- Load failure displays a retry action while the Earth view and flight stay usable.
  Changing target or disabling comparison aborts pending loads; stale results are ignored.
- Hologram geometry/materials and preference listeners are released on removal/unmount.
  No physics, guidance, weather, mission contracts or matching scores change.

## Local verification

`pnpm --ignore-workspace run build`, `pnpm --ignore-workspace run test --maxWorkers=2`
from `web/`, and `node scripts/catalog/check-consumers.mjs` from the root.
The workspace flag accommodates this checkout's pnpm workspace configuration.
Tests include asymmetric north/south orientation, interpolation, unequal grid spacing,
shared footprint clipping, non-centre landing registration and every shipped planetary DEM.
Browser checks cover Moon and Mars references, measured Earth selection, equipment/bridge
handoff, live 3D and 2D, comparison off/on during pause with unchanged telemetry, and
390px controls/details without horizontal overflow. A Mars flight reached touchdown and the
debrief displayed its actual telemetry (1.02 m/s contact speed, 279.6 kg fuel remaining).
