# International Earth terrain handoff

The production catalog has **50 Earth locations in 26 countries**, plus four
Moon and five Mars targets (59 records total). The Earth coverage spans six
inhabited continents. This document describes the earlier twelve international
additions; see [the 50-location handoff](FIFTY_EARTH_CATALOG.md) for the latest 23.
Haughton, Qaidam and the thirteen US windows remain included.

This change supplies data to the existing decision engine. It does not change
ranking, filters, scoring weights, comparison thresholds, or the ten-candidate
viewer policy. Rebuilding the catalog naturally recalculates recommendations from
the expanded inputs. Claude's concurrent viewer/assessment work is preserved.

## Added locations

Centres are selected analysis coordinates in WGS84, not surveyed landing pads or
claims to reproduce a particular field sampling plot. Every window spans 4.8 km
between outer sample centres and 4.83 km between outer pixel edges. The catalog
bbox records those outer edges in west, south, east, north order.

| Stable ID | Country and centre (lat, east lon) | Comparison purpose and limits |
|---|---|---|
| `lanzarote-timanfaya` | Spain; 28.97, -13.75 | Basaltic volcanic terrain; proposed Marius Hills and Arsia comparisons. ESA documents planetary training on Lanzarote, but this Timanfaya window is not an exact PANGAEA traverse or cave model. |
| `askja-east` | Iceland; 65.055, -16.60 | Lava/tephra terrain east of Askja near Dreki; proposed volcanic-operations comparisons with Arsia and Marius Hills. This is not a relocation of NASA's published ripple-monitoring plots. Substrate mixture remains unknown. |
| `atacama-yungay` | Chile; -24.08, -69.86 | Arid-surface operations and preservation context for a proposed Jezero comparison. This Yungay-region window is not a delta replica, chemistry survey or exact historic sampling plot. |
| `sossusvlei-dunes` | Namibia; -24.77, 15.30 | Dune-and-pan terrain near Sossusvlei/Deadvlei for a proposed Bagnold comparison. Terrestrial fog, ephemeral water and sand mineralogy differ from Mars; migration is unmeasured. |
| `lonar-crater` | India; 19.975, 76.51 | Impact crater in basalt, proposed against Shackleton rim operations. The lake surface is not bathymetry or traversable ground. Vegetation, basin geometry and illumination differ. |
| `wolfe-creek` | Australia; -19.171, 127.795 | Impact rim/floor context, proposed against Shackleton. Crater infill, scale, vegetation and terrestrial conditions differ; local substrate fractions remain unknown. |
| `wadi-rum` | Jordan; 29.54, 35.44 | Sand-filled valleys and rock relief south of Rum village; candidate Jezero outcrop-access comparison, not a delta replica. Regional granite/sandstone does not identify every surface pixel. |
| `richat-ridges` | Mauritania; 21.16, -11.31 | Eastern ridges within an eroded dome; candidate Lucus Planum terrain-access comparison. Richat is not an impact crater, and its cuestas are not Martian yardangs. |
| `harrat-khaybar` | Saudi Arabia; 25.67, 39.93 | Central volcanic field near Jabal Qidr; proposed Marius/Arsia flow-relief comparisons. The region contains multiple volcanic compositions, so no uniform basalt classification is assigned. |
| `payun-matru` | Argentina; -36.40, -69.30 | Western shield-flank window outside the caldera centre; proposed Arsia/Marius volcanic-operations comparisons. Does not represent the whole shield, caldera or a measured lunar material equivalent. |
| `tongariro-west` | New Zealand; -39.15, 175.58 | Western volcanic mountain terrain near Mangatepopo; candidate Arsia operations comparison. Andesitic regional geology differs from Martian basalt, and snow/vegetation can affect the DSM. |
| `erg-chebbi` | Morocco; 31.16, -3.96 | Central dune window northeast of Merzouga; proposed Bagnold comparison. Star-dune geometry, rain-fed shallow aquifers and unmeasured sand composition differ from the Martian context. |

Classification and location-context references:

- [ESA: Lanzarote and planetary training](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_Pangaea/Lanzarote_and_ESA_united_by_space).
- [Vatnajökull National Park: Askja geology](https://www.vatnajokulsthjodgardur.is/en/areas/askja/askja-eldstod);
  [NASA planetary analog explorer](https://science.nasa.gov/solar-system/analog-explorer/)
  supplies separate regional context for Icelandic ripple research, not evidence of
  resolved ripples in this 30 m pack.
- [NASA AHED: Yungay](https://ahed.nasa.gov/about/about-image?id=4).
- [NASA Earth Observatory: Namib Sand Sea](https://science.nasa.gov/earth/earth-observatory/namib-sand-sea-149130/).
- [NASA Earth Observatory: Lonar](https://science.nasa.gov/earth/earth-observatory/lonar-crater-india-8654/).
- [NASA Earth Observatory: Wolfe Creek](https://science.nasa.gov/earth/earth-observatory/wolfe-creek-crater-8488/).
- [NASA Earth Observatory: Wadi Rum](https://science.nasa.gov/earth/earth-observatory/wadi-rum-jordan-49945/).
- [NASA Earth Observatory: Richat](https://science.nasa.gov/earth/earth-observatory/eyeing-the-richat-structure/).
- [NASA Earth Observatory: Harrat Khaybar](https://science.nasa.gov/earth/earth-observatory/harrat-khaybar-volcanic-field-8650/);
  [Smithsonian volcanic field 231060](https://volcano.si.edu/volcano.cfm?vn=231060).
- [NASA Earth Observatory: Payun volcanic field](https://science.nasa.gov/earth/earth-observatory/payun-volcanic-field-80017/);
  [Smithsonian volcano 357066](https://volcano.si.edu/volcano.cfm?vn=357066) locates the caldera reference at -36.422, -69.241.
- [New Zealand Department of Conservation: central North Island volcanoes](https://www.doc.govt.nz/parks-and-recreation/places-to-go/central-north-island/places/tongariro-national-park/about-tongariro-national-park/central-north-island-volcanoes/).
- [NASA Earth Observatory: Erg Chebbi](https://science.nasa.gov/earth/earth-observatory/the-shallow-aquifers-of-erg-chebbi-89181/).

These sources support site context. Our exact Earth–planet pairings remain
proposed engineering comparisons, with individual matches and differences in
`scripts/catalog/pairings.py`. No new discovery, approved landing site, field-access
permission or validated environmental equivalence is claimed. Old source-page
age estimates are not adopted as new geological measurements.

## Data actually ingested

All twelve international additions have real Copernicus GLO-30 cropped source rasters, plus
NASA POWER daily 2024 responses for 2 m air temperature, 10 m wind speed, surface
skin temperature and broadband albedo. Regional weather remains modeled; derived
elevation/slope statistics remain derived. Missing sensor/model values are excluded
with sample counts retained. No station-level accuracy or fine soil mechanics is
inferred from these records.

Each `web/public/terrain/<id>/` directory contains:

- Native `source-window.tif` and its checksum/URL receipt.
- Processed `elevation.tif` and little-endian `elevation.f32`, 161 x 161 samples
  at 30 m output spacing, north-first and west-first.
- The retained `power-daily-2024.json` response used for environmental conditions.
- Manifest, attribution and checksums for every asset.

Earth vertical elevations use EGM2008. Source Copernicus postings are approximately
one arc-second with latitude-dependent physical spacing; the 30 m output does not
increase source resolving power. These are surface models, not guaranteed bare-earth
surfaces. Water and vegetation must be considered when interpreting Lonar or other
sites; the DEM does not model lake floors, caves or fine collision hazards.

The ingestion code now selects the UTM hemisphere correctly:

| Sites | WGS84 projected CRS |
|---|---|
| Lanzarote, Askja | EPSG:32628 (UTM 28N) |
| Yungay | EPSG:32719 (UTM 19S) |
| Sossusvlei | EPSG:32733 (UTM 33S) |
| Lonar | EPSG:32643 (UTM 43N) |
| Wolfe Creek | EPSG:32752 (UTM 52S) |
| Wadi Rum | EPSG:32636 (UTM 36N) |
| Richat ridges | EPSG:32629 (UTM 29N) |
| Harrat Khaybar | EPSG:32637 (UTM 37N) |
| Payun Matru | EPSG:32719 (UTM 19S) |
| Tongariro west | EPSG:32760 (UTM 60S) |
| Erg Chebbi | EPSG:32630 (UTM 30N) |

Tests verify the coordinate maps to the central sample, north/south CRS selection,
positive southern northing, reprojection from retained native elevation, exact
float32/GeoTIFF agreement, and reproduction of weather summaries with an empty
cache. Polar locations outside UTM coverage fail explicitly rather than receiving
an inappropriate projection. Existing northern site records and packs are preserved.

Retain the Copernicus licence and attribution linked by each manifest, and credit
NASA POWER/MERRA-2/CERES for environmental summaries. ESA/NASA/park interpretation
pages are citations, not substitutes for the downloaded elevation products.
There are no new MODIS, SAR, ERA5 or geotechnical measurements in this expansion.
The twelve sites lack separate multi-year seasonal profiles and local uncertainty
validation. Unknown substrate entries intentionally supply no soil classification
to the physics adapter; simulation assumptions remain separate.

## Rebuild and validate

Stop the local development server before publishing on Windows. The retained DEM
windows and weather responses support offline reconstruction:

```powershell
.\.venv\Scripts\python.exe -m scripts.catalog.build --site lanzarote-timanfaya --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site askja-east --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site atacama-yungay --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site sossusvlei-dunes --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site lonar-crater --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site wolfe-creek --offline
.\.venv\Scripts\python.exe -m scripts.catalog.register --site lanzarote-timanfaya --site askja-east --site atacama-yungay --site sossusvlei-dunes --site lonar-crater --site wolfe-creek
foreach ($catalogSite in @('wadi-rum','richat-ridges','harrat-khaybar','payun-matru','tongariro-west','erg-chebbi')) {
    & .\.venv\Scripts\python.exe -m scripts.catalog.build --site $catalogSite --offline
    if ($LASTEXITCODE -ne 0) { throw "Failed to stage $catalogSite" }
}
.\.venv\Scripts\python.exe -m scripts.catalog.register --site wadi-rum --site richat-ridges --site harrat-khaybar --site payun-matru --site tongariro-west --site erg-chebbi
.\.venv\Scripts\python.exe -m scripts.catalog.validate
node scripts/catalog/check-consumers.mjs
.\.venv\Scripts\python.exe -m pytest -q
```

Omit `--offline` to retrieve uncached products where no retained pack is present.
From `web/`, run `npm test` and `npm run build`. Full dataset URLs, hashes, units
and coverage are in `web/public/sites.json` and the pack receipts. Rebuilding and
registration modify local generated artifacts; they do not push or merge Git.

Claude can consume all 50 Earth records through the same catalog interface. There
are now 450 possible Earth–planet pairs. Benchmark counts in earlier expansion
documents describe those earlier catalog snapshots; they are not current totals.
