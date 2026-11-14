# Pairing accuracy and evidence checks, version 1.0.0

The audit checks all 14 proposed Earth–Moon/Mars pairs against the committed
elevation samples. It does not supply a scientific accuracy percentage: no
independent matched-landform ground truth or footprint-specific DEM error model
is available. It does not rank landing safety or verify geological equivalence.

`scripts/catalog/accuracy.py` is invoked by full builds, registration and metadata
refresh. Each production pairing contains `accuracy_check`, exposed in the shared
catalog details in the viewer and mission UI. The validator recomputes the audit
and rejects missing or stale results. Existing terrain scores and pairings remain
unchanged; this is an additive evidence audit, not a recalibration of scoring v1.

## What is computed

- Verify elevation bytes against the recorded SHA-256 and read north-first,
  west-first metre samples. Do not compare absolute elevations across datums.
- Independently regenerate slope mean, local RMS height and relief on centred
  4 km squares averaged to 1 km cells. Check that the catalog descriptors reproduce.
- Apply the existing fixed scoring scales: 15 degrees for slope, 150 m for RMS,
  1000 m for relief, with weights 0.4, 0.4, 0.2. Each contribution is
  `weight * (1 - min(abs(Earth - planet)/scale, 1))`. All three features are required.
- Move the window independently on each body by 250 m east, west, north or south,
  plus the original centre. Report min/max of the 25 pair combinations. A range
  greater than 0.10 flags sensitivity; this is an explicit engineering heuristic,
  not statistical uncertainty or a confidence interval. Shifts below native
  postings test interpolation/window choice, not new independent observations.
- Leave scores null when support, native-posting metadata or measurements are
  insufficient. A 4 km window contains only 16 analysis cells and four fully
  supported 3 km roughness windows. RMS includes regional slope; no detrending is
  performed. Both source and output postings must be no coarser than 1 km.

See [computed results and pair-specific limitations](PAIRING_RESULTS.md).

## Scientific limits and next validation

Copernicus is a surface model that can include vegetation and structures, not a
universal bare-earth terrain survey. [Official product documentation](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM).
MOLA's approximately 463 m gridded postings do not resolve dune slipfaces, cave
openings or narrow yardangs. [USGS MOLA product](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m).
LOLA gridded products aggregate altimeter observations; grid spacing is distinct
from full-resolution measurement support. [PDS LOLA FAQ](https://pds-geosciences.wustl.edu/missions/lro/lola_faq.htm).
Equal 1 km analysis spacing does not remove these sensor and interpolation differences.

Matching category labels cannot establish formation process or mechanics:
Kilbourne is a maar whereas Shackleton is an impact crater; White Sands gypsum
is not Bagnold basaltic sand. Existing sourced pairing explanations remain the
authority for those distinctions. Environmental comparisons remain unscored:
annual Earth reanalysis, lunar cumulative thermal bins and unknown Mars weather
are not equivalent measurements. Lunar atmospheric wind is inapplicable.

Before claiming validated accuracy, select corresponding landforms and footprints,
obtain higher-resolution terrain where needed, validate against independent
control, propagate measured uncertainty, and compare compatible geological and
environmental products. Global product accuracy specifications must not be
reported as local uncertainty estimates. Similar-looking smooth regional grids
can receive high terrain scores while representing very different processes.

```sh
python -m scripts.catalog.refresh_metadata
python -m scripts.catalog.accuracy
python -m scripts.catalog.validate
python -m pytest -q
```

No new raster downloads are needed for this audit. Sources and exact input hashes
are embedded in every pair result; adding a site does not change existing pairs'
normalization. A new proposed pairing still needs a sourced handoff explanation.
