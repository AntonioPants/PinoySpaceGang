# Earth catalog expansion and top-ten comparisons

The catalog contains 24 real terrain windows: **15 Earth, 5 Mars and 4 Moon**.
The four additions below use bounded Copernicus GLO-30 DEM reads and actual NASA
POWER daily responses for 2024. They are enabled in `web/public/sites.json` and
participate in the same filtered top-ten selection as the original sites.

| ID and location | Centre (latitude, east longitude) | Scope and proposed comparisons |
|---|---|---|
| `cima-lava-field`, California | 35.216319, -115.751506 | Surface window at the NPS Lava Tube reference point in Cima volcanic terrain. Proposed Marius Hills and Arsia surface-access comparisons; no cave geometry or shelter stability. |
| `sunset-crater`, Arizona | 35.365, -111.52 | Analysis window spanning Bonito lava and Sunset Crater cone context. Proposed Marius Hills and Arsia volcanic-terrain comparisons; not equivalent shield-volcano morphology. Forest canopy can affect elevation. |
| `great-sand-dunes`, Colorado | 37.75, -105.53 | Dunefield analysis window for a proposed Bagnold aeolian-terrain comparison. Sand contains mixed mineral/rock grains; do not equate it to pure quartz, gypsum or Martian basaltic sand. |
| `bisti-badlands`, New Mexico | 36.27, -108.25 | Candidate analog window in eroded sedimentary terrain; proposed Jezero strata-access comparison. Not a verified delta analog or evidence for Martian biological equivalence. |

Selection evidence:

- [NPS Cima Lava Tube](https://www.nps.gov/places/the-lava-tube-at-mojave.htm)
  provides the first centre and the volcanic surface context. The DEM shows the
  surface around the site; an underground passage is not represented.
- [NPS Sunset Crater geodiversity](https://www.nps.gov/articles/nps-geodiversity-atlas-sunset-crater-volcano-national-monument-arizona.htm)
  documents the cone and adjacent lava terrain. Our coordinate is an analysis
  choice spanning that terrain, not a surveyed cone summit or safe landing pad.
- [NPS Great Sand Dunes origins](https://www.nps.gov/grsa/learn/nature/volcanic-origins-of-great-sand-dunes.htm)
  supports a mixed-source sand interpretation. The footprint is a selected central
  dunefield window, not the whole park or a measured migration transect.
- [BLM Bisti/De-Na-Zin](https://www.blm.gov/programs/national-conservation-lands/new-mexico/bisti-de-na-zin-wilderness)
  documents interbedded sandstone, shale, mudstone and other sedimentary materials.
  The analysis window provides regional context; fine hoodoos are not resolved.

These references support Earth classifications. The Earth–planet proposals are
engineering hypotheses with explicit differences in `pairings.py`; no cited
source is presented as validating our exact pair or percentage. This is a digital
comparison catalog, not authorization for field experiments at protected locations.

## Assets and conditions

Each pack has 161 x 161 samples at 30 m spacing: 4.8 km between outer centres and
4.83 km between outer pixel edges. The catalog bbox uses those outer edges. This
fixed footprint makes comparisons reproducible without downloading whole scenes.
UTM CRS, EGM2008 vertical datum, north-first/west-first order, little-endian float32
encoding and source scale/offset are recorded in the manifests/receipts. Invalid
source elevations cause failure; no synthetic fill is used.

Retained assets per new site:

- `source-window.tif` and `source-receipt.json`: bounded native DEM subset and hash.
- `elevation.tif`, `elevation.f32`, `manifest.json`, `checksums.json`: runnable terrain.
- `power-daily-2024.json`: exact cached response bytes used for the annual conditions.

Elevation/slope/roughness remain derived. Wind and 2 m air temperature are regional
MERRA-2 context; skin temperature is distinct, and CERES albedo has different spatial
support. Annual daily means are not seasonal climate or local measurements. Native
Copernicus sampling is approximately one arc-second, varying with latitude; 30 m
output spacing does not create more source detail. Soil mechanics, resource
abundance, fine landform dimensions and local measurement errors remain unknown.
There are no new ten-year seasonal profiles or ERA5/3DEP alternative assessments
for these four sites. Existing Earth and planetary packs were preserved.

Retain [Copernicus attribution/licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf)
and NASA POWER/MERRA-2/CERES product attribution from the catalog. Each downloaded
source's URL and checksum is recorded; no credentials or full source scenes are
committed. `mixed_sand` and `badlands` are additive controlled-vocabulary entries,
not shortcuts for estimating friction or cohesion.

## Selection and efficiency

Matching version **1.1.0** screens 135 possible Earth–planet pairs. Eligibility
requires valid terrain and compatible analysis scales. Central-window scores
provide safe upper bounds for the detailed minimum-window score. On this catalog,
25 pairs are pruned and 110 detailed audits are used; 90 selected comparisons are
published (ten per planetary target). Existing sourced proposals retain priority.
The complete output agrees with exhaustive top-ten selection in tests. No fixed
geology-label filter is used because it could discard useful process analogs.

The pipeline shares derived source windows across pairs and between the proposal
audit and shortlist stages. Its cache is local to one run, not reused blindly
after terrain changes. This avoids duplicate raster processing. The UI reads the
precomputed shortlist and does not run the scoring pipeline on every click.
See [ANALOG_MATCHING.md](ANALOG_MATCHING.md) for formula, scale, weights, tie rules,
missing-data handling and the distinction between similarity and accuracy.

## Reproduce

Stop the local development server before publishing on Windows. From the repo root:

```powershell
.\.venv\Scripts\python.exe -m scripts.catalog.build --site cima-lava-field --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site sunset-crater --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site great-sand-dunes --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site bisti-badlands --offline
.\.venv\Scripts\python.exe -m scripts.catalog.register --site cima-lava-field --site sunset-crater --site great-sand-dunes --site bisti-badlands
.\.venv\Scripts\python.exe -m scripts.catalog.validate
.\.venv\Scripts\python.exe -m scripts.catalog.coverage
.\.venv\Scripts\python.exe -m scripts.catalog.handoff
node scripts/catalog/check-consumers.mjs
.\.venv\Scripts\python.exe -m pytest -q
```

The retained DEM and weather subsets allow offline reconstruction with an empty
cache. To acquire these inputs in a new location with no retained pack, omit
`--offline`; bounded network reads and checksum receipts are the same pipeline.
From `web/`, run `npm test` and `npm run build`. Neither build nor registration
commits, merges or pushes Git changes.
