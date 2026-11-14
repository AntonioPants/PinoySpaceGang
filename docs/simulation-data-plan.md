# Earth site environmental data for landing and equipment testing

Scope agreed in chat: six USA sites; typical seasonal conditions; landing and
equipment testing. Analog labels and Earth–planetary matching belong to a separate
workstream. This document specifies collection and does not certify landing suitability.
The implemented baseline and its remaining gaps are described in
[environment-integration.md](environment-integration.md).

## Collection baseline

Use 2015–2024 as a proposed common ten-year weather reference period. Call it a
ten-year seasonal baseline, not a formal 30-year climate normal. Retain UTC hourly
records and derive month-of-year and local-time summaries, with sample counts,
missing-data fractions and source changes. Select complete representative hours
for typical and adverse scenarios so temperature, pressure and wind remain
physically consistent. An upper-percentile hourly wind is not a measured gust.

Keep time-varying weather, surface state and relatively static terrain/material
properties separate. A winter snow layer can change albedo, contact behaviour and
terrain hazards without changing the underlying geological unit. Use a defined
map footprint for every site, retaining multiple surface units within it.

## Required quantities

| Group | Quantities and units | Purpose | Source strategy / limits |
| --- | --- | --- | --- |
| Wind | east/north components and speed (m/s), direction convention, reference height (m), temporal averaging; gusts and turbulence only if available | Descent, crosswind, equipment loads, dust transport | NASA MERRA-2 via Earthdata or NASA POWER hourly API; validate with station records if available. Regional model wind does not resolve crater circulation or landing-pad gusts. |
| Atmosphere | pressure (Pa), air temperature (K), relative humidity (%); derived moist-air density (kg/m³) | Aerodynamic drag and cooling | POWER/MERRA-2; preserve source units before conversion. Density is derived, not independently observed. |
| Terrain | elevation (m), slope (degrees), detrended roughness (m), obstacles, local relief and flat-area dimensions | Landing clearance, tip-over and equipment contact | Copernicus DEM baseline. Investigate USGS 3DEP lidar/DTM as a supplementary USA source where available. 30 m terrain cannot resolve footpad-scale hazards; even 1 m data can miss small rocks. |
| Surface materials | exposed rock/sediment/crust/snow/ice zones; texture, sand/silt/clay fractions, coarse fragments, grain size and depth interval | Ground contact, abrasion and dust | Supplement organizer imagery with USDA SSURGO and site-specific geology/field studies. Soil map units have multiple components and unmapped outcrops; do not assign one soil to an entire crater. |
| Ground mechanics | bulk density (kg/m³), cohesion (Pa), friction angle (degrees), bearing resistance (Pa), penetration/compaction measurements | Footpad sinkage, collapse and load support | Site-specific measurements preferred. Soil classification does not determine these uniquely. Contact friction also depends on equipment material and surface state. Unmeasured values remain null or explicitly assumed ranges. |
| Moisture / frozen state | volumetric water content (m³/m³), depth interval, snow depth (m), ice state, active-layer depth (m) | Strength changes, icing and seasonal accessibility | SMAP as regional moisture context with retrieval-quality/freeze flags; local studies for permafrost and ground ice. Its 9 km grid is not 9 km independent resolving power and cannot describe an individual landing pad. |
| Albedo | broadband shortwave albedo (0–1), black-sky/white-sky definition, snow state, solar geometry, quality flags | Absorbed sunlight and thermal/power balance | Earthdata MODIS MCD43A3 v6.1: 500 m grid, daily product built from 16 days of observations. Retain both illumination cases; do not substitute RGB colour for albedo. |
| Thermal surface properties | surface temperature (K), emissivity (0–1); conductivity (W/m/K), specific heat (J/kg/K) where supported | Equipment heating/cooling and ground heat exchange | MODIS surface temperature; ECOSTRESS for finer-scale snapshots where coverage exists (not an Alaska solution). Field/laboratory evidence for thermal material properties. Surface and air temperatures are different quantities. |
| Radiation and precipitation | incident solar flux (W/m²), cloud state, rain/snow rates and temporal units | Solar power, visibility, wetting and thermal balance | NASA radiation/weather products. Compute sun position and terrain shadows separately; regional flux does not include every local obstruction. |
| Dust | erodible material/grain-size evidence, crust and moisture state, measured aerosol/visibility where available | Abrasion, visibility and contamination | Regional aerosol products are context, not a local dust-source map. Plume-driven erosion requires propulsion, material and particle models; it cannot be inferred directly from satellite imagery. |

For initial delivery prioritize wind, atmosphere, terrain, surface units, moisture/
freeze state, albedo, surface temperature and solar radiation. Add ground mechanics
as measurements become available; do not invent site-specific engineering values.

## Site-specific collection priorities

These are surface units to investigate, not completed measurements or labels for
planetary matching.

| Site | Units / contrasts to preserve | Particularly relevant tests |
| --- | --- | --- |
| Kilbourne Hole, NM | Rim, walls, floor; exposed rock versus loose deposits | Sloped landing, rim clearance, loose ground, regional wind versus local shelter |
| Meteor Crater, AZ | Rim/ejecta, walls, floor; rock and sediment contrasts | Impact-terrain landing, slope and block hazards, floor versus rim bearing conditions |
| Amboy, CA | Cone, lava flows, cinders and finer deposits | Uneven hard ground, sharp obstacles, dark-surface thermal exposure |
| Badwater Basin, CA | Salt crust, sediment and seasonally wet areas | Crust failure, saline contamination, heat, wet versus dry contact behaviour |
| White Sands, NM | Dune crests, slopes and interdunes; loose versus cemented material | Sinkage, granular slopes, windblown grains, bright-surface energy balance |
| Utqiaġvik / BEO, AK | Polygon centres/troughs, frozen ground, thawed layer and snow | Seasonal bearing changes, differential settlement, cold starts and icing |

## Handoff contract

Each parameter must include value/range or null, units, source/product and version,
evidence type (observed, retrieved, modelled, derived, assumed, unavailable),
spatial support, timestamp or baseline period, vertical reference or soil depth,
quality flags and uncertainty where supplied. Missing values are not zero.

Suggested separate files per site:

- `environment.json`: static property metadata and source references.
- `weather-hourly.*`: underlying atmospheric time series.
- `seasonal-summary.json`: monthly/diurnal summaries and representative scenarios.
- `surface-units.geojson`: soil/rock/crust/ice zones with evidence references.
- Gridded albedo, thermal and terrain layers with their native resolution retained.

This is a proposed environmental extension, not a change to the existing
`terrain_profile.schema.json`. Renderer material colour/roughness should not be
confused with physical albedo or terrain roughness.

Landing suitability must later be computed against a specified vehicle: mass,
footprint and footpad dimensions, centre of gravity, touchdown velocities,
allowable tilt/loads, propulsion/plume parameters and equipment operating limits.
The environmental dataset alone cannot produce a universal safe-landing label.

## Sources checked

- [NASA POWER hourly API](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/)
- [POWER data sources and limitations](https://power.larc.nasa.gov/docs/faqs/data/)
- [NASA MODIS albedo product](https://data.nasa.gov/dataset/modis-terraaqua-brdf-albedo-albedo-daily-l3-global-500m-v061-7fe9d)
- [NASA ECOSTRESS surface temperature/emissivity](https://doi.org/10.5067/ECOSTRESS/ECO_L2T_LSTE.003)
- [SMAP enhanced moisture product guide](https://nsidc.org/sites/default/files/documents/user-guide/spl3smp_e-v006-userguide.pdf)
- [USDA SSURGO: supplementary soil source outside organizer list](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo)
- [USGS 3DEP: supplementary terrain source outside organizer list](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services)

Access check on 2026-11-14: a POWER request for Kilbourne Hole (31.972 N,
106.969 W), UTC 2025-01-01, returned 24 hourly records each for WS10M, WD10M,
T2M, RH2M and PS. This checks API accessibility only; it is not a seasonal
baseline or local wind validation. The subsequent implementation now supplies six seasonal profiles, regional
albedo/solar summaries and supplementary USDA survey records in `data/environment/`.
Local contact mechanics and the other unresolved inputs remain explicitly unknown.
