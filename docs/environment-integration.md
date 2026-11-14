# Seasonal simulation inputs: React and Node

Six offline profiles are committed under `data/environment/`: Kilbourne Hole,
Meteor Crater, Amboy Crater, Badwater Basin, White Sands, and Utqiaġvik / BEO.
The representative coordinates are explicit in `sites.json`. They are sampling
points for regional conditions, not surveyed landing locations or site boundaries.

The package contains a **2015–2024 seasonal baseline**: ten years of hourly NASA
POWER meteorology and monthly NASA POWER/CERES radiation, plus supplementary USDA
soil-survey map-unit information. It is not a formal 30-year climate normal.
No runtime NASA/USDA connection, account, or API key is needed by the application.

## Integrate in the web application

1. Export the committed data into the application's static directory:

   ```sh
   python scripts/environment/export_web.py
   # Default: app/sim/viewer/public/environment/
   # For a different application:
   python scripts/environment/export_web.py --output /path/to/frontend/public/environment
   ```

2. Import `app/lib/environment.mjs` in your client code. Matching TypeScript
   declarations live in `environment.d.mts`; the adapter has no external dependencies.

   ```js
   import {
     loadEnvironmentProfile,
     createSimulationInputs,
   } from './lib/environment.mjs'; // Adjust relative path to your source file.

   const profile = await loadEnvironmentProfile('/environment/', 'kilbourne_hole');
   const simulation = createSimulationInputs(profile, {
     month: 7,                  // 1..12; alternatively season: 'JJA'
     scenario: 'high_wind',      // 'typical' or 'high_wind'
   });

   const wind = simulation.weather.wind_vector_m_s;
   const airDensity = simulation.weather.air_density_kg_m3;
   const temperature = simulation.weather.air_temperature_k;
   const pressure = simulation.weather.pressure_pa;
   // Pass these to your atmosphere / aerodynamic / thermal model.
   // Wind is NOT a velocity to assign directly to the lander.
   ```

   In React, fetch within your existing client-side effect/data loader. Pass
   `{ signal: abortController.signal }` as the third loader argument and cancel on
   cleanup; catch errors in your UI. Serving the files does not create a renderer
   or physics engine. The existing simulator can consume these inputs via the adapter below.

3. Use `GET /environment/catalog.json` to populate the site selector. The IDs are:

   ```text
   kilbourne_hole  meteor_crater  amboy_crater
   badwater_basin  white_sands    utqiagvik_beo
   ```

## Node / server use

From the repository root, this works without a web server:

```js
import { readFile } from 'node:fs/promises';
import { createSimulationInputs } from './app/lib/environment.mjs';
const profile = JSON.parse(await readFile('data/environment/white_sands.json', 'utf8'));
const simulation = createSimulationInputs(profile, { season: 'MAM' });
console.log(simulation.weather, simulation.soilSurvey);
```

Alternatively `loadEnvironmentProfile` accepts an absolute HTTP base URL in Node
18+ (tested with Node 24). Select exactly one `month` or `season`. Seasons follow
Northern Hemisphere meteorological months: DJF, MAM, JJA, SON. DJF pools December,
January and February within the stated baseline; it is not a continuous winter
replay. Month/season switching selects a new scenario; it is not a temporal
interpolation or forecast.

## Connect to the current landing simulator

`app/lib/environment-site.ts` adapts these profiles to Tim's existing `SiteTerrain`
and `SimInput` contracts. It checks that the Earth terrain and environment IDs
match (including the existing `kilbourne-hole-v1` alias), preserves the heightmap,
and sets Earth/native gravity and atmosphere explicitly. It does not modify the
physics engine or automatically apply Earth weather to planetary terrain.

```ts
import { createEarthLandingInput } from './lib/environment-site.ts';
import { runSim } from './sim/src/index.ts';
// `terrain` comes from terrainPackToSite() or profileToSite().
const { input, environment } = createEarthLandingInput(
  terrain, profile, { month: 7, scenario: 'high_wind' },
  { gridNorthBearingDeg: -1.042894636235898 }, // Kilbourne EPSG:32613 only
);
const telemetry = runSim(input);
// Or: lander.launch(input) through the existing React useLanderSim hook.
```

Supply the clockwise bearing of grid north from true north for each terrain.
The Kilbourne value above was calculated using PROJ EPSG:32613 at its recorded
centre. True east/north-aligned terrain uses zero. The adapter rotates wind into
**the simulator's X-east, Y-north, Z-up frame**, rather than reusing the preview's
Y-up vector. `useRegionalAlbedo: true` explicitly copies the coarse albedo to the
site; the default preserves any existing local albedo.

Run the complete real-terrain/data example:

```sh
cd app/sim
npm ci
npx tsx ../../scripts/environment/run_landing.ts
npm test
npm run typecheck
```

The default lunar-class vehicle can fail under Earth gravity; this is expected
and is not corrected by secretly adjusting weather or thrust. The current engine
consumes wind and air density, and carries soil/albedo metadata. It does **not**
yet simulate bearing failure, thermal balance or precipitation impacts. Those
inputs are exposed for the equipment/physics team's future models. Only Kilbourne
currently has a real terrain pack in this handoff; the other five environmental
profiles require their corresponding terrain before running site-specific landings.
The viewer's existing presets are unchanged; selectors can call this adapter.

## Units and coordinate contract

- Air temperature: **K**; pressure: **Pa**; density: **kg/m³**.
- Wind: **m/s** at **10 m reference height**. Meteorological direction specifies
  where it comes **from**, clockwise from true north.
- Vector axes: **+X east, +Y up, +Z south**. North wind points along +Z.
  These are geographic directions. If a terrain uses UTM grid axes, account for
  meridian convergence when precision matters; the axis names alone do not apply
  that rotation. The existing Kilbourne mesh uses UTM grid axes.
- Precipitation: **mm/hour**, source corrected precipitation rate.
- Relative humidity: **%**, 0–100.
- Albedo: dimensionless **0–1**, all-sky regional reflectivity.
- Solar context: mean **W/m² across a full day**, converted from kWh/m²/day.
  It is not peak/noon or instantaneous irradiance.
- Soil depths: **cm**; texture fractions: **%**; bulk density: **kg/m³**.

`radiationContext` is deliberately separate from `weather`. It contains statistics
of monthly means, equally weighted across the selected months/years. It must not
be treated as coincident radiation for the selected scenario hour. To simulate
instantaneous heating or solar power, obtain an hourly radiation record and solar
geometry, terrain shading and appropriate surface albedo.

## What is actual data, and what is unknown?

Each month/season includes means, standard deviations, 5th/50th/95th percentiles,
min/max, counts and coverage for weather variables. `diurnal` gives approximate
local-mean-solar-time bins; it is not local civil time. Source URLs, response
hashes, parameter units and API/source headers accompany every profile.

- Weather comes from regional models/assimilation. It does not resolve wind
  circulation within a crater, wind at footpad height, turbulence or gusts.
- `typical` selects the complete hour closest to the median wind speed,
  temperature, pressure and humidity after standard-deviation scaling.
- `high_wind` selects a complete modelled hour nearest the period's 95th-percentile
  hourly wind. All weather fields stay together from that hour. It is **not a
  gust, design extreme, forecast or worst-case landing condition**.
- Air density is derived with an ideal moist-air approximation and a Tetens
  saturation formula over water. It is not independently measured, and the
  approximation has limits in extreme cold.
- Albedo is from a **regional 1-degree CERES product**, not MODIS 500 m or a local
  soil measurement. White Sands and Badwater can be heavily mixed with surrounding
  land. This is background context; local material albedo remains unavailable.
- USDA records retain the survey-area identifiers, map units, component shares
  and individual horizons. They may be generalized surveys. A component is not
  guaranteed to occur at the exact point, and the selected point does not
  characterize a whole crater. A horizon intersecting the upper 30 cm is reported
  with its full depth interval, not falsely relabelled as a 0–30 cm average.
- Literature material descriptions are qualitative site context. Salt crust,
  cinders, exposed rock, snow and soils cannot be reduced to one uniform material.

Ground contact parameters remain null by default, even where survey bulk-density
estimates exist. The team must choose a surface unit and justify assigning a
specific engineering material. Overrides require explicit evidence and a source:

```js
const simulation = createSimulationInputs(profile, {
  month: 7,
  materialOverrides: {
    // Example only; this number is NOT a measurement at any of the six sites.
    contact_friction: {
      value: 0.5,
      evidence: 'assumed',
      source: 'Prototype sensitivity experiment, not field data',
    },
  },
});
```

`missingGroundParameters` lists unknown values. Call
`requireGroundParameters(simulation, ['bearing_capacity_pa', 'contact_friction'])`
when an operation requires them; it throws rather than silently converting
unknowns to zero. No safe-landing label is computed without vehicle geometry,
loading and touchdown limits. The package does not yet supply gusts, local
obstacles, snow depth, soil moisture, local albedo, surface temperature, thermal
conductivity, specific heat or plume-driven dust erosion parameters.

## Refresh and validate

```sh
python -m pip install numpy
python scripts/environment/build_profiles.py
python scripts/environment/export_web.py
# Development environment with repository test dependencies:
python -m pytest -q
node --test tests/environment.test.mjs
```

Raw API responses are gzip-cached in ignored `data/raw/environment/`. Three sites
are fetched concurrently, with one request at a time per site and bounded retry
for transient NASA errors. The first run fetches 60 site-years of hourly weather,
six radiation series and six soil queries. Later builds reuse the cache. Remove a
specific cached response to refresh it; the response hashes will change if source
providers revise their data. `--start-year`/`--end-year` select other complete-year
baselines. `--site ID` rebuilds one profile without updating the catalog; run an
all-site build before exporting, so catalog hashes remain consistent.

`profile.schema.json` specifies the data format; `catalog.json` records file hashes.
The exporter checks hashes before copying. Generated public copies are ignored by
Git; re-export after updating the source data. Static JSON files are the handoff
format, independent of the existing terrain raster schema.

## Sources

- [NASA POWER hourly API](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/)
- [NASA POWER data sources](https://power.larc.nasa.gov/docs/faqs/data/)
- [NASA regional albedo definition](https://gis.earthdata.nasa.gov/portal/home/item.html?id=f85d4fc5eb0740ac8cffb3803e7b0d7a)
- [USDA SSURGO](https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo)
- [USDA Soil Data Access](https://sdmdataaccess.sc.egov.usda.gov/)

NASA POWER is a convenient access service for NASA data; USDA is a supplementary
soil source outside the organizer list. Keep source references and evidence labels
in the application data credits and inspection UI.
