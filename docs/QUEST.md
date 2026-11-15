# QUEST: polish, click-anywhere analogs, performance

You are an autonomous coding agent working alone in this repository. This document is your
whole brief: you have no memory of the conversation that produced it. Read it to the end
before touching anything, then work through the quests in order.

Written 2026-11-15 03:10 local time. Every decision in it was made by Tim (physics lead) in a
planning session; where it says "decided", do not reopen the question.

---

## 1. Goal

Three things, in this order of priority, before a live demo to hackathon judges:

1. **Polish (P quests).** The opening must feel like one continuous shot: no hard cut from the
   three-world screen into the Moon or Mars, no replayed zoom when switching between the Google
   3D view and the measured terrain, and a site-list panel that matches the rest of the game.
2. **Click anywhere (C quests).** The player clicks any point on the Moon or Mars, gets a ranked
   list of equivalent Earth analog sites, and can fly the full journey for that point.
3. **Performance, stability and UX (F quest).** A measured pass over the whole game.

### Definition of done

- [ ] Choosing the Moon or Mars zooms the camera into that world with no scene swap visible.
- [ ] Switching "View measured terrain" / "View Google 3D terrain" keeps the camera where it is.
- [ ] The site panel on the Moon, Mars and Earth screens is an eggshell card with dark text.
- [ ] Clicking bare surface on Mars (and on the Moon unless cut, see 2.4) drops a pin; "Analyse
      this spot" returns ranked Earth sites from the server; one can be selected and flown through
      to the debrief, including the debrief's planetary comparison flights.
- [ ] With the server unreachable the 9 curated regions work exactly as before and a pin says
      the matching service is unavailable.
- [ ] Every feature in the inventory (section 4) still works.
- [ ] `npm run check` and the Python tests pass; `web/public/sites.json` is byte-identical to main.
- [ ] The branch is pushed and a pull request is open, with the report from section 9.

---

## 2. Rules of the run

### 2.1 The clock

The demo is at **15:00 local time on Sunday 15 November 2026**. Run `date` first and write the
start time into your first commit message.

- **Code freeze 13:30.** After it: only the Z quest (verification, docs, PR).
- **PR open by 14:00.**
- Budgets are in section 6. If a quest overruns its budget by more than half, apply its stop rule.

### 2.2 Git

- The branch **`feature/quest`** already exists on GitHub and holds this file. Start with
  `git fetch origin && git checkout feature/quest && git pull`, then merge `origin/main` into it
  if main has moved.
- **Never commit to, push, merge into or force-push `main`.**
- Commit after every quest, and at least once an hour inside a long quest. **Push the branch
  to GitHub after every commit** (`git push -u origin feature/quest`), so work is never only local.
- Push only after `npm run check` passes. If you must save work that does not pass, prefix the
  commit message with `WIP:` and say what fails.
- Plain `git commit`. Do not add a `Co-Authored-By` trailer and do not override the author.
- If `origin/main` moves again, merge it into the branch (never rebase), resolve conflicts by
  hand keeping both sides' features, and re-run the check.
- Do not deploy the website. The live site is updated by a human.

### 2.3 What must not change

- **Only `app/sim` decides flight outcomes.** No change may alter physics results or telemetry.
  The physics tests must pass unchanged.
- **`web/public/sites.json` stays byte-identical.** Published scores for the curated pairings are
  Antonio's; you read them and never rewrite them. Anything you add to the Python pipeline is
  additive (a new script and new output files).
- Keep `web/src/game/contracts.ts`, `MissionConfig` and the scene registry stable. If a contract
  truly must change, update every consumer in the same commit and note it in `docs/TEAM_HANDOFF.md`.
- **Honesty rules** (from `docs/ANALOG_MATCHING.md` and `docs/SUBMISSION.md`): scores are
  engineering similarity, never validated accuracy; pairings are proposed, not validated; missing
  data is never filled in or invented; Earth cannot reproduce target gravity, atmosphere or
  radiation. Results for a clicked point are a weaker class of evidence than curated pairings and
  must say so on screen.
- No new runtime dependencies in `web/` without a measured reason. Do not remove features,
  fallbacks, Skip buttons or attribution.

### 2.4 Cut order (decided)

If time runs short, cut in this order and say so in the PR:

1. Performance fixes (F1) yield to the freeze: unfinished items become a list in the PR.
2. Geology (C5): results stay labelled terrain-only.
3. The Moon for click-anywhere: ship Mars alone and show "not available yet" for lunar pins.

The polish quests and the minimum demo line (P1 to C4 for Mars) are not cut.

### 2.5 Cloud permissions (decided)

- A **new Supabase project** is the server. Tim signs in to the Supabase connector before the
  run. Search your tools for the Supabase connector (create project, apply migration, execute SQL,
  deploy edge function). If it is not signed in, do not try to work around it: see section 8.
- You may create the project, tables, functions and data it needs, and deploy without asking.
- Never alter or delete anything you did not create. Never put a service-role key or any secret
  in the repository; only the project URL and the public anon key go in `web/.env` (which already
  holds the public Cesium token) and `web/.env.example`.

---

## 3. Read first

`CLAUDE.md`, `AGENTS.md`, `docs/TEAM_HANDOFF.md`, `docs/GAME_VISION.md`,
`docs/ANALOG_MATCHING.md`, `web/src/game/opening/DESIGN.md`, `web/DESIGN.md`.

Commands (repo root): `npm run setup`, `npm run dev`, `npm run check` (web build, web and physics
tests, catalog consumer check). Python tests: `.venv/Scripts/python -m pytest -q` (create the
venv with `python -m venv .venv` and `pip install -r requirements-dev.txt` if it is missing).

The codebase is split by owner. Opening: Eyad. Cutscenes and rendering quality: Furgan. Bridge,
character and physics: Tim. Matching pipeline and debrief: Antonio. Equipment: Yousef. Keep each
commit inside one owner's area where you can, so each can review their part.

---

## 4. Feature inventory: all of this must still work at the end

Replay this list in the Z quest. If any item cannot be kept, stop (section 8).

- Title: ship flying through streaking stars; click anywhere, Enter or Space starts; the camera
  flies in and the worlds appear out of a burst of light; "Atlas" link to all Earth test grounds.
- Three worlds: hover brightens a world and moves the camera; Mars sits further out than the Moon.
- Region and site lists: hover slides the row and lights the matching marker or outline.
- Region outlines (square study areas) on the simple Three.js globes; cyan for discovered sites.
- Cesium Moon, Mars and Google 3D Earth with clickable site dots; offline fallback globe.
- Earth terrain: generated surroundings around the measured patch, Google scenery when available,
  landing flag (click inside the outline, readout, reset), red dots on slopes over 12 degrees.
- Analog evidence and landing evidence on the terrain view and the mission control monitor.
- Equipment bay: Hardware and Appearance tabs, liveries, gear figures, reset view, launch
  lift-off with click and whoosh.
- Landing gear model: bridge Equipment monitor (gear selector, stroke and damping sliders, live
  figures) fits 840 x 490 with no scrolling; debrief shows shock compression and tip margin.
- Cutscenes (liftoff with stage separation, Earth approach) with Skip and the sound switch.
- Live 3D descent, outcome, in-character debrief on the bridge monitor, retry.
- Reduced motion, keyboard use, phone-width layout, and the no-WebGL paths.
- Typefaces Inter, DM Mono, Michroma; neutral off-white buttons; gold only for selection.

---

## 5. Givens (verified on 2026-11-15; trust these, re-check only if something fails)

### 5.1 Why the opening cuts today

`web/src/game/opening/OpeningGame.tsx` renders either `MoonGlobe` (Cesium, in
`web/src/components/MoonGlobe.tsx`) or `WorldScene` (Three.js, `web/src/game/opening/WorldScene.tsx`):

```
stage==='destination' || stage==='earth' && !measuredView ? <MoonGlobe .../> : <WorldScene .../>
```

So choosing a world unmounts `WorldScene` mid-zoom and mounts a Cesium viewer (the cut), and
"View measured terrain" mounts `WorldScene` from scratch, which starts above the site and flies
down again (the replayed zoom; see the `previous === null` block in `update.current`).

`WorldScene` already knows how to do the right thing when it stays mounted: in the `destination`
stage it flies to `centres[body]` with offset `globePoint(lat*.8, lon, 3.8)`, draws region
outlines (`regions.ts`), and on the Earth surface uses `siteSwoop` (`earthSurface.ts`).

Conventions you need for camera matching:

- `globePoint(lat, lon, r)` = `(r cos(lat) cos(lon), r sin(lat), -r cos(lat) sin(lon))`.
- World centres and radii: `centres` and `radii` at the top of `WorldScene.tsx` (Moon 0.85,
  Earth 1.5, Mars 1.18 scene units). `METRE_SCALE` converts Earth metres to scene units.
- `WorldScene` camera: perspective, 42 degree vertical field of view.
- Earth patch frame (the `terrain` group): x east, y up, z south, metres.
- Cesium: `siteCamera(point, ellipsoid, surface)` in `MoonGlobe.tsx`. Orbit view looks straight
  down from 2.6 radii; surface view sits at east-north-up offset (0, -7000, 8500) metres.

### 5.2 Elevation data, readable in small pieces from anywhere

Both hosts answer HTTP range requests and send `Access-Control-Allow-Origin: *`. No key needed.

| | Mars | Moon |
|---|---|---|
| URL | `https://asc-mars.s3.us-west-2.amazonaws.com/basemaps/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif` | `https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif` |
| Size | 961,178,524 bytes | 8,494,203,833 bytes |
| Grid | 46080 x 23040, int16 metres | 92160 x 46080, int16, **multiply by 0.5** for metres |
| Layout | Tiled 512 x 512, deflate, overviews | **Untiled, uncompressed, one row per strip** (184,320 bytes per row) |
| Projection | Equirectangular, sphere R = 3,396,190 m | Simple cylindrical, sphere R = 1,737,400 m |
| Pixel | 463.0935 m; origin x -10,669,675.1973, y 5,334,837.5987 | 118.4506 m; origin x -5,458,203.0766, y 2,729,101.5383 |
| Nodata | -32768 | -32768 |

Both are plate carree: `x = R * lon_radians`, `y = R * lat_radians`, longitude -180..180,
column = (x - origin_x) / pixel, row = (origin_y - y) / pixel. Confirm the longitude origin from
the geotransform before trusting it.

The existing Python builder (`scripts/catalog/build.py`, `terrain()`) makes a planetary pack by
reprojecting (bilinear) into a local azimuthal-equidistant grid:
`+proj=aeqd +lat_0=<lat> +lon_0=<lon> +R=<radius>`, **33 x 33 cells at 150 m (Moon) or 500 m
(Mars)**, north-first, west-first, float32 little-endian. Committed examples:
`web/public/terrain/{jezero,arsia-flank,phoenix,bagnold,lucus-planum,marius-hills,shackleton-rim,malapert-massif,mons-mouton}/`.
Three of the four lunar targets are within 6 degrees of the south pole.

### 5.3 The score you must reproduce

- `scripts/catalog/terrain_features.py`: `describe(z, cell)` computes the descriptors;
  `sample(z, spacing, cell, offset)` cuts the central window of `floor(4000 / cell)` cells and
  resamples by area average.
- `scripts/catalog/analog_score.py`: `terrain_percent(a, b, scales)` =
  `100 * exp(-mean(|a-b| / scale) / 2)` over the frozen keys; `landform()` with `FAMILIES`,
  `RELATED` (affinity 0.5), `INFERRED_FACTOR = 0.75`, `NOT_INFERABLE_FAMILIES = {crater}`;
  `combine()` = `0.5 * terrain + 0.5 * landform`.
- Frozen scales: `data/terrain-scales.json`, key `scales_by_resolution_m` with entries for
  **150.0** (Moon, 15 features) and **500.0** (Mars, 12 features). Moon and Mars scores are
  therefore not comparable with each other.
- **For a 33 x 33 planetary pack the resample is an exact 2 x 2 block mean** (the window starts
  on a half cell: Moon 26 x 26 from cell 3.5, Mars 8 x 8 from cell 12.5). So the planetary side
  can be ported to TypeScript and match Python closely.
- **The Earth side must not be ported.** Its windows start at fractional source cells, so its
  numbers depend on the GDAL version. And the Earth figures the score needs are **not committed**:
  `data/terrain-descriptors.json` holds 1000 m profiles only. You need a small exporter (C1).
- Published results to test against: `web/public/sites.json` ->
  `analog_matching.comparisons[]` (`analog_score_percent`, `terrain_similarity_percent`,
  `landform`) and `analog_matching.selection.screening[]` (`central_upper_bound_percent`, the
  analog score for every pair).

### 5.4 Geology and place names

- Mars global geologic map (USGS SIM 3292): `https://pubs.usgs.gov/sim/3292/downloads/sim3292_database.zip`
  (808,910,442 bytes). Start this download in the background in C0.
- Moon, Unified Geologic Map of the Moon 1:5M (USGS 2020): landing page
  `https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020`.
  **The direct download link was not confirmed**, and `astropedia.astrogeology.usgs.gov` did not
  answer from this machine. Find the GIS zip from the landing page; if you cannot within 20
  minutes, use the gazetteer for the Moon.
- IAU gazetteer centre points: `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip`
  (24 MB) and `.../MARS_nomenclature_center_pts.zip` (5 MB). Used for naming, and as the
  landform fallback.

### 5.5 Frontend seams for a non-catalog target

- `MoonGlobe.tsx`: selection is by id, markers are DOM buttons, there is no surface picking.
- `web/src/lib/lunarTopology.ts`: `getSurfacePointFromClick` uses `scene.pickPosition` but
  hardcodes `Ellipsoid.MOON`.
- `OpeningGame.tsx` assumes catalog ids: `catalog.targets.find(...)!`, `analogsFor`,
  `recommendedAnalogs`, `pairingOf`, `matchOf`, `scoreLabel`; `AnalogEvidence.tsx` has a
  `find(...)!` too; `MissionControlScreen.tsx` calls `scoreLabel`.
- `web/src/lib/mission.ts`: `buildMission` only needs `{ id, name, body, gravity }` on the target;
  `extractProfile(manifest, buffer)` accepts any well-formed grid; `loadProfile` only accepts
  same-origin `/terrain/<id>/` packs (leave it alone).
- `web/src/lib/fidelity.ts`: `computeFidelity` throws when the planetary target is not a catalog
  site with a pack. Callers: `web/src/game/debrief/DebriefScene.tsx`, `FlightReport.tsx`,
  `FlightReportNHB.tsx`. `app/sim/src/loaders.ts` `terrainPackToSite(manifest, buffer)` turns a
  grid into sim terrain without a catalog entry.
- Gravity used by the catalog: Moon 1.62, Mars 3.72 m/s2 (`GRAVITY` in `web/src/lib/catalog.ts`).

### 5.6 Tooling on this machine

Windows 11, Git Bash, Node 22, Python 3.10. **Not installed:** `deno`, the `supabase` CLI, `psql`,
`ogr2ogr`. `geopandas` is listed in `requirements.txt` but not installed in `.venv`. There is no
backend today: the site is static files behind nginx. Headless Chrome works with
`puppeteer-core` and `--enable-unsafe-swiftshader --use-angle=swiftshader` for WebGL screenshots
(it is slow: allow long waits, and never judge frame rate from it).

---

## 6. Quests

Each quest: do the steps, pass the acceptance test, run `npm run check`, commit, push.

| Quest | What | Budget |
|---|---|---|
| P1 | Continuous zoom into the Moon or Mars | 1.5 h |
| P2 | Google and measured views swap in place | 0.75 h |
| P3 | Eggshell site panel | 0.75 h |
| C0 | Server preflight | 0.5 h |
| C1 | Scoring in TypeScript, with parity | 1.5 h |
| C2 | Terrain window readers | 2.0 h |
| C3 | Edge function and cache | 1.25 h |
| C4 | Click-anywhere in the game | 2.5 h |
| | **Minimum demo line (10.75 h)** | |
| C5 | Geology and place names | 1.5 h |
| F1 | Performance, stability, UX | rest, until the freeze |
| Z | Verify, document, PR | 1.0 h, starts at 13:30 at the latest |

### P1. Continuous zoom into the Moon or Mars (decided design)

The three-world camera flies into the chosen world as one shot. The detailed Cesium globe
loads underneath with a matching camera and cross-fades in once its first tiles are visible.
If Cesium is slow, offline or has no token, the player simply stays on the simple globe.

1. In `OpeningGame.tsx`, keep `WorldScene` mounted for `title`, `worlds`, `destination` and
   `earth` (not `equipment`). Render `MoonGlobe` as a second layer above it for `destination`
   and for `earth` when not in the measured view.
2. Give `MoonGlobe` a way to report readiness (first tile visible; it already tracks
   `firstTile`) and failure. Its layer starts at opacity 0 with pointer events off, and fades to
   1 over about 600 ms when ready **and** the `WorldScene` fly-in has finished. On failure it
   stays hidden: do not show the old "offline model" fallback on top of `WorldScene`, which is
   already the better fallback.
3. Match cameras at the moment of the fade. Derive the Cesium camera from the `WorldScene` pose:
   same direction from the world's centre (convert with the `globePoint` convention in 5.1) and
   the same distance measured in world radii, and set Cesium's vertical field of view to 42
   degrees. Check with two screenshots that the limb of the world moves by less than 3% of the
   screen height across the fade.
4. While the Cesium layer is fully opaque, pause `WorldScene`'s render loop (add a prop; do not
   unmount it). Resume it before fading back. Going back to "All worlds" fades Cesium out first.
5. Region outlines and hover on the simple globe must work during the zoom and whenever Cesium
   is not shown. Once Cesium is shown its own site dots take over.
6. Reduced motion: no fly and no fade; show the end state.

Accept: screen recording or stepped screenshots (every 200 ms) from clicking "The Moon" and
"Mars" show a continuous zoom with no black frame and no jump; with the network blocked for
`*.cesium.com` the zoom ends on the simple globe with outlines and everything is selectable.
Stop rule: if camera matching is not within tolerance after the budget, ship the cross-fade
with the best match you have and note the residual jump.

### P2. Google and measured views swap in place (decided design)

"View measured terrain" and "View Google 3D terrain" must not replay any zoom.

1. With `WorldScene` now always mounted, remove the remount path. On the switch, read the
   visible view's camera (position and look-at point in the site's east-north-up frame, metres),
   set the other view's camera to the same pose with no route (in `WorldScene`, place the camera
   and call `finishFlight`-equivalent logic directly; do not call `swoopTo` or `orbitTo`), then
   cross-fade over about 400 ms.
2. The first arrival at a site (from orbit) still uses the existing descent, once.
3. Make sure `OrbitControls` distance limits in `WorldScene` accept the pose Cesium hands over.
4. The landing flag, outline and red dots must be present immediately in the measured view.

Accept: toggle the two views five times at Kilbourne Hole; the horizon and the site stay put
across each switch (screenshots before and after differ only in imagery), and no descent replays.

### P3. Eggshell site panel (decided design)

The right-hand panel (`.game-selector` in `web/src/game/opening/opening.css`) on the Moon, Mars
and Earth screens becomes a **solid eggshell card with dark text**.

- Tokens, added once beside the button tokens in `web/src/styles.css`:
  `--shell: #efe9dc; --shell-ink: #14130f; --shell-dim: #5b574d; --shell-rule: #14130f24`.
- Card: `--shell` background, no blur, 4 px radius, soft shadow, generous padding.
- Type: heading and site names in Inter (`--font-ui`); numbers, indices, regions, scores and
  small labels in DM Mono (`--font-data`), uppercase with tracking for labels.
- Rows: hairline `--shell-rule` between rows; hover a slightly darker wash; **selected row
  inverted** (`--shell-ink` background, `--shell` text). Keep the hover link to the globe.
- Things that are light-on-dark today need dark-on-light versions inside the card: the gold
  score text, the cyan "discovered" label and heading, the atlas "Compare with" select, the
  text buttons, the close button, the description and notes.
- The primary button in the card is the inverse of the page's: `--shell-ink` background,
  `--shell` text.
- Phone layout (under 760 px): the card stays readable and scrolls inside itself; the page
  never scrolls.
- All text in the card must reach a contrast ratio of at least 4.5:1; compute it, do not eyeball.

Accept: screenshots of the Moon, Mars, Earth top-10, Earth "all sites" with discovered
candidates, and the phone width; contrast figures listed in the commit message. Update
`web/src/game/opening/DESIGN.md` and `web/DESIGN.md` with the new tokens.

### C0. Server preflight

1. Find the Supabase connector tools. If it is not signed in: skip to section 8.
2. Create a project named `analog-atlas` (free tier, a region near western Europe). Record the
   project ref, URL and anon key. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
   `web/.env` and `web/.env.example`.
3. Deploy a throwaway edge function that range-reads 16 bytes from each elevation file and
   returns the HTTP status and timing, and call it. This proves the function can reach both hosts
   before you build on it. Read the platform's current CPU, memory and wall-clock limits from
   the Supabase docs and note them in `supabase/README.md`.
4. Start the Mars geologic download (5.4) in the background into a git-ignored folder
   (`data/raw/geology/`). Install geopandas into `.venv` (`pip install geopandas pyogrio`).
5. Enable PostGIS on the project (migration).

Accept: the probe function returns 206 for both files from the cloud.

### C1. Scoring in TypeScript, with parity

1. **Exporter (Python, additive).** New script `scripts/catalog/export_click_vectors.py`: for
   every Earth site with a pack, compute the central-window feature vector at 150 m and at 500 m
   with the existing `terrain_features.features(...)`, plus each site's `morphology` and
   `inferred_landforms`. For the 9 planetary targets, export their vectors as test fixtures.
   Before writing, the script must recompute the published `terrain_similarity_percent` and
   `analog_score_percent` for every row in `analog_matching.comparisons` from its own vectors and
   fail if any differs after rounding to 2 decimals. Outputs:
   `supabase/functions/_shared/analog/earth-vectors.json` (vectors, labels, the two scale sets,
   method versions, and the SHA-256 of the `sites.json` it was built from) and
   `supabase/functions/_shared/analog/fixtures.json`. Add a pytest for the script.
2. **Scoring module (TypeScript, no dependencies).** `supabase/functions/_shared/analog/`:
   `describe.ts`, `score.ts`, `landform.ts`. Use explicit `.ts` extensions in relative imports
   (as `app/sim` does) so the same files load in Deno and in vitest. Port exactly:
   - the 2 x 2 block mean that stands in for `sample()` on a 33 x 33 pack (assert the grid shape);
   - `describe()`: `np.gradient` (central differences inside, one-sided at the edges, divided by
     the cell size), slope in degrees, `percentile` with linear interpolation, relief,
     hypsometric integral, the box-mean and box-RMS roughness at 150, 450 and 1000 m and the
     fine, mid and coarse residual roughness (interior cells only, so the filter's edge mode
     does not matter), the plane fit by least squares, and the bowl and ridge shares;
   - `terrain_percent`, `landform` (including the inferred rule and the never-inferred crater)
     and `combine`.
3. **Parity tests (vitest, in `web/src/lib/` importing the shared module).** From the 9 committed
   planetary packs, the TypeScript vectors must match `fixtures.json` to 1e-6 relative (allow a
   one-cell difference on the share and threshold features, which can flip on ties), and the
   scores against every Earth site must match the published 2-decimal figures.

Accept: the pytest and the vitest parity tests pass. Stop rule: if parity on the scores cannot
be reached, stop (section 8); do not ship a score that disagrees with the published one.

### C2. Terrain window readers

Goal: `fetchPack(body, lat, lon)` returns a 33 x 33 north-first float32 grid in the same local
azimuthal-equidistant frame the Python builder uses, from range reads only.

1. **Geometry, with no special cases.** For each of the 1,089 cell centres (east, north offsets
   in metres from the centre), apply the closed-form inverse spherical azimuthal-equidistant
   projection to get latitude and longitude, convert to fractional source row and column (5.2),
   wrap the column modulo the width, clamp the row, and sample bilinearly. Never compute a
   longitude/latitude bounding box: near a pole it wraps the whole planet.
2. **Mars.** Try `npm:geotiff` in the edge function for 45 minutes at most. If it will not run
   there, read the TIFF header once offline, store `TileOffsets` and `TileByteCounts` for the
   full-resolution image in a JSON file beside the function, range-fetch the tiles you need,
   inflate them with `DecompressionStream('deflate')`, and undo the predictor if the file sets one.
3. **Moon.** Write a custom reader: the file is uncompressed with one row per strip, so a
   pixel's byte offset is `StripOffsets[row] + col * 2`. Read the header to confirm the strips
   are contiguous (offset of row r = offset of row 0 + r * 184,320); if they are, hardcode that
   formula with the first offset and assert it against a few rows. For each needed row fetch only
   the span of columns you need (two spans if it wraps), in parallel. At 89.55 degrees south a
   window is about 45 rows by 5,300 columns: fine. Multiply by 0.5. Reject clicks beyond 89.9
   degrees with a clear message.
4. Treat -32768 as missing: if any sample is missing, return an error; never fill.
5. Make the reader usable from Node as well (plain `fetch`), so vitest can exercise it. Keep
   network tests out of `npm run check`: put them behind an environment flag and run them by hand.

Accept (run by hand, report the numbers in the commit message): for the 9 curated targets the
fetched grid differs from the committed `elevation.f32` by an RMS of at most 2 m, and the analog
scores computed from the fetched grid differ from the published ones by at most 1.0 point.
Stop rule: 2.5 hours after starting C2, ship whichever world passes and make the other return
"not available yet"; say so in the PR.

### C3. Edge function and cache

Function `match-analog` in `supabase/functions/match-analog/`, deployed through the connector.

**Request** (POST JSON): `{ "body": "Moon" | "Mars", "lat": number, "lon": number }`.
Validate; snap latitude and longitude to 0.01 degrees and use the snapped point for everything.

**Response** (200):

```jsonc
{
  "method": { "analog_score": "1.0.0", "descriptors": "2.0.0", "click": "1.0.0" },
  "point": { "body": "Mars", "lat": 18.45, "lon": 77.4, "name": "Inside Jezero", "name_source": "IAU gazetteer" | null },
  "comparison_resolution_m": 500,
  "landform": { "family": "sedimentary" | null, "status": "geologic_map_unit_unreviewed" | "gazetteer_feature_unreviewed" | "unknown",
                "unit": "lNh" | null, "unit_name": "..." | null, "source": "USGS SIM 3292, 1:20M" | null },
  "ranking_basis": "landform_and_terrain" | "terrain_only",
  "matches": [ { "earth_id": "…", "analog_score_percent": 71.4, "terrain_similarity_percent": 67.8,
                 "landform": { "earth_family": "…", "planetary_family": "…", "relation": "same_family", "match_percent": 75, "status": "…" } } ],
  "excluded_earth_sites": 0,
  "terrain": { "manifest": { /* same shape as a terrain pack manifest; id "custom-…", body "moon"|"mars" */ },
               "elevation_base64": "…" /* 33 x 33 float32 little-endian, north-first */ },
  "provenance": { "evidence_status": "on_demand_unreviewed", "scientifically_validated": false,
                  "terrain_range_percent": null, "window_sensitivity": "not_computed",
                  "dem": { "product": "MGS MOLA 463 m global mosaic", "url": "…" }, "cached": false }
}
```

Rules:

- Score against all Earth sites in `earth-vectors.json`, sorted by analog score, ties by id.
  Return all of them (the client shows ten and can expand).
- An Earth site missing any frozen feature is **excluded and counted**, never scored as zero.
- Until C5 lands, `landform.status` is `"unknown"` and `ranking_basis` is `"terrain_only"`.
- Cache: table `analog_click_cache (body, lat_q, lon_q, method_version, response jsonb,
  created_at, primary key (body, lat_q, lon_q, method_version))`, row-level security on with no
  public policies; the function reads and writes it with the service role from its environment.
  A cache hit sets `provenance.cached` to true.
- Errors are JSON with a `code` (`bad_request`, `out_of_range`, `no_data`, `upstream_unreachable`)
  and a sentence a player can read. Send CORS headers for the browser.
- Keep JWT verification on; the client sends the anon key.

Accept: a `curl` to the deployed function for Jezero (18.45, 77.4) and, unless the Moon is cut,
for Marius Hills (14.1, -56.8) returns rows whose top results agree with the published ranking
for those targets to within the C2 tolerance; a second call is a cache hit; a pole and a
malformed request return the right error codes. Add `supabase/README.md`: what is deployed, how
to redeploy, and the limits noted in C0.

### C4. Click-anywhere in the game (decided design)

Click flow: **a click on bare surface drops a pin and shows its coordinates with an "Analyse
this spot" button; the curated regions stay.** Naming: the server's place name with the
coordinates underneath; until C5 it is "Custom site" plus coordinates.

1. **Picking.** On the Cesium globe add a `ScreenSpaceEventHandler` left click that ignores
   drags and clicks on site dots, and resolves latitude and longitude with the right ellipsoid
   (generalise `getSurfacePointFromClick`). On the simple globe in `WorldScene` (destination
   stage) pick by ray against the sphere and invert `globePoint`. Both report through one new
   prop, for example `onSurfacePick({ lat, lon })`. Moon and Mars only.
2. **Client.** `web/src/lib/analogClick.ts`: call the function with a timeout (20 s) and one
   retry, decode the grid, build a `TerrainProfile` with the existing `extractProfile`, and
   expose a typed result. No Supabase SDK: plain `fetch` to
   `${VITE_SUPABASE_URL}/functions/v1/match-analog` with the anon key headers.
3. **Custom target model.** In `OpeningGame.tsx` add state for a pinned point and for an
   analysed custom target: a synthetic `PlanetarySite` (id `custom-<body>-<lat>-<lon>`, name,
   body, lat, lon, gravity 1.62 or 3.72, description saying how it was derived) plus the server
   response and the profile. When a custom target is active:
   - `target` comes from it instead of `catalog.targets.find(...)!`;
   - the Earth list (`ranked`, `topTen`, `candidates`) maps the server's `matches` onto
     `catalog.analogs`, in server order, available sites only;
   - score text comes from the server row (give `scoreLabel` an optional override) and reads as
     "71% analog match" or, for a terrain-only ranking, "68% terrain match · landform unmapped".
     **Never present a terrain-only ranking as a low match.**
   - `pairingOf` and `matchOf` are skipped; `AnalogEvidence`, `LandingEvidence` and
     `MissionControlScreen` show custom-point copy instead of crashing. The copy states: scored on
     demand from the global elevation mosaic at 150 m or 500 m, landform from the geologic map
     unit (unreviewed) or unmapped, not reviewed, not validated, and what Earth cannot reproduce.
   - `buildMission` gets the synthetic target and the server's terrain percent as `terrainScore`.
4. **Region panel.** The pinned or analysed point appears as a row above the curated regions
   ("Your pin", name, coordinates) with states: pinned, analysing (progress text), ready, failed.
   "Find Earth terrain" works for it once ready. Selecting a curated region clears nothing: the
   pin stays until replaced.
5. **Debrief.** Give `computeFidelity` an optional planetary profile; when present, skip the
   catalog lookup and pack download and build the planetary sim terrain with
   `terrainPackToSite(manifest, buffer)` using the mission's id, name and body. Thread the
   profile through `DebriefScene`, `FlightReport` and `FlightReportNHB`. The cached
   landing-similarity baseline does not apply to custom targets (`isBaselineMission` already
   yields no row; confirm).
6. **Unavailable state (decided).** If the env keys are missing, the request fails or times out:
   the pin row says "Matching service unavailable. Choose a marked region." and everything else
   works as before. No silent fallback to different maths.
7. Tests: unit tests for the client decoding and the custom-target mapping with a recorded
   response fixture; a fidelity test that runs the comparison flights from a fetched-style
   profile with no catalog entry.

Accept: a scripted browser run pins a point on Mars (and the Moon unless cut), analyses it,
picks the top Earth site, places a landing flag, builds a lander, launches, and reaches the
debrief with planetary comparison flights computed, with no page errors. A second run with the
function URL broken shows the unavailable state and a curated journey still completes.

### C5. Geology and place names (first thing to cut)

Decided: the landform for a clicked point comes from the USGS global geologic maps, translated
to the game's families by a table you write, **labelled unreviewed and discounted to 75%**
(the same factor the pipeline gives unreviewed inferred labels).

1. With geopandas, read only the geologic-unit polygon layer of each map. Normalise longitude
   to -180..180, simplify to about 0.02 degrees, keep unit code and unit name.
2. Load into PostGIS tables `geology_units (body, unit, unit_name, geom)` and
   `gazetteer (body, name, feature_type, lat, lon, diameter_km)`. Do not paste megabytes of
   geometry through your own context: upload from a Python script in batches to a temporary,
   token-guarded SQL function, and drop that function when done.
3. Unit-to-family table as a reviewed-by-nobody JSON file in the repo
   (`supabase/functions/_shared/analog/unit-families.json`): each row has the unit code, the
   family (`volcanic`, `crater`, `aeolian`, `sedimentary`, `desert`, `periglacial`, `massif`) or
   null, and one line of reasoning. Map only what the unit description clearly supports; leave
   the rest null. Highland and undivided units will mostly be null: that is correct.
4. In the function: point-in-polygon lookup, then the family, then `landform()` with the 75%
   factor for the planetary side's label. A null family means `ranking_basis: "terrain_only"`.
   A crater unit is mapped, not inferred, so the never-inferred rule does not block it, but say
   in the copy that a geologic crater unit includes ejecta and floor.
5. Naming: nearest gazetteer feature; "Inside <name>" when within its radius, otherwise
   "<distance> km <compass> of <name>".
6. Bump the click method version so old cache rows are not served.
7. Credits and `docs/ANALOG_MATCHING.md`: cite both maps and the gazetteer.

Stop rule: 60 minutes into C5 with no working point lookup, or at 11:30, whichever is first:
fall back to the gazetteer alone (a point inside a named feature takes that feature type's
family where one clearly applies, status `gazetteer_feature_unreviewed`; otherwise unknown). If
one world's map loads, ship that one and use the gazetteer for the other.

### F1. Performance, stability and UX pass

Optimise what a player feels on an ordinary laptop: a fast first paint, a steady frame rate
through every stage, no hitches at scene changes, and controls that are obvious without
explanation. Decided scope: **you may fix every owner's area, one commit per owner, and no
feature may be lost.**

The journey to cover: title, three worlds, Moon/Mars region, Earth analog site, terrain fly-in
and landing flag, equipment bay, liftoff cutscene, ship bridge, Earth approach cutscene, live 3D
descent, outcome, in-character debrief, retry.

**Measure first.** Do not optimise from reading code alone. Drive the real game in a browser and
record a baseline for each stage before changing anything: load time to an interactive title, JS
transferred on first load, frame time (average and worst), draw calls and triangles from
`renderer.info`, and JS heap after a full playthrough plus two retries. Also test with 4x CPU
throttling and at a phone-sized viewport. Rank problems by player impact, fix the worst first,
and re-measure after each fix. If a change does not move its number, revert it. Software-rendered
headless Chrome cannot measure frame rate: use it for load, transfer, heap and errors only, and
list what still needs measuring by hand on real hardware.

**Leads from a static read (verify each before acting):**

1. First load. The built `index.html` module-preloads the Cesium chunk (about 4.2 MB) and the
   catalog chunk (about 2.1 MB) with the entry, so the title waits on both.
   `web/src/data/sites.ts` imports `sites.json` statically; `manualChunks` in
   `web/vite.config.ts` may pull Cesium into the entry's graph. The title should paint with
   neither, then load them in the background. (`landingSimilarity.ts` also downloads
   `/sites.json` a second time to hash it.)
2. Renderer sprawl. About nine places create a `WebGLRenderer` (Globe, MoonGlobe,
   TerrainExplorer, WorldScene, EquipmentBay, cutscene/engine, ShipInterior, DebriefScene,
   DepartureScene), each with its own pixel-ratio cap. Check each disposes geometry, materials,
   textures and its context on unmount, that two do not render at once longer than a dissolve
   needs (P1 adds a deliberate overlap: make sure the hidden one is paused), and that three
   retries leak no contexts or memory.
3. No quality tiers. ShipInterior and DebriefScene use soft shadows at up to 2x pixel ratio.
   Add one shared quality module (pixel-ratio cap, shadows, particle counts, Cesium resolution
   and screen-space error) that picks a tier from measured frame time and steps down when frames
   run long.
4. Hidden tab and lost context. Nothing listens for `visibilitychange` or `webglcontextlost`.
   Loops should pause when hidden, the sim must not take a huge step on return, and a lost
   context should recover or fall back to the existing non-WebGL paths.
5. Per-frame allocation in `cutscene/engine.ts` and `WorldScene.tsx`: hoist to reused scratch
   objects where the profile shows garbage-collection hitches.
6. Scene transitions: shader compilation, terrain mesh building, texture upload and decoding
   should happen during the previous scene (`preloadScenes` in `game/integrations.ts` already
   prefetches code; extend the idea to GPU warm-up, for example `renderer.compileAsync`).
7. React during flight: `app/sim/react/useLanderSim.ts` pushes HUD state on a timer. Confirm the
   descent does not re-render the 3D host or large trees on each tick.
8. Cesium: `requestRenderMode`, resolution scale, tile cache limits, and that viewers are
   destroyed when no longer needed.
9. Assets: `public/textures/bridge` has large JPEGs and each terrain pack ships both
   `elevation.f32` and `elevation.tif`; confirm what the browser really downloads.
10. Tests: the web test timeout was raised to 20 s because heavy tests exceeded 5 s under
    parallel load. Find out why and fix it properly if it is cheap.

**Bugs and stutter.** Play the whole journey at least twice per world, including Skip on every
cutscene, back navigation, retry from the debrief, resizing mid-scene, entering and leaving
fullscreen, reduced motion, and a failed terrain or tile load. Log every console error and
warning, visual pop, stuck state, double-fired callback and dead input. Fix root causes; do not
hide symptoms with timeouts or try/catch.

**UI/UX.** Judge each screen as a first-time player: is it clear what to do next, what is
clickable, and what just happened? Look for missing loading and progress feedback (especially
Cesium, terrain and the new analysis call), dead time with a blank screen, unclear labels,
unreadable HUD text over bright terrain, controls not explained before they are needed (bridge
movement, manual descent keys), focus traps, overflow at small viewports, and inconsistent
spacing, type and motion between stages. Keep the visual identity (Inter, DM Mono, Michroma,
neutral buttons, the eggshell card); refine it, do not redesign it.

Stop rule: F1 stops at the 13:30 freeze. Whatever is found but not fixed goes in the PR as a
list with the measurement that found it.

### Z. Verify, document, open the PR

1. Merge `origin/main` into the branch if it moved; resolve by hand; keep every feature.
2. `npm run check`; `.venv/Scripts/python -m pytest -q`; confirm
   `git diff origin/main -- web/public/sites.json` is empty.
3. Replay the feature inventory (section 4) in a browser, and the three scripted journeys:
   a curated region, a pinned point on Mars, a pinned point on the Moon (unless cut).
4. Docs: `docs/TEAM_HANDOFF.md` (the new seams: always-mounted `WorldScene`, the custom target,
   the server, who should review what), `docs/ANALOG_MATCHING.md` and `docs/SUBMISSION.md`
   (what click-anywhere is and is not, with the honesty wording), the credits dialog in
   `OpeningGame.tsx` (USGS MOLA and LOLA mosaics, geologic maps, IAU gazetteer, Supabase),
   `web/README.md` (env keys), `supabase/README.md`.
5. Push, then open a pull request from `feature/quest` to `main` with the report in section 9.
   Do not merge it.

---

## 7. Design notes that prevent misleading results

- A terrain-only ranking tops out at 50 by construction. Show the terrain percent as the
  headline in that case and label it; do not show "38% analog match".
- All 52 discovered (`scan-*`) Earth sites have unreviewed inferred landforms: they cap at 75
  on the landform half and never count as craters. A click in a crater will therefore rank
  curated craters first. Pass each row's landform status through to the list.
- A click next to a curated region will not reproduce that region's published top ten: the
  published list also applies screening and verification flags. Say "on-demand ranking" on screen.
- Moon scores use 15 features at 150 m, Mars 12 at 500 m. Never put them on one scale.
- The pin's result describes a 4 km window around the snapped point, not the feature the player
  was looking at from orbit. Show the window size.

---

## 8. Stop and leave a note

Stop the affected track, commit and push what is safe, and write `docs/QUEST_STATUS.md`
(what happened, what you tried, what a human must do) if:

- the Supabase connector is not signed in or cannot create a project. Then run P1 to P3 and F1
  only, and prepare C1 (it needs no server) so the server work can resume quickly;
- a parity gate in C1 fails, or any published score, physics result or telemetry would change;
- an elevation host stays unreachable after three spaced retries;
- a feature in the inventory cannot be kept.

Do not guess past these. A smaller, honest result is worth more than a larger one that is wrong.

---

## 9. The report (PR description)

- What shipped per quest, what was cut and why, in the order of section 6.
- Parity numbers: descriptor tolerance reached, per-target grid RMS and score deltas from C2.
- Server: project ref, function URL, what is cached, platform limits, how to redeploy.
- Performance: a before/after table per stage (load time, transfer size, average and worst frame
  time, draw calls, heap), naming the hardware and browser each number came from, and stating
  plainly which claims are unverified.
- Every bug found and whether it is fixed; UX changes with a one-line reason each.
- The feature inventory with a tick or a note against each item.
- Who should review what (by owner), and anything left for after the demo.
