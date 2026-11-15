# Data sources and remaining work

The machine-readable run report is `data/catalog-run-report.json`. Actual
product URLs, hashes and output dimensions are in each terrain manifest and
the catalog. This report distinguishes implemented code from ingested data.

| Provider | Used | Investigated / gap |
|---|---|---|
| ESA/Copernicus | GLO-30 terrain for 102 Earth windows (50 curated and 52 registered scans) | Approximate 30m DSM, mainly 2011–2015; not bare-earth soil, not a current Sentinel radar retrieval. Quality masks not ingested. |
| NASA PDS / USGS | MGS MOLA DEM mosaic windows for all 25 Mars targets | Approx 463m equatorial native postings; interpolated altimetry cannot resolve dunes/polygons/caves. NASA PDS science redistributed as USGS GeoTIFF, not a new PDS raw-product download. |
| NASA LRO / USGS | LOLA March 2014 mosaic windows for all 24 Moon targets | Approx 118m equatorial postings, variable physical spacing with latitude; scale 0.5 applied. No cave geometry or base-safety certification. |
| NASA POWER | 2024 T2M, WS10M, TS, ALLSKY_SRF_ALB daily responses for all 102 Earth sites | MERRA-2 temperature/wind regional reanalysis and CERES broadband albedo. 2m air and skin temperature are kept distinct. No vector wind supplied. Missing days excluded and count retained. |
| NASA Earthdata Search | Existing configurable `fetch_earthdata.py` retained; no new Earthdata granules ingested | MODIS MOD11A2 surface temperature and MCD43A3 BRDF/albedo are useful future higher-resolution replacements. They require product QA and Earthdata Login; no credentials supplied or used. POWER is a separate NASA service, not proof of Earthdata granule ingestion. |
| NASA Worldview | Discovery only, no screenshots treated as science | Trace MODIS visualizations back to MOD11/MCD43 products and QA before quantitative use. |
| LRO Diviner | GCP cells for all 24 lunar targets, selected with verified HTTP byte ranges | LRO-L-DLRE-5-GCP-V1.0 bins observations by 0.5-degree coordinates and 0.25h local time, 2009-07-05 through 2015-04-01. Reported min/max are extrema of available bolometric brightness-temperature bins, not footprint extremes or current temperature. Do not compare these with Earth daily air temperature. |
| CSA RCM | No science products ingested | EODMS public account required; vetted access may be required for finer products. Radar backscatter is not elevation or soil friction. No site-matched SAR inversion method implemented. |
| CSA RADARSAT-1 | No science products ingested | Archive investigated as possible radar context. No appropriate scene selected/processed; this is an unfinished optional radar integration, not a fabricated authentication failure. |

Useful authoritative references:

- https://registry.opendata.aws/copernicus-dem/
- https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m
- https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- https://pds-geosciences.wustl.edu/missions/lro/diviner.htm
- https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/
- https://www.asc-csa.gc.ca/eng/satellites/radarsat/faq.asp
- https://donnees-data.asc-csa.gc.ca/en/dataset/radarsat1
- https://pds-geosciences.wustl.edu/missions/amboycrater/index.htm

Amboy's PDS field-photo archive documents February 1976 field research and is
an interpretation resource. Its photos are not elevation, soil mechanics or
a modern collision surface. White Sands' gypsum and Badwater's evaporites do
not establish equivalence to every Martian dune or basin. Barrow polygon size,
active-layer depth and ground temperature require matched field products or
higher-resolution data; regional DSM/air temperature cannot fill those fields.

## Access and remaining steps

The [international handoff](WORLD_EARTH_CATALOG.md) covers Lanzarote, Askja,
Yungay, Sossusvlei, Lonar and Wolfe Creek, including southern-hemisphere projections
and the distinction between unknown material classifications and simulation inputs.

See [lunar additions and tested alternative data routes](LUNAR_AREAS_AND_DATA_UPGRADES.md)
for the two new lunar packs, actual 3DEP point queries, processed ERA5 alternatives
and HiRISE product discovery. Those alternatives are an assessment, not silent
replacements for the reviewed production conditions.

Earthdata: set credentials outside Git using Earthdata Login/netrc or environment
variables. The existing fetch command supports configurable collection/bounds:
`python scripts/fetch_earthdata.py --short-name MOD11A2 --bbox ... --auth-strategy environment`.
Then implement product-specific QA, scale/offset, temporal aggregation and units
before filling conditions. This is retrieval support, not completed MODIS ingestion.

RCM: register at EODMS, establish licence/access for a selected scene, then
calibrate and terrain-correct SAR using a documented model. A configurable
authenticated download utility is provided below; no automatic scene-to-friction
conversion is scientifically supported.

Remaining unknowns: planetary environmental time series, geological mixture
fractions, local uncertainty estimates, material mechanics, fine dune/crater
geometry and polygon microrelief, local resource abundance. Combined environmental
similarity remains null. Local soil labels are source-backed interpretations,
not mapped geotechnical measurements.

## Attribution

Retain the original Kilbourne attribution and COPERNICUS-LICENSE.pdf for every
Earth-derived asset: produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014
and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the
European Union and ESA; all rights reserved. New Earth manifests link to that
same licence rather than duplicate it. Cite NASA/USGS MOLA and LOLA teams and
the linked product records for planetary data. Cite NASA POWER and underlying
MERRA-2/CERES products for environmental summaries. No SAR licence rights are
claimed because no SAR imagery is redistributed.

Haughton and Qaidam now have real GLO-30 terrain windows with saved native subsets
and 2024 POWER context. They do not have the six original sites' separate ten-year
seasonal profiles. See LOCATION_HANDOFF.md for their exact footprints and limitations.

Lucus Planum adds a real MOLA window from the public USGS S3 mosaic distribution;
THEMIS image PIA24008 supplies the yardang interpretation and centre. All proposed
pairings now state matches and differences explicitly; scores remain unvalidated.

## Expansion synchronization, 15 November 2026

The working catalog has 151 terrain-backed records: 102 Earth, 24 Moon and 25 Mars.
All 49 targets now have ten published matches and a refreshed search of the 3,361
indexed Earth windows. `data/catalog-coverage.json` covers every record.
`data/environment-refresh-report.json` records 52 new POWER responses and 15 new
Diviner cells. POWER remains coarse modeled Earth context; nearby windows can
share a climate grid cell. Diviner records remain regional thermal-bin extrema,
not comparable annual surface-temperature observations.

`data/mars-product-assessment.json` records an executed USGS planetary STAC search
for all 25 Mars footprints. Eleven footprints intersect at least one returned
HiRISE DTM candidate; fourteen returned none in this bounded search. This is
product discovery, not new DEM ingestion. A returned intersection does not prove
complete valid-pixel coverage. The next processing step is to check PDS labels,
vertical datum, scale/offset, Figure of Merit, footprint coverage and nodata before
replacing the regional MOLA pack. No Mars weather product was ingested by this
terrain search. Mars surface temperature/albedo/wind and all-site contact mechanics
remain explicit unknowns; supplying these requires a suitable calibrated product
and a supported site/time/height definition, not copying Earth values.

Every published top-ten pair has machine-readable `comparison_explanation` with
individual-site source links, contexts, differences and an explicit unreviewed
status. This does not create literature pairings or independent geological review.
The 59 existing proposals retain their original evidence tier. The 42 targets
without reference proposals remain unvalidated; human review and new independent
reference labels are still required.

The landing baseline now includes a physics implementation fingerprint as well
as the catalog hash. Rebuild it after physics, adapter or baseline-setup changes;
Vite captures the expected fingerprint at startup/build, so restart a dev server
after changing physics. An incompatible baseline is rejected and live simulation
remains the fallback. No flight/debrief layout or sound code is changed by this work.
