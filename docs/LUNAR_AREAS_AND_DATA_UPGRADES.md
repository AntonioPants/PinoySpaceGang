# Lunar study areas and practical data upgrades

The production catalog now has **24 locations: 15 Earth, 5 Mars and 4 Moon**.
The original eighteen records and terrain packs are preserved. Two additional
lunar windows are enabled in the existing target selector and terrain loaders.
Four further Earth areas are documented in [EARTH_CATALOG_EXPANSION.md](EARTH_CATALOG_EXPANSION.md).

## Added lunar areas

| ID | Centre (latitude, east longitude) | Selection and boundaries |
|---|---|---|
| `malapert-massif` | -85.9948, -0.23578 | Site23 from NASA's 2025 Lunar Surface Data Book, Table A2.1-1. The square window supplies local highland context around that reference point. |
| `mons-mouton` | -84.60, 31.00 | IAU Gazetteer named massif centre. The window is a small central sample, not the entire named mountain, Mons Mouton Plateau candidate region or a landing ellipse. |

[NASA's 2024 candidate-region announcement](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)
includes Malapert Massif and Mons Mouton. This historical exploration context
motivates their selection; it does not approve these exact windows for a base.
Coordinates come from the [Lunar Surface Data Book](https://ntrs.nasa.gov/citations/20250002845)
and [IAU/USGS Gazetteer](https://planetarynames.wr.usgs.gov/Feature/16070), respectively.
Marius Hills and Shackleton remain available.

Both new packs use bounded reads from the
[NASA LRO LOLA mosaic distributed by USGS](https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif).
Each has 33 x 33 north-first, west-first float32 samples at 150 m output spacing:
4.8 km between outer sample centres; 4.95 km between outer pixel boundaries.
The catalog bbox encloses those boundaries in east-positive body coordinates.
Local spherical azimuthal-equidistant projections use radius 1,737,400 m;
heights are relative to that reference sphere. Source postings are approximately
118.5 m at the equator, with anisotropic sampling near the poles. Output spacing
does not establish sensor accuracy. Source scale/offset are applied once.

Each pack includes the native cropped GeoTIFF and receipt, processed GeoTIFF,
float32 samples, manifest and checksums. No invalid elevations are filled.
The `massif` category is an additive vocabulary extension: a mountain mass,
not a crater, volcanic cone or measurement of strength. `lunar_regolith` denotes
broad lunar surface context, not a measured composition or geotechnical class.

The [PDS LRO Diviner archive](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm)
supplies one verified 0.5-degree GCP cell per new location, covering 96 local-time
bins. Its exact downloaded bytes are retained as `diviner-cell.tab`; source URL,
byte range and SHA-256 are in the condition records. Min/max summaries describe
available regional bolometric brightness-temperature bins from 2009–2015.
They are not footprint extremes, annual means, or current ground temperatures.
Negative/missing bins are excluded, with the valid-bin count recorded.

Persistent illumination, shadow duration, communication visibility, ice inventory,
wheel-scale obstacles and bearing strength remain unverified. These are **base-study
areas**, not safe landing or construction certifications. The comparison matrix
offers exploratory shape-based Earth suggestions; neither new area has a reviewed
geological Earth pairing. The UI states that limitation. Do not interpret their
terrain percentages as environmental accuracy or validated base suitability.

## Moon display

The paired-location view omits lunar 2 m air temperature and 10 m atmospheric wind.
Machine-readable records retain null + `not_applicable` and their explanations.
That preserves the distinction from missing Mars measurements. Lunar surface
temperature and albedo remain relevant unknowns; the separate Diviner summaries
remain visible. Observation statuses such as `derived` are retained.

## Easier Earth and Mars data routes

Run `python -m scripts.catalog.assess_sources` to reproduce the actual API checks.
`data/source-assessment.json` records the requests, response checksums, processed
alternatives and discoveries for the original eleven Earth and five Mars sites.
The four subsequent Earth additions have POWER context; they have not undergone this separate alternative-source assessment. Raw API
responses and timestamped receipts are cached under `data/cache/catalog/source-assessment`.
`--offline` regenerates the report from those verified cached responses. This
assessment deliberately does not overwrite the production observations or scores.

| Purpose | Executed here | Next step before promotion |
|---|---|---|
| US terrain | USGS EPQS elevation queries at all nine US centres; responses report 1 m source resolution at eight sites and 5 m at Barrow | Retrieve matching 3DEP raster windows and metadata; inspect bare-earth coverage and align vertical datums. EPQS points alone are not replacement packs or independent validation. |
| Earth air temperature / wind | Downloaded and summarized 2024 daily ERA5 for all eleven Earth sites through Open-Meteo, pinned model, UTC, wind m/s, elevation downscaling disabled | Compare seasonally with quality-controlled local stations; assess time coverage and representativeness before replacing POWER. |
| Mars terrain | Queried actual USGS HiRISE DTM collection over all five catalog footprints; product IDs, DTM URLs, available FOM links and sampling metadata recorded | Download bounded DTM plus available Figure of Merit windows, check PDS labels, valid-data footprint, scale/offset and vertical datum, then build a versioned pack. Bounding-box overlap is not full coverage. |
| Mars climate | Investigated official Mars Climate Database 6.2 access | Register for the full database for reproducible intensive use; select season, local time, dust scenario and height. Retain `modeled` status. No MCD data ingested here. |
| Mars observations | Investigated PDS MEDA calibrated/derived CSV and ancillary geometry for Jezero | Select spatially and temporally relevant rover records, interpret sensor quality flags and actual measurement heights. No MEDA records ingested here. |

Authoritative references and constraints:

- [USGS EPQS](https://epqs.nationalmap.gov/v1/docs) and
  [3DEP datums/resolution](https://www.usgs.gov/faqs/what-projection-horizontal-datum-vertical-datum-and-resolution-a-usgs-digital-elevation-model):
  US bare-earth elevation is usually NAVD88, with regional exceptions. Copernicus
  DSM is EGM2008 and may include vegetation. Do not call their raw difference an accuracy error.
- [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api):
  ERA5 is 0.25 degrees; ERA5-Land is 0.1 degrees for land variables. This run uses
  ERA5 for a consistent air/wind pair. Regional reanalysis is still modeled.
  Credit Open-Meteo and Copernicus/ECMWF; check [service terms](https://open-meteo.com/en/terms)
  before commercial or high-volume access. Soil temperature is not skin temperature;
  this route supplies neither a new surface-temperature nor an albedo value.
- [USGS HiRISE DTM documentation](https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/):
  the live collection ID is `mro_hirise_socet_dtms` (the documentation's older
  `mro_hirise_controlled_socet_dtms` link returned 404). Collection licence is
  CC0-1.0; cite NASA HiRISE, the DTM producer and USGS. Archive STAC dates require
  source-label review. Search results are discovery metadata, not ingested elevations.
- [MCD access](https://www-mars.lmd.jussieu.fr/mars/access): the web interface is for
  moderate use; full NetCDF/software access requires registration. Commercial use
  requires permission. Seasonal/interpolated model averages do not represent extremes.
- [PDS MEDA](https://pdsatmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html):
  use the product indexes to choose small CSV products instead of whole annual
  bundles. Rover measurements apply at the rover's location and time, not every
  Mars site. Wind sensors are not automatically equivalent to a 10 m reference.
  REMS/Gale and Phoenix/MET are the corresponding local-observation avenues for
  Bagnold and Phoenix; Arsia and Lucus still need orbital/model context.

Higher spatial detail and successful downloads do not by themselves validate an
Earth–planet match. Matching time bases, physical definitions and independent
reference observations are still needed for environmental comparison.

The executed HiRISE searches returned 2 intersecting products at Phoenix, 5 at
Jezero and 11 at Bagnold. No intersection was found for Arsia or Lucus in this
particular collection; that is not proof that no suitable data exist elsewhere.

## Rebuild and validation

Use the repository's `.venv` with its existing requirements. Stop the development
server before catalog publication on Windows; its directory watcher can prevent
the atomic directory swap. The two new sites can be rebuilt independently without
regenerating teammates' Earth/Mars assets:

```powershell
.\.venv\Scripts\python.exe -m scripts.catalog.build --site malapert-massif --offline
.\.venv\Scripts\python.exe -m scripts.catalog.build --site mons-mouton --offline
.\.venv\Scripts\python.exe -m scripts.catalog.register --site malapert-massif --site mons-mouton
.\.venv\Scripts\python.exe -m scripts.catalog.validate
node scripts/catalog/check-consumers.mjs
.\.venv\Scripts\python.exe -m scripts.catalog.coverage
```

Native DEM subsets and Diviner cells retained in the new packs allow offline
reconstruction without an existing cache. For fresh online source reads, remove
neither retained evidence nor caches casually: acquire and review changes explicitly.
A full offline Earth rebuild now fails if its POWER response is missing, instead
of silently erasing existing weather values. Restore the cache or perform an online
rebuild; staged failures preserve production. Run Python tests and `npm test` /
`npm run build` in `web/` before publishing changes.
