# Shared site catalog 1.0.0

Production entry point: `web/public/sites.json` (served as `/sites.json`). This
catalog contains real terrain assets and sourced conditions, not Tim's synthetic
`sites.example.json`. Source choices are in `scripts/catalog/selection.py`.

## Integration

Eyad: import `loadCatalog` and `mapFeatures` from `/catalog-loader.mjs`.
Filter GeoJSON points by `body` before displaying on a body-specific basemap;
Moon/Mars coordinates are not Earth WGS84. `bbox` is raster outer bounds.
Coordinates are east-positive, -180..180; Moon/Mars latitude is planetocentric.

Tim: `await loadCatalogTerrain(site, origin)` returns the existing `SiteTerrain`
shape. It uses the existing Kilbourne `createTerrainData` loader to validate
binary samples and flips north-first rows once to south-first, keeping west-first
columns. Elevations remain absolute metres; the physics grid uses its default
centered origin. A scalar annual wind speed cannot populate a directional wind
vector. No wind, gravity, atmosphere or friction overrides are silently inserted.

For the `sim-physics` branch, replace the hard-coded Kilbourne fetch in
`app/sim/viewer/sites.ts::loadTerrainPacks` with `loadCatalog` plus
`loadCatalogTerrain` for chosen sites. That branch already has `terrainPackToSite`
with the same row conversion; do not flip its output a second time. The branch
has not been merged or edited here. Main contains no running map or physics app;
the shared loader is tested independently against the existing interface.

All packs support the existing JS geometry loader, so extra GLBs and PNGs are
unnecessary. Kilbourne's original pack is preserved. New packs contain compact
float32 grids, GeoTIFFs, manifests and checksums. Full planetary mosaics are not
downloaded or committed: GDAL requests source windows over HTTP ranges.

## Condition vocabulary

These are engineering catalog categories, not natural universal thresholds.
Version changes require a schema/method version change.

| Field | Definition |
|---|---|
| morphology | crater (origin further identified), impact_crater, volcanic_plain, lava_field, dune_field, canyon, rocky_desert, delta, playa, polygonal_ground |
| substrate | basalt, basaltic_sand, gypsum_sand, sedimentary_rock, evaporite, permafrost, icy_regolith, lunar_regolith, unknown |
| slope_p95_class | level: [0,5) degrees; gentle: [5,15); steep: [15,30); very_steep: [30,90] |
| roughness_3km | low: [0,10) m; moderate: [10,50); high: >=50; RMS height about local mean in 3x3 cells at 1km spacing |
| atmosphere | terrestrial, thin_co2, airless; body-level context, not local measured pressure |
| annual_air_temperature | freezing_mean: <0 C; cool_mean: [0,15); warm_mean: >=15; only 2024 mean 2m air temperature, not climate-zone classification |
| resources | unknown unless a footprint-specific abundance measurement exists; regional ice evidence is described separately from local confirmation |

Interpretations retain their source URL. `feature_measurements` lists desired
crater/dune/polygon identifiers whose numeric values are not yet supported.
Quantities carry value, unit, status, source, resolution, time coverage, method,
caveat and missing reason. Status is measured, derived, modeled, assumed, unknown,
or not_applicable. Null does not mean zero. Lunar atmospheric wind and 2m air
temperature are not_applicable. Lunar surface temperature is a distinct quantity.
Substrate never supplies friction, cohesion or density. Simulation assumptions
belong only in `simulation_defaults`, currently empty for every site.

## Footprints and selection

Earth squares span 4.8km between outer sample centres at 30m spacing. These are
reproducible regional crops around the listed centres, not mapped feature
boundaries or surveyed control points. Meteor's centre is offset west by about
0.5km to avoid a tile boundary while retaining crater and ejecta context.
Moon crops span 4.8km at 150m output spacing; Mars crops span 16km at 500m.
Pixel edges extend half a sample beyond these dimensions. The local projections
are UTM on Earth and body-specific azimuthal equidistant on Moon/Mars.
LOLA's stored 0.5 scale is applied before export. Copernicus uses EGM2008 heights,
MOLA uses areoid heights, LOLA uses a 1737400m reference sphere. Absolute elevation
is never compared across bodies.

Selected Earth sites: Kilbourne, Meteor Crater, Amboy, White Sands, Badwater,
Barrow Observatory, Craters of the Moon, Lava Beds, Capitol Reef. This expands
the original 6–8-candidate scope to include the user's additional selections.
Capitol Reef is explicitly a candidate sedimentary-relief analog, not a newly
discovered or validated Jezero match. A regional square mixes geological units.

Other evaluated candidates: Cima field (NPS monogenetic volcanic-field overview)
and Sunset Crater/San Francisco volcanic field (NPS Geodiversity Atlas). Both
are defensible volcanic candidates but were deferred because Amboy, Craters of
the Moon and Lava Beds already cover that class; impact, salt, dune and icy
terrain provide greater variety. Their exclusion is not a scientific rejection.

Six planetary research targets: Jezero delta neighbourhood, Bagnold regional dune
context, Arsia flank, Phoenix northern plains, Marius Hills volcanic terrain,
Shackleton northern rim. None is certified safe for landing. The original broad
Arsia lava-tube entry is narrowed to a volcanic study area without claiming an
identified cave. Shackleton is a local rim crop, not the previous all-longitude
polar cap. Phoenix adds an icy/periglacial comparison for Barrow.

## Similarity method 1.0.0

Each terrain is area-averaged onto exactly 1km cells in a centered 4x4km square.
Mean slope uses metre gradients. Roughness is mean local RMS over only interior
3x3 windows (3km support); it includes regional slope, not detrended rock texture.
Relief is max-min of the same 4x4km grid. Export spacing is never advertised as
native resolving power. Common spacing reduces scale mismatch but does not
remove sensor, interpolation, DSM/DTM or latitude-dependent sampling differences.

For each feature d=min(abs(a-b)/scale,1). Contributions are weight*(1-d).
Weights: slope .4, roughness .4, relief .2. Fixed scales: 15 degrees, 150m, 1000m.
All three compatible derived features are required. Otherwise terrain_score=null
and coverage is the sum of available feature weights. No reweighting or ranking
inflation for sparse sites. Adding sites does not change normalization.

Pairings are geological/process hypotheses supported by site descriptions; the
numeric score measures terrain descriptors only. A high score can occur for
different geological origins. No environmental or combined score is calculated
until compatible observations exist on both bodies. These are engineering
comparisons, not validated mission suitability or landing safety assessments.

## Rebuild and validation

Python environment: install `requirements-dev.txt` and `Pillow>=11,<13`.
The existing environment used Python 3.14, Rasterio 1.5.2, NumPy 2.5.4 and
SciPy 1.18.1; use these versions when byte-level reproduction matters.

```powershell
.venv/Scripts/python -m scripts.catalog.build
.venv/Scripts/python -m scripts.catalog.build --offline
.venv/Scripts/python -m scripts.catalog.validate
.venv/Scripts/python -m pytest -q --basetemp=.test-tmp-catalog
node scripts/catalog/check-consumers.mjs
node scripts/terrain/check_loader.mjs
.venv/Scripts/python scripts/terrain/validate_kilbourne.py
```

`--site ID` retrieves and records one site in ignored cache; rerun the full build
to publish it into the local catalog. Cache is `data/cache/catalog` and is not
committed. Raw weather responses and source-window hashes support reproduction.
The build writes `data/catalog-run-report.json` with precise failed stages;
failures are retained as explicit missing catalog assets and cause a nonzero
exit. Inspect this report and run validation before consuming rebuilt data.
No commits, merges, pushes or deployment are performed by these commands.
