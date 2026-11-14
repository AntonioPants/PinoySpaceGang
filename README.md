# Planetary Analog Simulator

## Mission-planner frontend

The React/TypeScript application is in [`web/`](web/README.md), alongside the
team's real Kilbourne terrain pack. It includes globe selection, Earth analog
evidence, mission configuration, and JSON export. See
[`web/INTEGRATION.md`](web/INTEGRATION.md) for the proposed physics/cutscene handoff.
Descent execution now connects to Tim's engine in `app/sim/`, with real flight
reports. Local 3D terrain inspection and JSON/text condition import are available.

The populated shared catalog is [`web/public/sites.json`](web/public/sites.json).
See [integration, categories and rebuild commands](docs/SITE_CATALOG.md) and
[ingested providers and data gaps](docs/DATA_SOURCES_AND_GAPS.md).

This repository turns targeted Earth, Moon, and Mars elevation rasters into
small JSON terrain grids for a browser-based simulator or physics engine. Raw
downloads stay outside Git; processed profiles retain source citations,
projection details, physical cell sizes, and reproducibility metadata.

## Seasonal simulation data for six USA sites

Real 2015–2024 weather and regional radiation profiles, supplementary USDA soil
survey records, and a dependency-free React/Node adapter are available in
[`data/environment`](data/environment) and [`app/lib/environment.mjs`](app/lib/environment.mjs).
See the [integration guide](docs/environment-integration.md) for SI units, loading,
seasonal scenarios, and the distinction between regional data and local contact physics.

```bash
python scripts/environment/export_web.py
node --test tests/environment.test.mjs
```

## Data-source map

| Resource | Simulator role | Access path |
| --- | --- | --- |
| NASA Earthdata Search | Earth DEM, temperature, moisture, mineral products | `earthaccess` |
| NASA Worldview / GIBS | Visual and thermal reference imagery | UI export or GIBS services |
| NASA PDS | MOLA, HiRISE, and other planetary products | PDS3/PDS4 downloads |
| LRO LOLA / LROC | Lunar DEM, slope, roughness, and imagery | PDS Geosciences / LROC |
| LRO Diviner | Lunar temperature and composition | PDS Geosciences |
| CSA RADARSAT | Roughness, ice, permafrost, scattering | EODMS / open data |
| CSA SAR tutorial | Reference SAR processing code | GitHub clone into `vendor/` |
| Copernicus Data Space | Sentinel-1 SAR and Sentinel-2 multispectral | STAC / openEO |
| ESA Open Science Catalog | Curated geoscience products | Catalog / STAC |
| JAXA G-Portal | ALOS-2 PALSAR and cryosphere products | G-Portal |

Machine-readable descriptions and dataset citations live in
[`data/catalog_manifest.json`](data/catalog_manifest.json).

## Layout

```text
data/
  raw/                         # ignored large downloads
  processed/earth_analogs/     # committed simulator profiles
  processed/planetary_sites/
  catalog_manifest.json
  catalog_manifest.schema.json
  terrain_profile.schema.json
scripts/
  fetch_earthdata.py
  fetch_copernicus.py
  extract_profile.py
tests/
app/
vendor/
```

## Install

Python 3.10 or newer is recommended. Rasterio wheels include GDAL on common
platforms; system GDAL installations must be ABI-compatible with Rasterio.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
```

Create an Earthdata Login account and put credentials in `.netrc`, or use an
authentication strategy supported by `earthaccess`. Download Haughton data:

```bash
python scripts/fetch_earthdata.py \
  --short-name NASADEM_HGT \
  --bbox -90.0 75.2 -89.4 75.5 \
  --count 5
```

## Extract a terrain profile

Manifest-backed sites need only a source raster. The manifest supplies type,
body, bbox, display name, dataset citation, and output directory:

```bash
python scripts/extract_profile.py \
  --site haughton_crater \
  --input data/raw/haughton_dem.tif \
  --max-size 128
```

An explicit site works as well:

```bash
python scripts/extract_profile.py \
  --site field_site_alpha \
  --name "Field Site Alpha" \
  --type earth_analog \
  --body earth \
  --input data/raw/site_alpha.tif \
  --bbox -110.2 35.1 -110.0 35.3 \
  --bbox-crs EPSG:4326 \
  --dataset-id nasadem_hgt \
  --width 192 --height 192
```

For a lunar or Martian product, `--bbox-crs auto` means body-specific longitude
and latitude using the mean body radius. If a PDS product has unusual or missing
projection metadata, pass bbox values in its map coordinates with
`--bbox-crs native`. For an unreferenced raster, also supply
`--pixel-size-m DX DY`; `--source-crs` can override missing CRS metadata.

```bash
python scripts/extract_profile.py \
  --site jezero_crater \
  --input data/raw/megr44n090hb.img \
  --bbox-crs native \
  --bbox MIN_X MIN_Y MAX_X MAX_Y \
  --pixel-size-m 463 463
```

Detached PDS labels must remain beside their binary image. Format support is
determined by the GDAL drivers in the installed Rasterio build. Elevations are
converted with the raster band's scale/offset metadata; override them with
`--vertical-scale` and `--vertical-offset` when product documentation requires.

The output contains:

- elevation in metres;
- slope in degrees, calculated from metre-scale gradients;
- local RMS height roughness in metres;
- CRS WKT, affine transform, requested and output bounds, and resolution;
- provider/product citation and optional source SHA-256;
- `null` for source nodata cells (never non-standard JSON `NaN`).

Use `--skip-checksum` for huge immutable inputs and `--overwrite` when replacing
an existing processed profile. Run `python scripts/extract_profile.py --help`
for all options.

## Validate

```bash
python -m pytest
```

Tests build synthetic GeoTIFFs and check physical slope, roughness, nodata
handling, JSON writing, and manifest-schema conformance.
