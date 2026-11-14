# Data sources and remaining work

The machine-readable run report is `data/catalog-run-report.json`. Actual
product URLs, hashes and output dimensions are in each terrain manifest and
the catalog. This report distinguishes implemented code from ingested data.

| Provider | Used | Investigated / gap |
|---|---|---|
| ESA/Copernicus | GLO-30 public AWS mirror windows for all eleven Earth sites, including existing Kilbourne | Approximate 30m DSM, mainly 2011–2015; not bare-earth soil, not a current Sentinel radar retrieval. Quality masks not ingested. |
| NASA PDS / USGS | MGS MOLA DEM mosaic windows for Jezero, Bagnold, Arsia and Phoenix | Approx 463m equatorial native postings; interpolated altimetry cannot resolve dunes/polygons/caves. NASA PDS science redistributed as USGS GeoTIFF, not a new PDS raw-product download. |
| NASA LRO / USGS | LOLA March 2014 mosaic windows for Marius Hills and Shackleton | Approx 118m equatorial postings, variable physical spacing with latitude; scale 0.5 applied. No cave geometry. |
| NASA POWER | 2024 T2M, WS10M, TS, ALLSKY_SRF_ALB daily responses for Earth sites | MERRA-2 temperature/wind regional reanalysis and CERES broadband albedo. 2m air and skin temperature are kept distinct. No vector wind supplied. Missing days excluded and count retained. |
| NASA Earthdata Search | Existing configurable `fetch_earthdata.py` retained; no new Earthdata granules ingested | MODIS MOD11A2 surface temperature and MCD43A3 BRDF/albedo are useful future higher-resolution replacements. They require product QA and Earthdata Login; no credentials supplied or used. POWER is a separate NASA service, not proof of Earthdata granule ingestion. |
| NASA Worldview | Discovery only, no screenshots treated as science | Trace MODIS visualizations back to MOD11/MCD43 products and QA before quantitative use. |
| LRO Diviner | GCP cells for Marius Hills and Shackleton, selected with verified HTTP byte ranges | LRO-L-DLRE-5-GCP-V1.0 bins observations by 0.5-degree coordinates and 0.25h local time, 2009-07-05 through 2015-04-01. Reported min/max are extrema of available bolometric brightness-temperature bins, not footprint extremes or current temperature. Do not compare these with Earth daily air temperature. |
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
