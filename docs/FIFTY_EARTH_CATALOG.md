# Fifty Earth study areas

The shared `web/public/sites.json` contains **50 Earth locations across 26
countries**, plus four Moon and five Mars targets: **59 records total**. This
expansion adds 23 Earth study areas to the previous 27. Existing records and terrain
packs are preserved; ranking/scoring code and the top-ten UI policy are unchanged.
The matching pipeline considers 450 possible Earth/planet combinations. Catalog
membership does not guarantee a place in a target's displayed top ten. The engine
may return fewer than ten when its existing evidence/terrain cutoff excludes
remaining candidates; this expansion does not weaken that cutoff.

## The 23 additions

Centres below are selected WGS84 analysis coordinates (latitude, east longitude).
Every footprint spans 4.8 km between outer sample centres and 4.83 km between pixel
edges, with the actual geographic bounding box in the catalog. Each is a **candidate
analog**, not an independently validated match or an approved landing/field site.

| ID / location | Country | Centre | Proposed target | Context source |
|---|---|---|---|---|
| `teide-canadas` / Teide Las Canadas | Spain | 28.25, -16.63 | Marius Hills | [NASA](https://science.nasa.gov/earth/earth-observatory/tenerife-canary-islands-88659/) |
| `etna-east` / Etna eastern flank | Italy | 37.73, 15.04 | Arsia flank | [NASA](https://science.nasa.gov/earth/earth-observatory/mount-etna-erupts-15782/) |
| `fournaise-enclos` / Piton de la Fournaise | France (Reunion) | -21.24, 55.73 | Arsia flank | [NASA](https://science.nasa.gov/earth/earth-observatory/piton-de-la-fournaise-volcano-18211/) |
| `fogo-caldera` / Fogo | Cabo Verde | 14.95, -24.35 | Marius Hills | [NASA](https://science.nasa.gov/earth/earth-observatory/fire-island-cabo-verde-148613/) |
| `bromo-sandsea` / Bromo Sandsea | Indonesia | -7.94, 112.95 | Marius Hills | [NASA](https://science.nasa.gov/earth/earth-observatory/gunung-bromo-indonesia-5062/) |
| `pinacate-elegante` / El Pinacate El Elegante | Mexico | 31.77, -113.50 | Arsia flank | [UNESCO](https://whc.unesco.org/en/list/1410/) |
| `bardenas-blanca` / Bardenas Blanca | Spain | 42.21, -1.49 | Jezero | [UNESCO](https://www.unesco.org/en/mab/bardenas-reales) |
| `tabernas-badlands` / Tabernas | Spain | 37.06, -2.46 | Jezero | [Andalusian environment authority](https://www.juntadeandalucia.es/medioambiente/portal/en/web/ventanadelvisitante/detalle-buscador-mapa/-/asset_publisher/Jlbxh2qB3NwR/content/desierto-de-tabernas/255035) |
| `ischigualasto` / Ischigualasto | Argentina | -30.07, -67.95 | Jezero | [UNESCO](https://whc.unesco.org/en/list/966) |
| `talampaya-canyon` / Talampaya | Argentina | -29.79, -67.84 | Jezero | [UNESCO](https://whc.unesco.org/en/list/966) |
| `valle-luna-chile` / Valle de la Luna | Chile | -22.925, -68.285 | Jezero | [Chilean environment authority](https://simbio.mma.gob.cl/CbaAP/VistaImpresion/1053) |
| `uyuni-incahuasi` / Uyuni Incahuasi | Bolivia | -20.24, -67.625 | Jezero | [NASA](https://science.nasa.gov/earth/earth-observatory/salar-de-uyuni-bolivia-6096/) |
| `makgadikgadi-kubu` / Makgadikgadi Kubu | Botswana | -20.89, 25.825 | Jezero | [NASA MODIS](https://modis.gsfc.nasa.gov/gallery/individual.php?db_date=2026-02-05) |
| `tsondab-dunes` / Tsondab northern dunes | Namibia | -23.93, 15.32 | Bagnold | [NASA ISS047-E-23405](https://esrs.jsc.nasa.gov/SearchPhotos/photo.pl?frame=23405&mission=ISS047&roll=E) |
| `rub-khali-oman` / Rub al Khali | Oman | 20.60, 54.10 | Bagnold | [NASA ISS027-E-34290](https://eol.jsc.nasa.gov/Collections/EarthFromSpace/photoinfo.pl?PHOTO=ISS027-E-34290) |
| `badain-jaran` / Badain Jaran | China | 39.83, 102.45 | Bagnold | [UNESCO](https://whc.unesco.org/en/list/1638/) |
| `taklamakan-interior` / Taklamakan | China | 38.80, 83.20 | Bagnold | [NASA](https://science.nasa.gov/earth/earth-observatory/taklimakan-desert-1925/) |
| `lut-yardangs` / Lut western yardangs | Iran | 30.53, 57.83 | Lucus Planum | [UNESCO](https://whc.unesco.org/en/list/1505/) |
| `dunhuang-yardangs` / Dunhuang | China | 40.50, 93.23 | Lucus Planum | [UNESCO tentative-list submission](https://whc.unesco.org/en/tentativelists/5990) |
| `dallol` / Dallol salt dome | Ethiopia | 14.24, 40.30 | Jezero | [Smithsonian GVP 221041](https://volcano.si.edu/volcano.cfm?vn=221041) |
| `lake-abbe-margin` / Lake Abbe eastern margin | Djibouti | 11.145, 41.84 | Jezero | [ESA](https://www.esa.int/ESA_Multimedia/Images/2023/07/Earth_from_Space_Ethiopian_painting) |
| `hverir-namafjall` / Hverir Namafjall | Iceland | 65.64, -16.81 | Jezero | [Iceland environment authority](https://ust.is/library/Skrar/2005/Myvatn_enska.pdf) |
| `pingualuit` / Pingualuit crater | Canada | 61.28, -73.66 | Shackleton rim | [Nunavik Parks](https://www.nunavikparks.ca/en/parks/pingualuit/) |

The exact footprint rationale and pair-specific matches/differences live in
`scripts/catalog/global_sites.py` and are exported into the catalog handoffs.
Regional context sources are not claimed as measurements of the precise crop.
Tabernas has documented ESA field trials, but this selected window is not asserted
to reproduce their exact route. Country counts treat Reunion as France.

## Downloaded science data and processing

Each new pack retains a real Copernicus GLO-30 source crop and receipt, a reprojected
GeoTIFF, a little-endian float32 grid, the manifest, checksums and the original NASA
POWER daily response for 2024. Source product URLs, attribution and the Copernicus
licence reference accompany the assets. Only small native windows are downloaded;
no full global mosaics or synthetic height grids are substituted.

The 161 x 161 output is north-first, west-first, with 30 m sample spacing in the
appropriate WGS84 UTM hemisphere and EGM2008 elevations. The existing loader makes
the explicit south-first conversion for physics. Source resolving power remains
approximately one arc-second with latitude-dependent postings; resampling does not
improve it. Nodata fails ingestion instead of becoming a mean height or zero.

Terrain statistics are derived from these DEMs. Comparable descriptors retain
the existing 1 km cell / 3 km roughness support. Weather is modeled regional
NASA POWER/MERRA-2/CERES data: 2 m air temperature, 10 m wind speed, surface skin
temperature, and all-sky broadband albedo. Daily sample counts, coverage, source
metadata and response checksums are retained. These are not local sensor readings,
seasonal normals, vent temperatures, spectral mineral maps or accuracy estimates.

## Limits that matter to consumers

- Active volcanic areas may have changed since the primarily 2011–2015 elevation
  acquisitions; the packs are historical surfaces, not current hazard maps.
- Bromo, Fogo and El Elegante are volcanic features, not impact craters. Pingualuit
  is an impact crater, but its lake surface is not bathymetry or traversable floor.
- Salt pans may flood; Lake Abbe/Badain Jaran water and vegetation can affect the
  DSM. Small chimneys, caves, dune slipfaces and wheel-scale obstacles are unresolved.
- Basin deposits and hydrothermal systems are proposed process/operations analogs,
  not Jezero delta replicas. Earth fossils do not imply life on Mars.
- Substrate remains unknown where a broad regional description does not establish
  local composition. No friction, cohesion or bulk density is inferred from it.
- Overall environmental equivalence remains unverified. Adding locations does not
  turn the engineering terrain score into scientific accuracy or landing safety.

## Rebuild and validate

Use the existing project virtual environment and dependencies. Stop the local dev
server before publishing on Windows. Stage without replacing the public catalog:

```powershell
.\.venv\Scripts\python.exe -m scripts.catalog.expand_global
```

Rebuild from cached or retained sources and publish only after every site validates:

```powershell
.\.venv\Scripts\python.exe -m scripts.catalog.expand_global --offline --publish
.\.venv\Scripts\python.exe -m scripts.catalog.validate
.\.venv\Scripts\python.exe -m scripts.catalog.coverage
.\.venv\Scripts\python.exe -m scripts.catalog.handoff
.\.venv\Scripts\python.exe -m scripts.catalog.accuracy
.\.venv\Scripts\python.exe -m pytest -q
node scripts/catalog/check-consumers.mjs
```

From `web/`, run `npm test` and `npm run build`. Individual crops can be rebuilt
with `python -m scripts.catalog.build --site <id> --offline` and registered with
the existing `scripts.catalog.register` CLI. The expansion report records failures;
one failed download prevents batch publication while retaining successful staged
work for retry. No command commits, pushes, merges or deploys the repository.

Tests verify 50 unique Earth IDs, distinct asset paths and elevation hashes, no
overlap of new study windows with existing Earth footprints, correct UTM/centre
mapping, reconstruction from retained DEMs, weather reproduction, and refusal to
publish a partially failed batch. See [the earlier international handoff](WORLD_EARTH_CATALOG.md)
for the twelve preceding international additions.
