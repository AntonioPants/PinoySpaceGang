# Location scan handoff (1.0.0)

This work owns **location discovery and real terrain assets only**. Claude owns
descriptors, accuracy, calibration, matching and ranking. No scoring code or cutoff
is changed here. The scan does not invoke matching code, modify `web/public`, or
give any new window a reviewed planetary pairing.

## Completed run: 2026-11-14

- All 50 existing Earth seed sites are represented in 48 configured regions.
  Overlapping/nearby buffers can merge if the combined area stays bounded.
- The initial batch enables 30 regions across 26 countries, chosen for geographic
  coverage. The other 18 regions have explicit deferred reasons in the config.
- The batch covers about **53,399.7 km²** of search rectangles. This is a sum of
  region areas, not the unique area of overlapping accepted windows.
- Retrieved **108 provider tiles / 4,304,353,120 bytes**: real Copernicus GLO-30
  elevation and ESA WorldCover 2021 v200 classification, with complete-file SHA-256.
- Examined **7,859 windows**; accepted **3,361** in **24 regions / 21 countries**.
  `manifest.json` records the rejection counts per region.
- `windows.jsonl` is **4,269,698 bytes** (4.27 MB). With its shared source receipts
  and manifest, the index is about **4.38 MB**, excluding this guide.
- An offline rerun reproduced the same window-index SHA-256:
  `6532fa26fa8640dbeb7513fdf29759bc2d36600909bc1d7cc8f62393ae378fed`.
- One Amboy-region window was staged and checked through the existing physics
  loader. It is a staging demonstration, **not a ranked recommendation**.

The production catalog remains **50 Earth + 4 Moon + 5 Mars sites**. These 3,361
overlapping windows are additional discovery candidates, not 3,361 distinct,
scientifically established analog locations or enabled map entries.

Six regions yielded zero accepted windows: Bardenas, Barrow, Bromo, Fournaise,
Lonar and Wolfe Creek are rejected by the configured land-cover policy. This is
not evidence those study areas are poor analogs:
the conservative filter excludes vegetation, wetland and water within a 4.8 km
window. Existing catalog sites are never removed by this scan.

## Rebuild and extend

Use the existing project virtual environment (`requirements.txt` and
`requirements-dev.txt` / project test dependencies). Required imports are numpy,
rasterio, pyproj, requests and jsonschema; no new provider credentials are needed.
On Windows replace `python` with `.venv\Scripts\python.exe` if not activated.

```sh
python -m scripts.locations.scan plan
python -m scripts.locations.scan run
python -m scripts.locations.scan run --offline
python -m scripts.locations.store
python -m pytest -q tests/test_location_scan.py
```

`data/scan_regions.json` is editable configuration. Add a sourced region or enable
one of the deferred regions, then rerun. No code changes are needed. Each region
needs a safe stable ID, name, WGS84 `[west,south,east,north]` bbox, anchor
`[longitude,latitude]`, country, target-type search context, rationale, source URL,
seed IDs (empty for a new literature area), sources, and enabled flag.
Each axis must be at most 200 km; antimeridian-crossing areas must be split and
latitudes outside UTM coverage (-80 to 84) are rejected.

The one-time `python -m scripts.locations.regions` command seeds the configuration
from existing catalog sources. **Do not rerun it after manual config additions**:
it replaces the configuration. Target types are region search context inherited
from seed proposals, not labels for every accepted window.

`--region ID` (repeatable) selects an explicit subset, even if disabled by default;
`--stride-m 2400` controls overlap; `--max-gb 20` sets the byte budget. A subset run
**replaces** the committed index with that batch; it does not merge stale windows
from other configurations. Rerun the default batch to restore the full index.
Do not run two scanner processes against the same cache/index at once.

Planning prints area, unique tiles and a conservative compressed-size estimate
before any network call. The default budget is 20 decimal GB. HEAD verifies actual
sizes before GET; streaming downloads enforce those sizes, use retries and write
temporary files before installing verified objects. Budget applies to total source
tile bytes, including cached tiles, not only additional network traffic. Allow
extra disk space for regional mosaics. A missing source region stays unavailable;
missing elevations are never filled with an average or synthetic surface.

## Products and processing

| Product | Use | Source and licence | Limitations |
|---|---|---|---|
| Copernicus GLO-30 public AWS COGs | Regional elevation and real terrain windows | [Provider readme](https://copernicus-dem-30m.s3.amazonaws.com/readme.html), [licence](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf) | DSM, not guaranteed bare ground; approximately 30 m native postings vary with latitude; primarily 2011–2015 acquisition, exact pixel dates unknown; EGM2008 heights |
| ESA WorldCover 10 m 2021 v200 | Land-cover filter only | [Official access](https://esa-worldcover.org/en/data-access), [product DOI](https://doi.org/10.5281/zenodo.7254221), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Annual classification, not present-day conditions; classification errors possible; bare/sparse does not identify mineral, soil, sand, salt or lava |

Only provider tiles intersecting a configured bbox are downloaded. Originals,
regional mosaics and staged packs live under gitignored `data/raw/location-scan/`.
The small `data/earth_index/` artifacts carry original tile IDs, URLs, hashes,
attribution, methods, licence, time coverage and output-grid hashes. No browser
calls a science API. Earthdata, POWER, PDS, Diviner and RADARSAT were not downloaded
for this scan; their pre-existing catalog integrations are unchanged.

DEM mosaics use bilinear reprojection to a local WGS84 UTM CRS at 30 m. WorldCover
uses nearest-neighbour at 10 m, aligned to that grid, and is summarized over the
full window. Pixel-centre elevation samples are 161 × 161, north first and west
first, little-endian float32 in metres. First-to-last sample span is 4,800 m; the
GeoTIFF pixel-edge footprint is 4,830 m. Bboxes enclose that footprint in WGS84,
longitude east-positive. Stride is 2,400 m. These differences are explicit rather
than silently shifting the grid by half a cell.

At least 80% of mask pixels must be class 60 (bare/sparse) or 70 (snow/ice).
Combined tree/crop/built/water/wetland/mangrove classes may occupy at most 5%;
nodata/unsupported classes at most 1%. Other vegetation can occupy the remaining
fraction. This does **not** promise an obstacle-free or wholly unvegetated window.
Any missing DEM sample rejects the entire window. There is no landing-safety claim.

## Interface for Claude

```python
from scripts.locations.store import WindowStore

with WindowStore() as store:
    for location in store.records:
        row, elevation_m, affine, source_receipt = store.read(location['id'])
        # Pass this real north-first grid and provenance to your descriptor pipeline.
```

`WindowStore` verifies schemas, IDs, checksums, finite heights, transforms and
geographic centre/bounds. It checks each regional DEM once per context and caches
open readers. Treat the index and raw rasters as immutable during that context.
Rebuild the cache with `scan run` on a fresh machine, then validate against the
committed index. A changed provider object is a changed data version, not something
to silently accept as the same checksum.

Every row has `evidence_status: exploratory_terrain_only` and
`descriptor_status: awaiting_accuracy_pipeline`. There are **no feature scores,
nearest-neighbour results or rank fields**. The only numerical terrain summaries
are elevation min/mean/max in metres over the full window, derived from its DSM.
Source receipts are shared to keep the index small. Native resolution and output
resolution remain distinct.

When Claude selects a window, stage its terrain independently:

```sh
python -m scripts.locations.materialize --window scan-amboy-region-r1040-c1040
node scripts/locations/check-pack.mjs data/raw/location-scan/staged/scan-amboy-region-r1040-c1040/terrain/scan-amboy-region-r1040-c1040
```

The Node check requires Node 22.18+ for native TypeScript loading. It runs Tim's
unchanged `terrainPackToSite` against all real samples and checks the row flip.
The staged folder contains GeoTIFF, float32, manifest, source receipts, checksums
and `handoff.json`. These are sufficient for the existing mesh/physics loader;
no redundant PNG or prebuilt GLB is required. The tool uses the existing directory
transaction solely inside the cache and **does not publish or score** anything.

The current catalog validator requires proposed pairings for enabled Earth sites.
Scanned windows have neither reviewed geology nor pairings. Consequently they are
**not directly sent to `catalog.register`**. Catalog/accuracy ownership must resolve
the exploratory registration contract before publishing selected windows through
the existing staged publication workflow. Do not invent a pairing to satisfy a
validator. Stop dev servers before any subsequent production publication.

## Validation and remaining work

The completed run passed schema/hash/geographic checks for all 3,361 windows,
the offline byte-for-byte index reproducibility check, ten location tests including
an asymmetric-grid test, and staged pack checks. Whole-repository validation passed:
122 Python tests, 169 web/physics tests, the 59-site catalog validator, consumer
asset checks and the web production build (its existing chunk-size warning remains).

Remaining work belongs to downstream integration: feature extraction and scoring
by Claude; geological review for candidate labels; top-window selection and the
catalog contract for exploratory publication. No new environmental or soil-mechanics
values are inferred. The 18 deferred regions are available for a later bounded
batch. No accuracy benchmark change is claimed by this location-only work.
