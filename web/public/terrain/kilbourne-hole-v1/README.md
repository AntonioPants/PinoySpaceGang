# Kilbourne Hole: first Earth terrain for the web team

This pack supplies a real, coarse terrain surface for rendering, collision and
route experiments in a React/Node application. It is a **known analog baseline**,
not a newly discovered analog or a validated match to a specific Mars/lunar site.

## Site and evidence

Kilbourne Hole, New Mexico, USA is a volcanic **maar**, not an impact crater.
The selected crop centre is **31.972° N, 106.969° W**; this is a processing choice,
not a surveyed landmark. NASA documents Apollo field training here and discusses
its volcanic-process relevance to planetary exploration:

- [NASA: Apollo field training](https://science.nasa.gov/blogs/notes-from-the-field/2018/02/05/the-footsteps-of-apollo-astronauts/)
- [NASA: Kilbourne and Aden](https://science.nasa.gov/blogs/notes-from-the-field/2018/01/24/kilbourne-and-aden-two-flavors-of-volcanism/)
- [BLM: site geology](https://www.blm.gov/visit/kilbourne-hole-volcanic-crater)

The elevation source is **Copernicus DEM GLO-30 Public**, part of the Copernicus
resource family supplied for this challenge. We downloaded its public AWS mirror
(2021 release), not the latest authenticated CDSE release. The manifest records
the exact tile, URL and SHA-256. No account or API key is needed to use this pack.

## Files

| File | Use |
| --- | --- |
| `terrain.glb` | glTF 2.0 terrain mesh; import with Three.js, React Three Fiber/Drei, Babylon.js, or another glTF loader |
| `elevation.f32` | 161 × 161 little-endian float32 elevations, in metres above EGM2008 |
| `load-terrain.mjs` | Dependency-free fetch, geometry builder and triangle-consistent height sampler |
| `manifest.json` | Scale, coordinates, provenance, unknown physics parameters and limitations |
| `location.geojson` | WGS84 map footprint and selected centre; coordinates are longitude, latitude |
| `elevation-utm.tif` | Reprojected float32 elevation grid, EPSG:32613; vertical datum remains EGM2008 |
| `source-window-wgs84.tif` | Unresampled native source samples around the patch, with a small processing halo |
| `heightmap-16bit.png` | Optional normalized heightmap; use the manifest's decoding formula, not browser canvas 8-bit values |
| `slope-degrees.tif` | Slope estimated from the 30 m grid, in degrees |
| `preview.png` | Shaded terrain and slope chart; not satellite photography |
| `checksums.json` | SHA-256 and size for every other pack file |
| `ATTRIBUTION.txt`, `COPERNICUS-LICENSE.pdf` | Retain these when sharing or publishing |

## Coordinate contract: share this with the physics team

- **1 unit = 1 metre**, without vertical exaggeration.
- The mesh is **4,800 × 4,800 m**, with **161 × 161 vertices** at **30 m** intervals
  and **51,200 triangles**. Grid spacing is not a guarantee of 30 m resolving power.
- Right-handed local axes: **+X = UTM grid east, +Y = up, +Z = UTM grid south**.
- Local `(0, 0, 0)` is the northwest sample at the manifest's vertical offset.
- `x = column * 30`, `z = row * 30`, `y = elevation - vertical_offset_m`.
- The binary array is **absolute elevation**, while the GLB/loader vertices are
  **relative height**. Do not subtract the offset twice.
- To map local positions back to UTM: `E = northwest_sample_easting_m + x`,
  `N = northwest_sample_northing_m - z`. Transform EPSG:32613 to EPSG:4326 for maps.
- Rows run north to south; columns run west to east. UTM grid north differs
  slightly from true north. Do not treat degree differences as metres.
- GeoTIFF pixel centres coincide with mesh vertices; the raster's outer boundary
  extends half a cell beyond them. The GeoJSON follows the mesh perimeter.

## Use in React / Node

The pack already lives in Next.js's `web/public/terrain/kilbourne-hole-v1/`.
It is served as `/terrain/kilbourne-hole-v1/` when that app runs. For another
React app, copy the entire folder into its static/public directory. There is no
new database, Node API or runtime Python dependency.

For a team already using Three.js, inside its existing client-side scene setup:

```js
import * as THREE from "three";

const { loadTerrain } = await import(/* webpackIgnore: true */ "/terrain/kilbourne-hole-v1/load-terrain.mjs");
const terrain = await loadTerrain();
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(terrain.positions, 3));
geometry.setIndex(new THREE.BufferAttribute(terrain.indices, 1));
geometry.computeVertexNormals();
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x9b896d }));
scene.add(mesh); // Supply lighting/camera in your scene; typical camera distance is kilometres.

// Same geometry may feed a physics engine's STATIC triangle-mesh collider.
// Consult your engine's API for its own matrix/order/unit conventions.
const groundY = terrain.heightAt(2400, 2400); // Metres above the local vertical offset
console.log(groundY); // null outside the terrain
```

Alternatively load `terrain.glb` with your existing glTF loader. It has the same
surface, orientation and scale. Its brown material is illustrative, not a measured
surface classification. For Node, call `loadTerrain` with an absolute HTTP URL,
or use `createTerrainData(manifest, arrayBuffer)` with files read from disk.

React: load inside your client-side scene/effect, cancel pending fetches using the
loader's optional `{ signal }`, and dispose created Three.js geometry/materials
on cleanup. A rendering or physics library is not selected/installed by this pack.

## What this can and cannot support

Use it for crater-scale terrain display, broad slopes, route prototypes and
coarse collision. Approximately 30 m source sampling cannot measure wheel-scale
rocks, small ledges, caves or overhangs. Reprojection uses bilinear resampling;
steep rims are smoothed. Elevations describe a **surface model**, which can include
vegetation or structures. Local error/quality masks were not acquired, so no
site-specific accuracy claim is made. PNG quantization is much smaller than source
uncertainty and must not be presented as measurement precision.

Slope is computed using finite differences on the metre grid (central differences
inside, second-order one-sided at edges), followed by `atan(hypot(dh/dx, dh/dz))`.
It is a derived terrain descriptor, not a measured traversability/safety label.

Friction, soil density, cohesion and other wheel/ground properties are **unknown**.
The DEM does not measure them. Gravity belongs in the simulation configuration;
changing it to a planetary value does not turn this Earth dataset into a Mars
or lunar observation. No climate layers, satellite texture or planetary DEM is
included in this first handoff.

## Rebuild and verify

From the repository root (Python 3.12 used for this build):

```sh
python -m venv /tmp/pinoy-terrain-venv
/tmp/pinoy-terrain-venv/bin/pip install -r scripts/terrain/requirements.txt
/tmp/pinoy-terrain-venv/bin/python scripts/terrain/build_kilbourne.py
/tmp/pinoy-terrain-venv/bin/python scripts/terrain/validate_kilbourne.py
node scripts/terrain/check_loader.mjs
```

The builder downloads the checksum-pinned ~36 MB source to `data/cache/terrain/`
(git-ignored). An existing tile can be supplied with `--source /path/to/tile.tif`.
The committed cropped source preserves the original samples; the full tile is not
needed by the web app. Rebuilding refreshes `checksums.json`, including this README
and the loader. For scientific reproducibility, the exact input hash is fixed;
image/encoding bytes can vary across library versions.

## Source and attribution

- [Copernicus data catalog](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM)
- [Public mirror and release](https://registry.opendata.aws/copernicus-dem/)
- [Mirror processing details](https://copernicus-dem-30m.s3.amazonaws.com/readme.html)

Retain `ATTRIBUTION.txt` and the licence with redistributed assets, and display
the manifest's attribution in the app's data credits. The copyright notice is
required for adapted data. This pack does not alter the licences of other project files.

## Next data work

1. Agree on the required rover/player scale. Obtain higher-resolution terrain
   if the prototype needs metre-scale physical interactions.
2. Select a specific Mars or lunar comparison region from PDS/LRO and ingest its
   terrain with its own coordinate conventions and vertical reference.
3. Compare descriptors at compatible spatial scales. Record which properties
   match and which do not; do not infer similarity from appearance alone.
4. Apply the validated comparison to candidate Earth regions and report new
   candidates as hypotheses pending geological and data-quality review.
