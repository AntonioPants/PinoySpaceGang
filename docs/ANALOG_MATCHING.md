# Current selection policy (2.1.0)

The default opening and planner show ten eligible Earth candidates per target, with no minimum score cutoff. Research-backed proposals retain priority, followed by descending analog score within each tier. Explore all lists all available grounds (currently 102). Scores, inferred-label discounts and frozen scales are unchanged. Missing/corrupt terrain is still excluded; never pad with invented records. Earlier cutoff descriptions below are historical. Display names omit study area; IDs and science provenance remain intact.

# Evidence-gated Earth/planetary matching (2.0.0)

## Analog score (2.0.0, live ranking)

Candidates are ranked by the **analog score**, shown in the app as "Match":

`analog score = 50% landform-family agreement + 50% terrain similarity`

- **Landform-family agreement** (`scripts/catalog/analog_score.py`): the interpreted
  catalog landform of each site is mapped to a family (volcanic, crater, aeolian,
  sedimentary, desert, periglacial, massif). Same family scores 100, a related family
  50 (crater/volcanic, sedimentary/desert, massif/crater), anything else or an unknown
  label 0. It is a weighted term, never a filter: a different or unknown landform
  keeps its terrain half and can reach at most 50.
- **Terrain similarity**: `100 * exp(-mean scaled difference / 2)` over the
  `terrain_features` descriptors (slope distribution, multi-scale roughness, relief,
  bowl/ridge shares, hypsometry). Both grids are area-averaged to the planetary pack
  spacing (150 m Moon, 500 m Mars) over the same central 4 km window. Each feature
  difference is divided by that feature's robust spread across the Earth catalog,
  frozen in `data/terrain-scales.json` so adding sites does not move existing scores.
  Refreeze deliberately with `python -m scripts.catalog.analog_score --fit`.
- **Ranking**: literature-informed proposals first, then descending analog score,
  then site ID. Exploratory candidates need an analog score of at least 70%
  (`MIN_EXPLORATORY_SCORE_PERCENT`); an unrelated family tops out at 50, a
  same-family site needs a terrain match of at least 40 and a related-family site at least 90.
  Literature-informed proposals are always kept. Targets can have fewer than ten.
- **Stability check**: the terrain similarity of the 25 shifted-window combinations
  is published as `verification.terrain_range_percent`; a span above 10 points is
  flagged `sensitive`. It does not affect rank.

### Scanned windows (exploratory discovery)

`python -m scripts.catalog.scan_matches` scores every window in `data/earth_index`
against every target with the same analog score and writes
`data/earth_index/matches.json`. It does not change `web/public`.

- A scanned window has no reviewed landform. It borrows the landforms of its scan
  region's seed catalog sites (`inferred_landforms`), scored at 75% of a reviewed
  label (`INFERRED_FACTOR`). A same-family inferred window therefore needs a terrain
  similarity of at least 65 to reach the 70% cutoff; a related family cannot pass.
- Crater labels are never inferred: ground near a seed crater is not a crater.
- A reviewed `morphology` always takes precedence over inferred labels.
- Shortlist per target: best ten at or above the cutoff, centres at least 4.8 km
  apart, excluding windows within 4.8 km of an existing catalog Earth site.
- Shortlisted windows remain `exploratory_terrain_only`. To become selectable, a
  window must be staged as a terrain pack and registered with
  `inferred_landforms`; `matching.py` then scores it by these same rules.

Why: on the benchmark below, terrain shape alone ranks the catalog's reference
analogs no better than chance, because analogs are proposed by landform process.

| Method (pure score order, 59 reference pairs) | AUC | Recall@10 | Mean rank of 50 |
|---|---:|---:|---:|
| 1.x fixed-scale terrain, 1 km cells | 0.416 | 0.153 | 28.4 |
| Multi-feature terrain alone | 0.500 | 0.186 | 25.2 |
| Analog score (live) | 0.917 | 0.780 | 9.1 |

Limits, stated plainly: the reference pairings were themselves proposed by landform,
so the gain from the landform term is partly circular; the family table and the
50/50 weight were chosen on this same small set and are not cross-validated; among
sites of the same family the terrain half orders reference analogs first 83% of the
time (72 comparisons), against 61% for the 1.x score. Landform labels are catalog
interpretations. A planetary point without a landform label scores on terrain only.
None of this is validated scientific accuracy. The 1.x three-feature audit below is
still computed, but only to verify source hashes and descriptor reproduction.
Sections below that describe the fixed-scale score as the displayed percentage or
the rank input describe 1.x behaviour.

## Retrieval benchmark baseline (2026-11-14)

`python -m scripts.catalog.benchmark` writes `data/matching-benchmark.json`.
It ranks all 50 Earth sites by terrain score alone, without the research-tier boost
or exploratory cutoff. Stable IDs break ties. The 59 catalog proposals across seven
labeled targets are weak evaluation labels; unlisted pairs are **unlabeled**, not
verified negative examples. The two targets without proposals have null metrics.
This measures agreement with our catalog, not independent scientific accuracy.

Baseline: macro recall@10 **0.155442**, micro recall@10 **0.152542**, mean known
rank **28.440678**, mean score gap **-17.742513 percentage points**. The gap is the
mean known score minus the best unlabeled score, averaged over labeled targets.
Missing known measurements count as rank 51 instead of disappearing. The frozen
baseline is `data/matching-benchmark-baseline.json`; later experiments must retain
this evaluation population for comparable before/after results.

Claude's parallel prototype and AUC measurements are preserved in
`data/matching-benchmark-claude-prototype.json`. Its mean rank was 26.08, with
micro recall about 0.1526 (rounded per-target values); it was not the live matcher.
The reconciled benchmark retains AUC, adds the required signed score gap and null
unlabeled-target results, and penalizes unscorable known pairs. The weighted gap
is -20.485710 pp; the earlier -17.742513 pp is the unweighted target mean.

### Step 2: richer descriptor extraction

`python -m scripts.catalog.terrain_features` produces an offline artifact with
source hashes, product URLs, licences, coverage and five shifted samples per site.
No ranking changed at this step: before/after macro recall 0.155442, micro recall
0.152542 and mean rank 28.440678 are identical.

Features include slope mean and p90 (degrees); area fractions above 5/10/15/20
degrees; local RMS height (metres) at requested 150/450/1000 m supports; standardized
TPI bowl/ridge fractions below -0.5 / above +0.5; and hypsometric integral
`(mean-min)/(max-min)` (flat surfaces use 0.5). Neighbourhood widths round upward
to an odd number of cells and are recorded explicitly. Unresolved scales are null,
never invented by interpolation. Neighbourhood summaries exclude edge cells.
Additional fine/mid/coarse roughness removes one best-fit plane and uses 3/5/7-cell
local RMS; actual metre supports are stored. Roughness is not a soil parameter.
Global plane removal preserves the separately measured slope distribution.

The simplified screen keeps both location records visible: coordinates, region,
landform, material, atmosphere and available sourced conditions. It shows up to
ten selectable Earth candidates and hides the accuracy-audit breakdown. Overall match and Terrain match are
the only match summary fields; unknown overall values remain Not verified.

The catalog screens every Earth site against every planetary target: currently
15 × 9 = 135 potential comparisons. `analog_matching` is generated from source grids and
condition records; it does not add unsupported scientific pairings to `pairings`.
The mission UI shows the first ten available candidates in pipeline rank order,
with Overall match and Terrain match. The first is selected initially; selecting
another updates the map, conditions, terrain and mission inputs. The choice is
saved with the target in the browser draft and restored only if still eligible.
Changing targets defaults to the new target's first candidate. Fewer than ten
eligible records produces a shorter list, never invented locations. The selected
comparisons and all screening decisions remain in the catalog; environmental breakdowns and
evidence-coverage fields are not shown in this summary. A missing
total is labelled Not verified, never replaced by the terrain percentage. Names, values and proposed pairings come
from the shared catalog; the list is not a worldwide search for the closest analog.

## Filter, compare, top ten

1. Reject missing packs, incompatible feature units/scales, unsupported orientation,
   source/output sampling coarser than 1 km, or windows too small for the shift test.
2. Read and hash each eligible source grid once for this matching stage; derive its
   five window descriptors once, shared by all pairs. Reject stale descriptors.
3. Compute the central-window analog score for every eligible pair. This is the
   displayed match and the rank score. Exploratory pairs below 70% stop here.
4. Visit candidates in evidence-tier/score order. Skip detailed pair testing
   only when the score cannot enter the current top ten. Otherwise run/reuse the
   25-combination audit (a stability check) and retain the best ten with `heapq.nsmallest`.
5. Publish up to ten detailed records per target, plus `selection.screening`
   with the reason each potential pair was evaluated, filtered or pruned. Ranks use
   evidence-tier/analog-score/site-ID order.

Exploratory candidates need an analog score of at least 70%; this is a
team-chosen engineering threshold, not a validated accuracy boundary.
Literature-informed proposals are exempt, so a documented process analog is never
dropped for its score. Landform family is a weighted score term; there is no hard
morphology/material equality filter. Missing environmental data is not a terrain exclusion criterion.
The bounded selection has the same top-ten outcome as an exhaustive evaluation
under this method, including ties. `attach_matching(..., exhaustive=True)` disables
score-bound pruning for regression tests; it still returns only the top ten.

On the expanded catalog, 135 pairs pass the metadata filter, 110 detailed pair
audits are used (including 20 existing proposal audits), and 25 are safely pruned.
The mathematical terrain score (1.0.0) is unchanged; selection/output is
2.0.0 (1.1.0 ranked by the minimum window score and had no cutoff; 1.2.0 ranked by
the fixed-scale terrain score with an 80% cutoff; the pair counts above predate both). Automated tests compare the complete selected rows against exhaustive output
and verify that stale descriptors cannot prune candidates. Detailed counts depend
on the catalog. Reduced work is not a guarantee of a large wall-clock improvement;
source sampling and verification still take time. Results remain precomputed for
the browser. The build and validator each share one per-site sampling pass between
proposal audits and shortlist generation, avoiding duplicate raster work. This
cache lives only within one build/validation of the staged directory, so it cannot
silently survive a terrain change. No scientific accuracy or environmental validity is inferred.

## Verification and percentages

The 1.x terrain algorithm, now used only for the reproduction audit, is a fixed-scale weighted absolute-distance similarity:

`100 * sum(weight * max(0, 1 - abs(earth_value - planetary_value) / scale))`

| Feature | Weight | Difference giving zero contribution |
|---|---:|---:|
| Mean slope | 40% | 15 degrees |
| RMS height roughness | 40% | 150 m |
| Relief (maximum minus minimum elevation) | 20% | 1,000 m |

All three compatible features are required. Each surface is area-averaged into
1 km cells over a 4 km square; roughness uses 3 km neighbourhoods. This deliberately
compares regional terrain, not boulders, dune slipfaces or complete landform geometry.
The weights and scales are engineering choices, not fitted accuracy estimates.
Five window positions (centre and 250 m in each cardinal direction) per surface
yield 25 pair comparisons. The displayed terrain percentage and its published
sensitivity range now come from the 2.0.0 terrain similarity described at the top.

All committed source-grid hashes and terrain descriptor reproduction are checked.
This is verification of implementation and inputs, not independent validation of
Earth–planetary equivalence. There is no ground-truth accuracy percentage, so
`validated_accuracy_percent` remains null and `scientifically_validated` is false.

- **Terrain similarity:** existing fixed-scale regional score × 100; 1 km analysis
  cells, 4 km window, 3 km roughness support. Window-shift ranges are sensitivity
  checks, not confidence intervals. See PAIRING_ACCURACY.md.
- **Environmental similarity:** equal-weight wind at 10 m, air temperature at 2 m,
  surface temperature, and broadband albedo. Each compatible feature uses
  `100 * max(0, 1 - abs(Earth - planet)/scale)` with fixed scales respectively
  10 m/s, 100 K, 100 K and 0.5 albedo. These scales and weights are explicitly
  engineering assumptions, not scientifically calibrated accuracy tolerances.
- **Total terrain + climate similarity:** 50% terrain + 50% environment, only
  when every required feature is compatible and available. It excludes geological
  equivalence, resources, contact mechanics, gravity and landing safety. It must
  never be presented as total planetary realism or scientific accuracy.
- **Evidence coverage:** 50% for verified terrain, 12.5% for each comparable
  environmental feature. Missing terms are not renormalized. This percentage
  measures availability within this model, not truth, accuracy or general completeness.

All current selected combinations have terrain evidence but insufficient compatible
environmental evidence. Accordingly terrain percentages are populated, model
coverage is 50%, and environmental and total percentages are null. This is a
deliberate scientific limitation, not a zero score or a pending cosmetic change.

Exploratory candidates are listed only when their analog score is at least 70%
(`MIN_EXPLORATORY_SCORE_PERCENT` in `scripts/catalog/matching.py`); those below
are recorded as filtered with a reason.
Literature-informed proposals are always kept, whatever their score.

Candidates with existing sourced comparison proposals come first. Within each
tier, the analog score orders the candidates;
site ID breaks ties. Exploratory candidates remain explicitly unreviewed. Do not
displace a meaningful process analog with unrelated flat terrain merely because
both coarse grids look smooth. Ranks reflect available candidates and are not
environmental-accuracy rankings; fixed score normalization does not depend on the
number of sites.

## Compatibility gate

Finite measured, derived or modeled quantities need source URL, method, coverage
and compatible units (Celsius converts to kelvin). Assumed parameters are excluded.
Each quantity also needs a sourced `comparison_contract` explicitly reviewing:

```json
{
  "quantity_definition": "specific physical quantity and spectral definition",
  "statistic": "specific summary statistic",
  "temporal_basis": "reviewed comparable seasonal/diurnal coverage",
  "spatial_support": "reviewed comparable footprint and resolution",
  "reference_height_m": null,
  "review_source_url": "https://source-supporting-the-compatibility-review"
}
```

The fields must match across the pair; null height is appropriate only for a
surface/spectral quantity. Providing a contract is a scientific review task, not
a way to bypass missing data. Current products have not been given artificial
contracts. A contract permits an engineering score, not the independent validation
flag. Unknowns and physically inapplicable quantities remain distinct.

## Why the environment is not verified yet

NASA documents that the lunar exosphere does not support Earth-like weather:
[lunar weather](https://science.nasa.gov/moon/weather-on-the-moon/).
Mars has a thin, predominantly carbon-dioxide atmosphere:
[Mars facts](https://science.nasa.gov/mars/facts/).
These are body-level context, not footprint measurements or scalar similarity scores.

Earth annual regional reanalysis and lunar cumulative bolometric brightness bins
have different definitions and temporal support. Mars site environmental series
are not ingested. Global planetary temperature ranges must not be substituted for
site observations. Diviner values remain available in a separate lunar context
section, not silently treated as Earth annual ground or air temperature.

To establish useful environmental percentages, acquire and QA footprint-specific
planetary thermal/albedo products and available atmospheric measurements; align
definitions, seasons/local times, vertical heights and spatial support with Earth
products; document uncertainties and review the compatibility contracts. Validate
the method against independent reference pairs and predefined use cases before
claiming scientific accuracy. Lunar wind/air-temperature equivalence is physically
inapplicable; lunar evaluation may eventually need a separately reviewed
vacuum/thermal task model, not this terrestrial-climate score with terms dropped.

## Rebuild and validation

```sh
python -m scripts.catalog.refresh_metadata
python -m scripts.catalog.validate
python -m pytest -q
cd web
npm test
npm run build
```

Full and single-site build/registration paths regenerate the matrix. Validation
recomputes it and rejects stale results. No new science datasets were ingested for
this change; all values reference the existing source-backed catalog.

## Game evidence and landing baseline

`catalog.analogScoreFor` reads the detailed modern analog score, or the all-pair central screening score outside the published ten. The full atlas sorts by this score; the ten retain published evidence-tier rank. Legacy terrain fallback is explicitly labelled. Percentages are engineering similarity, not validated accuracy.

`app/sim/scripts/landing-similarity.ts` stages the deterministic baseline; `python -m scripts.catalog.findings --publish` publishes it and the generated findings through the existing transaction (stop dev servers first). Baselines cover proposed pairs, all published ten, and each target's best scanned window. They use 25 trials per patch and an explicit fixed configuration; scores do not alter analog rankings. Runtime verifies the catalog checksum. Only an exact default scenario without gear/weather/interference overrides can reuse baseline stress results; other missions run live. See SUBMISSION.md for assumptions and limits.

## Click anywhere: on-demand ranking for a pinned point (click 1.1.0, 15 November 2026)

A player can pin any point on the Moon or Mars and get a ranked list of Earth sites. This is a
separate, weaker class of evidence than the curated pairings above and every screen says so.

What it is. The matching service (`supabase/functions/match-analog`, see `supabase/README.md`)
snaps the point to 0.01 degrees, reads the same 33 x 33 azimuthal-equidistant window the pack
builder makes (150 m cells on the Moon, 500 m on Mars) from the USGS global mosaics by HTTP
range requests, and scores its central 4 km against every Earth site with the published
descriptors (2.0.0) and analog score (1.0.0). The planetary side is a TypeScript port
(`supabase/functions/_shared/analog/`); the Earth side is not ported: its vectors are exported
by `scripts/catalog/export_click_vectors.py`, which first recomputes every published comparison
and refuses to write if any differs at 2 decimals.

Parity. Descriptors from the 9 committed planetary packs match Python to 7.6e-14 relative; all
90 published comparisons and all 918 screening scores are reproduced at 2 decimals. Windows
fetched for the 9 curated targets differ from the committed packs by 0.002 to 0.86 m RMS and
move the analog score by at most 0.22 points (gates: 2 m, 1.0 point).

Landform. From the USGS global geologic maps (Mars: SIM 3292, 1:20M; Moon: Unified Geologic Map
of the Moon, 1:5M, 2020), translated to this document's families by
`supabase/functions/_shared/analog/unit-families.json`. That table has been reviewed by nobody:
it maps only units whose description clearly supports a family (29 of 44 Mars units and 24 of
49 lunar units are left unmapped) and its label is discounted to 75%, the factor unreviewed
inferred labels get. A mapped crater unit includes ejecta and floor. With no family the ranking
is terrain-only: the game shows the terrain percentage and "landform unmapped", never the halved
analog score. Jezero (unit HNt) and Marius Hills (unit EIp) are unmapped by this table.

What it is not. Not reviewed, not validated, not a proposed pairing. No window-sensitivity range
is computed. It describes the 4 km window at the snapped point, not the feature seen from
orbit. It does not apply the screening and verification flags of the published top ten, so a
pin beside a curated region will not reproduce that region's list. Moon scores (15 features at
150 m) and Mars scores (12 features at 500 m) are not on one scale. Missing elevation data is an
error, never filled. An Earth site missing a frozen feature is excluded and counted. Earth
cannot reproduce the target's gravity, atmosphere or radiation.

Sources: USGS Astrogeology MGS MOLA 463 m and LRO LOLA 118 m global DEM mosaics; Tanaka et al.
(2014) USGS SIM 3292; Fortezzo et al. (2020) Unified Geologic Map of the Moon; IAU Gazetteer of
Planetary Nomenclature (names, centre points).
