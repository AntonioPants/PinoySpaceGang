# Comparison validity audit

The game now exposes **Comparison validity & ranking stability** inside Terrain
information. It loads one target audit on demand (about 170 kB), keeping the map
and bottom controls as before. All 49 targets × 102 Earth candidates are audited.
Scores and production recommendations retain Antonio's existing method.

## What is measured

`scripts/catalog/validity.py` checks source-grid hashes and compares every Earth
candidate under the same perturbation. Published order retains literature priority;
pure-score rank is shown alongside it. Each axis is varied separately:

- 25 combinations of the existing five ±250 m/centre windows on the two surfaces;
- landform weight 25%, 50%, 75%, with the remainder assigned to terrain;
- native and twice-native planetary analysis spacing over the same central area.
  The scale diagnostic uses only features resolved at both spacings, with the same
  frozen normalizers. It cannot introduce fine-scale information or be interpreted
  as the production score. Actual windows are the largest whole-cell square ≤4 km.

Ranges report ranks, available scenarios and top-ten counts. Missing results stay
missing and remain in the requested-run denominator. These are deterministic
sensitivity scenarios, not confidence intervals, error bars or accuracy estimates.
The interface flags candidates that cross the top-ten boundary in these scenarios.

Closest and most different descriptors are ordered by absolute difference divided
by the frozen feature spread, with values and units for both surfaces. Landform and
substrate labels remain interpretations. Neither matching labels nor terrain
similarity measures soil strength. Landing behaviour remains a separate physics
experiment with prototype equipment, not a validated hardware prediction.

## External validation

`data/validation-references.json` is a separate reference register, never an input
to production fitting or ranking. It records NASA/JPL Salda–Jezero carbonate evidence,
the published Río Tinto–Meridiani mineral/process analogy, and an Istok–Svalbard
gully reference. Evidence dimensions, source review, counterevidence, footprint
limitations and project review are explicit. Publication peer review does not
establish independent project review, statistical independence or terrain truth.

`data/validation-protocol.json` freezes the scoring/descriptor/scale hashes, the
full development catalog (all 151 sites, including targets without pairing labels),
candidate-pool rule, 4 km window, tie handling, 100 km regional exclusions on each
body and the metric before the new reference terrain is evaluated. Changed scoring
code fails the freeze check. The exclusion gate also checks reference-feature scale,
terrain-shape ground truth, review and missing packs. Unlabelled Earth sites are
never declared negatives. No reference currently qualifies; accuracy remains null.

`scripts.catalog.validation_terrain` acquires new measured MOLA and Copernicus
packs at Istok (45.11° S, 85.8° W) and the explicitly published Hanaskogdalen fan
(78.285° N, 15.758° E). These are retained under `validation-terrain`, excluded
from the player catalog and scale fitting. `scripts.catalog.external_validation`
evaluates the new Earth pack in the same pool of 103 candidates (102 catalog plus
the reserved Earth pack), without literature priority. It ranks **8/103**. This is
an exploratory regional-descriptor stress test: the reference gullies are unresolved
at 500 m, the footprint transfer requires review, and the literature supplies no
regional terrain ranking ground truth. None of those exclusions is waived by a hit.
The UI displays both the result and its exclusions. A future eligible-reference
summary requires at least five independent planetary regions; the single pilot
does not support an aggregate performance estimate.

This pilot has now been consumed. Do not tune against it and continue calling it a
fresh holdout. Reserve new confirmation regions for future rule/weight changes.
Independent scientific review remains pending; the user requested proceeding with
published evidence while no reviewer is available.

## Terrain upgrade pilots

`data/terrain-upgrade-pilots.json` records four concrete source candidates.
`scripts/catalog/terrain_pilots.py` screens their bounding boxes against a 4.5 km
window including the shift margin, checks quality/error-review prerequisites, and
writes `web/public/terrain-upgrade-status.json`.

Actual raster acquisition rejected the Jezero crop: only 98.007% of the required
4.53 km square has finite pixels, with southwest-edge gaps. Its bounding box had
passed. The checked Marius NAC mosaic is east of the selected point and fails even
the bounding-box screen. Neither site is moved and no gaps are filled.

Two full-coverage measured stereo subsets are now staged and usable as optional
cyan-surface previews: **Phoenix (HiRISE)** and **Apollo 16 (LROC NAC)**. Both cover a
4.53 km square at unchanged catalog coordinates, area-averaged to north-first 30 m
metre grids. Raw reprojectable subsets, PDS labels, LROC readme and receipts are
retained in `data/cache/catalog/terrain-pilots`; compact public packs include hashes,
CRS, source posting, scale/offset and missing-error/quality warnings. The attached
HiRISE label specifies Mars 2000 equipotential metre elevations. The LROC v1.9 PDS
label gives the full 2010–2011 acquisition interval, superseding the website's
shortened date display. Posting is not effective resolution or accuracy.

`scripts.catalog.ingest_pilot` rejects partially valid output cells by warping a
separate binary validity raster; GDAL's nodata-ignoring average alone is insufficient.
It never fills missing data. LROC confidence is read from the **raw PDS IMG**, not
the browse TIFF, which stretches the class codes. The selected Apollo 16 crop has
94.28% successful-correlation/manually-edited support on average; its lowest 30 m
cell has 29.95%, so suspicious areas remain a warning. Published relative vertical
precision is 0.88 m; the separate LOLA tie RMS is 1.02 m. Phoenix lacks a confidence
raster in the checked listing and a product-specific vertical-error estimate.
These are experimental previews, not approved replacements.

`scripts.catalog.pilot_comparison` recomputes every Earth candidate with identical
4 km windows, analysis spacing, frozen descriptors/normalizers and weights before
and after changing only the planetary DEM. Phoenix is compared at 500 m, Apollo 16
at 150 m. Top-ten overlap is 9/10 and 10/10 respectively; 43 and 88 score ranks
change. Finer 30 m descriptors are shown separately and are not substituted into
coarse calibrated scores. These results measure source sensitivity, not improved
accuracy. Production rankings, Earth grids and physics remain unchanged.

The panel offers **Preview measured stereo terrain / Use catalog comparison terrain**.
The permanent comparison button identifies stereo-preview mode. Target identity,
baseline hash and preview bytes are checked before rendering; an unavailable or
changed pack reports failure. Existing comparison on/off, map interaction and Back
continue to work. Independent artifact/geological review is required before promotion.

Primary references:

- [NASA/JPL Lake Salda](https://www.jpl.nasa.gov/images/pia24375-lake-salda-beach/)
- [USGS HiRISE archive and processing](https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/)
- [LROC Marius product metadata](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_MARIUS)
- [LROC coverage and error definitions](https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_NAC_DTMS)
- [Phoenix HiRISE product](https://www.uahirise.org/dtm/dtm.php?ID=PSP_008591_2485)
- [Apollo 16 product and error metadata](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO16)
- [Istok study](https://doi.org/10.1016/j.icarus.2014.03.005)
- [Hanaskogdalen coordinates and recurrence limitations](https://www.hou.usra.edu/meetings/lpsc2017/pdf/1132.pdf)
- [CO2-driven flow experiments: similar morphology need not imply flowing water](https://doi.org/10.1029/2024JE008319)

## Regeneration and checks

Use the project's scientific Python dependencies plus pytest:

```sh
python -m scripts.catalog.validity
python -m scripts.catalog.terrain_pilots
python -m scripts.catalog.ingest_pilot phoenix --offline
python -m scripts.catalog.ingest_pilot apollo-16-descartes --offline
python -m scripts.catalog.pilot_comparison
python -m scripts.catalog.validation_terrain --offline
python -m scripts.catalog.external_validation
python -m scripts.catalog.validity --check
python -m scripts.catalog.terrain_pilots --check
python -m scripts.catalog.pilot_comparison --check
python -m scripts.catalog.external_validation --check
python -m pytest tests/test_validity.py
```

Then run the normal web build/tests and catalog consumer check. The consumer check
binds the artifact to catalog, scale and reference hashes; web tests compare every
published score/rank and exercise stale-input rejection. The UI also refuses to
show rows whose source hashes or current score differ. Regenerate after catalog,
scale, reference or method changes. Generated JSON has no build timestamp, allowing
reproducible diffs. These changes improve traceability and expose uncertainty;
they do not yet demonstrate an improvement in scientific retrieval performance.

Omit `--offline` for initial acquisition on another checkout. Public reference source
windows are retained for offline evaluation; large stereo source windows stay in the
ignored cache and can be reacquired from explicit public URLs. Do not alter the
frozen protocol or scores merely to make a reference pass.

Verification on 15 November 2026: TypeScript and production Vite build passed;
372 web tests and 144 Python tests passed. The changed audit guards also passed
their targeted checks after the final input-binding changes. Catalog consumer and
all report `--check` commands passed; both stereo packs reproduced from cached
sources. Browser checks covered Phoenix and Apollo 16 selection, source switching,
closing/reopening information, restoring catalog terrain, Back and landing-flag placement.
At 390 × 844 the permanent controls fit without horizontal overflow or overlap.
This verifies the game implementation, not scientific or landing accuracy.
