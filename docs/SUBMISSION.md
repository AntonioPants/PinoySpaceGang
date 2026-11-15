# Analog Atlas: find an Earth testbed, then test the analogy

Analog Atlas connects open planetary and Earth elevation data to a playable landing experiment. Choose a Moon or Mars region, inspect proposed Earth counterparts, read what matches and what does not, and fly one configured lander over real terrain. The Atlas includes curated locations and newly selected windows near known analog regions. It makes the limits of an Earth rehearsal visible alongside its practical value.

Live game: https://analog.timhufnagel.org · Findings: /findings.html · Engineering planner: /?engineering-planner

## Impact and relevance

Exploration teams need Earth testbeds for terrain navigation and landing rehearsals, while understanding that an Earth site cannot reproduce planetary gravity, vacuum or thin air, radiation, or all surface materials. This tool connects site characterization to an operational experiment. It is a study aid, not a recommendation of safe landing sites or a mission certification.

## Creativity: discover a window and fly the comparison

We scanned 3,361 eligible terrain windows in targeted regions and registered 52 with real terrain packs, alongside 50 curated Earth sites. These are new selected windows near known regions, not claims to have discovered previously unknown geological analog regions. A land-cover mask excludes unsuitable cover; it does not establish geology. Scan windows carry inferred, discounted landform labels and remain explicitly unreviewed. See the generated [findings table](FINDINGS.md) for the best curated and scanned window for each of 49 targets (24 on the Moon, 25 on Mars). Forty of those were added from published landing sites and named features; they have terrain-based Earth matches but no literature-reviewed pairings yet, and their landform labels are our own interpretation.

The landing-behaviour dimension flies the same baseline lander blindly over both elevation grids under the target's gravity and air density. It reports the agreement in sampled success share, touchdown slope and fuel use. It complements geological/terrain matching; a high score can also mean both terrains fail similarly. We do not claim that other teams lack comparable work.

## Method and validity

Build-time processing clips and reprojects real DEMs into explicit north-first metric grids. Receipts, checksums, source URLs, licences, resolution, datums, nodata rules and environmental provenance accompany the catalog and packs. No browser request to a live science API is required.

The unchanged analog score combines 50% landform-family agreement and 50% terrain-descriptor similarity, using frozen scales. Common-resolution descriptors include slope distributions, multi-scale roughness, landform shape, relief and hypsometry. Comparisons use 150 m lunar and 500 m Martian analysis grids. Reviewed proposals retain priority in the published ten; Explore all sorts every available Earth site by the modern score. No minimum cutoff is applied. Percentages are engineering similarity, never verified accuracy or a probability of suitability.

The published benchmark found terrain-only AUC 0.50 on reference proposals. The landform-aware gain is partly circular because the proposals were themselves selected by landform. Neither scoring nor physical similarity has independent scientific validation. Environmental similarity remains unknown where compatible measurements are missing. Source products can be calibrated or validated without validating our analog score.

The deterministic baseline uses 25 blind landing targets on each patch, seeds 1–25, an 800 kg dry / 350 kg fuel lander, 12 kN thrust, 12 degree slope limit, zero scenario wind and default engine leg geometry. It uses site-derived interference and no added rocks. Landing score = 50% agreement in sampled success share + 30% touchdown slope agreement + 20% fuel agreement. The artifact records the catalog checksum and assumptions. Custom player equipment or conditions rerun the live simulation rather than reuse an incompatible baseline.

## Datasets and attribution

- [NASA LRO LOLA](https://pds-geosciences.wustl.edu/missions/lro/lola.htm): lunar elevation; study grids at 150 m. Actual source identifiers and radii/datums are in terrain manifests.
- [NASA Mars Global Surveyor MOLA](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html): Martian elevation; 500 m study grids. These do not resolve individual landing hazards.
- [Copernicus DEM GLO-30](https://registry.opendata.aws/copernicus-dem/): approximately 30 m Earth surface elevation, accessed from the public bucket. It is a surface model including vegetation/buildings, not universal bare-earth ground. Use follows the Copernicus DEM licence and per-pack attribution.
- [LRO Diviner](https://pds-geosciences.wustl.edu/missions/lro/diviner.htm): regional lunar thermal bins. These are not Earth annual air temperature or a site-specific lander thermal certification.
- [NASA POWER](https://power.larc.nasa.gov/docs/): model-derived Earth environmental context with property-specific units and time coverage. Coarse climate fields are not local instantaneous weather measurements.
- [ESA WorldCover](https://esa-worldcover.org/en/data-access): 10 m land-cover mask for eligible scan windows, CC BY 4.0. Cover is a filter, not a soil-mechanics measurement.
- Globe reference imagery is visual context, not a measured terrain input. See [asset attribution](../web/public/textures/ATTRIBUTION.md) for the actual sources; Mars appearance is procedural. We do not represent illustrative imagery as NASA science measurements.

NASA/PDS source products retain their mission-specific citation requirements. The catalog's quantitative property records and terrain receipts identify the actual files, processing and limitations; portal links alone are not an ingestion claim. RADARSAT and other investigated sources are not silently credited as inputs to these scores.

## Findings and limits

The generated table gives both scores and the main difference without hand-entered numbers. It selects the highest analog score separately within curated and scanned origins across the 102 published Earth sites; it is not the evidence-tier top-ten order. IDs distinguish nearby patches with similar names. Missing baseline results remain marked not computed.

Earth cannot reproduce lunar/Martian gravity, atmospheric density, radiation or all regolith mechanics. The mission states the gravity and atmosphere actually simulated. Planetary grids at 150–500 m smooth hazards that the 30 m Earth grid can partially resolve; neither grid establishes footpad safety. A sampled landing success share is not a measured fraction of landable area. No wind or soil mechanics are invented for unmeasured locations. Lunar thermal bins and Earth annual environmental statistics are not folded into an incompatible thermal percentage.

The targeted scan is not global. Polar lunar massif/crater and Phoenix periglacial comparisons remain especially weak; filling ten slots does not establish ten strong analogs. A global search would need broader justified regions, finer planetary products, validated feature transfer, independently reviewed geology and scale-aware ground truth. Locally reviewing candidate geology and acquiring fine terrain are the next steps, followed by a held-out benchmark and measured vehicle/soil parameters.

## Presentation and reproducibility

Start Journey → choose Moon/Mars → choose region → Find Earth terrain. The slider shows analog percentages for both top ten and Explore all. Select a terrain and expand More for evidence, differences and a source. The second number reports the baseline landing comparison. Atlas provides all Earth grounds with curated/discovered markers and a target selector. Credits → Findings opens the generated table. Fly; after touchdown the astronaut walks to a bridge monitor and the debrief opens there as a carousel (arrows or arrow keys) covering the outcome, what Earth cannot reproduce, scores, rehearsal and landing-baseline comparisons, and the pair's analog evidence. `?debrief-demo` plays it for one simulated landing.

Rebuild with `node app/sim/node_modules/tsx/dist/cli.mjs app/sim/scripts/landing-similarity.ts --out data/staged/landing-similarity.json`, then `python -m scripts.catalog.findings`. Stop dev servers and run `python -m scripts.catalog.findings --publish` for the existing transactional publication step. Run `npm run check` and `python -m pytest -q`. See DEMO_SCRIPT.md for a timed walkthrough and fallbacks.
