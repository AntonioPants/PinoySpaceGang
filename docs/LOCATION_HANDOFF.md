# Earth location handoff

Generated from `web/public/sites.json` with `python -m scripts.catalog.handoff`.

11 Earth locations have production terrain packs, including Haughton and Qaidam.
These are selected study windows; they do not cover entire craters or basins.

Pairings below are proposed engineering comparisons, not validated geological
equivalence, landing safety, or mission suitability. The numerical terrain scores
are reproducible descriptors, not independently validated similarity assessments.

Shared terrain contract: elevation in metres; little-endian float32, row-major,
north-first and west-first. Earth coordinates are WGS84 longitude/latitude;
bbox order is west, south, east, north. CRS and vertical datum are in each manifest.
Physics conversion flips rows once to south-first. Missing or nonfinite samples
are rejected by the viewer; failed packs remain disabled, without synthetic fill.
Earth grids contain 161 x 161 samples at 30 m output spacing (4.8 km between
outer sample centres). Copernicus native sampling is approximately 1 arc-second,
varying with latitude; resampling does not improve source detail. These are DSMs,
not guaranteed bare-earth surfaces or rock-scale collision geometry.

Use `python -m scripts.catalog.validate` and `node scripts/catalog/check-consumers.mjs`
to verify assets and provenance before handoff. See [integration guide](SITE_CATALOG.md).

## Meteor Crater (`meteor-crater`)

Centre (longitude, latitude): -111.028, 35.027.
Study bbox: `[-111.05448841875231, 35.00521395017657, -111.00152562324303, 35.04878020599075]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/meteor-crater/manifest.json); [elevation](../web/public/terrain/meteor-crater/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N35_00_W112_00_DEM/Copernicus_DSM_COG_10_N35_00_W112_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Impact bowl and ejecta neighbourhood; centre offset west to keep 4.8km footprint inside source tile; terrestrial sedimentary target differs from lunar regolith. [Evidence](https://www.usgs.gov/centers/astrogeology-science-center/science/meteor-crater-sample-collection).

Proposed pairing: **Shackleton northern rim study area** (`shackleton-rim`). Target context and limitations: Rim neighbourhood, not entire crater or a verified landing site. Ice evidence is regional, not confirmed within this footprint. [Target evidence](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/).

Pair-specific explanation (shackleton-rim):
Matches: Both are impact-landform study areas; crater-related relief supports slope and approach-planning experiments.
Differences: Meteor includes a bowl/ejecta neighbourhood, while this Shackleton crop samples a rim. Terrestrial sedimentary rock, atmosphere and erosion differ from lunar regolith, vacuum and polar illumination.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: rim_continuity.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Badwater Basin (`badwater`)

Centre (longitude, latitude): -116.825, 36.245.
Study bbox: `[-116.85191968175863, 36.22318514565227, -116.79806540816935, 36.26680879832457]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/badwater/manifest.json); [elevation](../web/public/terrain/badwater/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N36_00_W117_00_DEM/Copernicus_DSM_COG_10_N36_00_W117_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Evaporite and closed-basin candidate; Earth heat is not current Mars thermal equivalence. [Evidence](https://doi.org/10.1029/2004JE002315).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Both provide a basin/sedimentary context relevant to interpreting past water and contrasting flat deposits with surrounding relief.
Differences: Badwater evaporite playa is not a Jezero delta replica; mineral mixtures and depositional histories are not established as equivalent. Modern terrestrial heat, groundwater and salt-crust mechanics do not reproduce current Martian conditions.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: wet_dry_state, salt_mineral_fractions.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Barrow Environmental Observatory regional context (`barrow-observatory`)

Centre (longitude, latitude): -156.6, 71.28.
Study bbox: `[-156.66995902529996, 71.25749647169353, -156.5298912330277, 71.30248147991921]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/barrow-observatory/manifest.json); [elevation](../web/public/terrain/barrow-observatory/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N71_00_W157_00_DEM/Copernicus_DSM_COG_10_N71_00_W157_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Regional periglacial terrain only. Thirty-metre DSM cannot resolve polygon microtopography or active-layer thickness. [Evidence](https://tc.copernicus.org/articles/20/265/2026/tc-20-265-2026.html).

Proposed pairing: **Phoenix northern plains study area** (`phoenix`). Target context and limitations: Regional icy-ground comparison; MOLA does not resolve polygon relief. Ice observed by Phoenix does not establish uniform resource abundance across this footprint. [Target evidence](https://science.nasa.gov/mission/phoenix/).

Pair-specific explanation (phoenix):
Matches: Ice-rich periglacial ground and polygonal surface processes motivate a northern-plains operations comparison.
Differences: Vegetation, seasonal thaw and liquid water at Barrow differ from Mars. Thirty-metre DSM and coarse MOLA do not resolve equivalent polygon geometry, ice depth or bearing strength.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: polygon_size, active_layer_depth, ground_temperature.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Kilbourne Hole (`kilbourne-hole-v1`)

Centre (longitude, latitude): -106.969, 31.972.
Study bbox: `[-106.99501576921531, 31.94982647082462, -106.94299627748264, 31.994168979289416]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/kilbourne-hole-v1/manifest.json); [elevation](../web/public/terrain/kilbourne-hole-v1/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N31_00_W107_00_DEM/Copernicus_DSM_COG_10_N31_00_W107_00_DEM.tif); [licence](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Volcanic maar; process analog, not impact origin. [Evidence](https://science.nasa.gov/blogs/notes-from-the-field/2018/01/24/kilbourne-and-aden-two-flavors-of-volcanism/).

Proposed pairing: **Shackleton northern rim study area** (`shackleton-rim`). Target context and limitations: Rim neighbourhood, not entire crater or a verified landing site. Ice evidence is regional, not confirmed within this footprint. [Target evidence](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (shackleton-rim):
Matches: Depression walls, slopes and surrounding relief provide a limited terrain-operations comparison.
Differences: Kilbourne is a volcanic maar; Shackleton is an impact crater. Their formation mechanisms and materials are different. The Kilbourne basin crop is not a lunar rim or thermal/polar-shadow analog.

Pair-specific explanation (arsia-flank):
Matches: Volcanic context and exposed rocky relief support a proposed volcanic-terrain operations comparison.
Differences: A localized maar and a large shield-volcano flank have different eruption mechanisms, dimensions and landform geometry. Shared broad basalt labels do not establish identical rock fractions, soil mechanics, atmosphere or temperature.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: crater_diameter, depth_diameter_ratio, rim_relief.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Craters of the Moon (`craters-moon`)

Centre (longitude, latitude): -113.53, 43.42.
Study bbox: `[-113.56071952923577, 43.39761233110836, -113.49930174107399, 43.44238080699547]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/craters-moon/manifest.json); [elevation](../web/public/terrain/craters-moon/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N43_00_W114_00_DEM/Copernicus_DSM_COG_10_N43_00_W114_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Lava-flow and vent terrain; terrestrial weathering and vegetation differ. [Evidence](https://www.nps.gov/crmo/learn/nature/geologicactivity.htm).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Pair-specific explanation (arsia-flank):
Matches: Lava-flow/vent terrain and broad basaltic context support volcanic surface-operations comparisons.
Differences: Flow ages, textures, weathering and vegetation differ; the Martian crop does not resolve individual lava obstacles. Neither local friction nor plume response follows from the basalt label.

Pair-specific explanation (marius-hills):
Matches: Volcanic lava and vent context motivates comparing routes and relief in volcanic landscapes.
Differences: Earth surface alteration and vegetation differ from airless lunar regolith cover. Coarse lunar elevation and this Earth crop do not establish matched vents, pits or cave geometry.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Lava Beds (`lava-beds`)

Centre (longitude, latitude): -121.51, 41.72.
Study bbox: `[-121.5395163269734, 41.69787537563197, -121.48046411786011, 41.7421177805474]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/lava-beds/manifest.json); [elevation](../web/public/terrain/lava-beds/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N41_00_W122_00_DEM/Copernicus_DSM_COG_10_N41_00_W122_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Surface above lava-tube systems; DEM cannot resolve caves. [Evidence](https://www.nps.gov/labe/learn/nature/geology.htm).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (marius-hills):
Matches: Volcanic surfaces associated regionally with lava-tube/pit investigations motivate a surface-access comparison.
Differences: Surface DEMs contain no cave interior, roof thickness or verified traversable passage. Terrestrial weathering, atmosphere and cave access differ from the lunar environment; a surface comparison does not validate a shelter.

Pair-specific explanation (arsia-flank):
Matches: Volcanic terrain and regional interest in subsurface voids motivate surface reconnaissance comparisons.
Differences: An Earth lava-tube landscape is not evidence for a cave within the selected Arsia crop. Neither DEM resolves voids, roofs or fine obstacles; atmospheric and material-mechanics equivalence is unestablished.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Amboy Crater (`amboy`)

Centre (longitude, latitude): -115.78, 34.55.
Study bbox: `[-115.80662698530362, 34.527960581578675, -115.75335931125501, 34.57203409353121]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/amboy/manifest.json); [elevation](../web/public/terrain/amboy/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N34_00_W116_00_DEM/Copernicus_DSM_COG_10_N34_00_W116_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Volcanic cone and flows; not an impact crater. [Evidence](https://www.blm.gov/visit/amboy-crater-national-natural-landmark).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (arsia-flank):
Matches: Volcanic cone/flow context and broad basaltic interpretation offer a volcanic-terrain comparison.
Differences: Amboy cinder-cone terrain differs from the regional shield-volcano flank crop. Cinder grain sizes, obstacle abundance and strength are not matched by a coarse DEM or a shared substrate label.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: flow_morphology.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## White Sands (`white-sands`)

Centre (longitude, latitude): -106.23, 32.82.
Study bbox: `[-106.25610038681597, 32.79796425468859, -106.20391219499493, 32.84203077505174]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/white-sands/manifest.json); [elevation](../web/public/terrain/white-sands/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N32_00_W107_00_DEM/Copernicus_DSM_COG_10_N32_00_W107_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Aeolian process comparison; gypsum differs from Martian basaltic sand. [Evidence](https://www.nps.gov/whsa/learn/gypsum.htm).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Wind-transported dunes motivate comparing aeolian landform organization and operations on granular slopes.
Differences: White Sands gypsum differs from Bagnold basaltic sand; cohesion, density and optical properties cannot be transferred directly. MOLA does not resolve Bagnold dune slipfaces at the Earth DSM scale; wind and gravity differ.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: dune_height, crest_spacing, crest_orientation, migration.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Capitol Reef sedimentary study area (`capitol-reef`)

Centre (longitude, latitude): -111.13, 38.28.
Study bbox: `[-111.157658833876, 38.25820108611053, -111.10235765301128, 38.301792382459546]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/capitol-reef/manifest.json); [elevation](../web/public/terrain/capitol-reef/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N38_00_W112_00_DEM/Copernicus_DSM_COG_10_N38_00_W112_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: exposed sedimentary relief, not a validated delta analog. No novelty claim. [Evidence](https://www.nps.gov/care/learn/nature/geology.htm).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Exposed sedimentary relief and erosion provide a hypothesis for comparing terrain access to layered deposits.
Differences: Capitol Reef is not a demonstrated Jezero delta analog; lithology and depositional histories require independent comparison. Regional slope/relief similarity cannot validate sediment provenance, resources or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Haughton Crater floor study area (`haughton`)

Centre (longitude, latitude): -89.68, 75.37.
Study bbox: `[-89.76956194752482, 75.34738613293392, -89.59068477813, 75.39258554129579]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/haughton/manifest.json); [elevation](../web/public/terrain/haughton/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N75_00_W090_00_DEM/Copernicus_DSM_COG_10_N75_00_W090_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: A 4.8 km impact-crater floor window, not the entire Haughton structure. Polar desert and impact context support proposed comparisons; Earth atmosphere, weathering and seasonal water differ from lunar conditions. [Evidence](https://ntrs.nasa.gov/citations/20060013129).

Proposed pairing: **Shackleton northern rim study area** (`shackleton-rim`). Target context and limitations: Rim neighbourhood, not entire crater or a verified landing site. Ice evidence is regional, not confirmed within this footprint. [Target evidence](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/).

Pair-specific explanation (shackleton-rim):
Matches: Impact-generated terrain and local relief offer a proposed operations/terrain comparison.
Differences: The Haughton crop samples floor context; the target crop samples a Shackleton rim neighbourhood. Earth atmosphere, seasonal water, weathering and illumination differ from lunar polar conditions; whole-crater equivalence is not established.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: crater_diameter, rim_geometry, ground_ice_depth.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Qaidam Basin yardang study area (`qaidam`)

Centre (longitude, latitude): 93.27, 38.66.
Study bbox: `[93.24216985323615, 38.63816919448528, 93.29784694669169, 38.68182423704416]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/qaidam/manifest.json); [elevation](../web/public/terrain/qaidam/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N38_00_E093_00_DEM/Copernicus_DSM_COG_10_N38_00_E093_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Study window around published multilayered yardangs at 38.66 N, 93.27 E. Thirty-metre DSM supplies regional relief, not fine yardang walls or soil mechanics. Proposed Lucus Planum comparison concerns wind-eroded ridges; yardangs are not equivalent to the Bagnold sand dunes. [Evidence](https://doi.org/10.1029/2018JE005719).

Proposed pairing: **Lucus Planum yardang study area** (`lucus-planum`). Target context and limitations: Sixteen-kilometre regional window centred on NASA THEMIS PIA24008 (187.227 E converted to -172.773 E). Imagery documents wind-eroded yardangs; coarse MOLA elevation cannot resolve individual ridges or demonstrate material equivalence. [Target evidence](https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/).

Pair-specific explanation (lucus-planum):
Matches: Published Qaidam field work and NASA THEMIS imagery document wind-eroded ridges (yardangs), motivating an aeolian-erosion process comparison.
Differences: Qaidam field coordinates and the Lucus THEMIS image centre define separate study windows, not a measured one-to-one ridge correspondence. Local Martian lithology is unresolved; terrestrial sedimentary material does not establish identical cementation or strength. The roughly 463 m MOLA source cannot resolve individual yardang walls or validate crest spacing; atmosphere, gravity and erosional histories differ.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: yardang_height, yardang_width, yardang_orientation, surface_material_fractions.

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.
