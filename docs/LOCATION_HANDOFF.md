# Earth location handoff

Generated from `web/public/sites.json` with `python -m scripts.catalog.handoff`.

50 Earth locations have production terrain packs, including Haughton and Qaidam.
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

## Cima volcanic field study area (`cima-lava-field`)

Centre (longitude, latitude): -115.751506, 35.216319.
Study bbox: `[-115.77836130933173, 35.194271503624094, -115.72463653056855, 35.23836104269123]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/cima-lava-field/manifest.json); [elevation](../web/public/terrain/cima-lava-field/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N35_00_W116_00_DEM/Copernicus_DSM_COG_10_N35_00_W116_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: 4.8 km surface window around the NPS Lava Tube reference point in the Cima volcanic field. Lava and cinder-cone context; no cave interior or roof geometry is represented. [Evidence](https://www.nps.gov/places/the-lava-tube-at-mojave.htm).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (marius-hills):
Matches: Basaltic volcanic surfaces and regional lava-tube interest motivate surface-route comparison.
Differences: This surface DSM does not represent a cave interior or establish lunar shelter stability. Desert alteration, atmosphere and cinder-cone context differ from airless lunar volcanic terrain.

Pair-specific explanation (arsia-flank):
Matches: Volcanic flow relief supports a proposed surface-access comparison.
Differences: Small terrestrial vents differ in scale and eruption history from a Martian shield-volcano flank. Cave occurrence, regolith strength and rock abundance are not transferable from these elevation grids.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Sunset Crater and Bonito lava study area (`sunset-crater`)

Centre (longitude, latitude): -111.52, 35.365.
Study bbox: `[-111.54672954226362, 35.34310783975889, -111.49328473311965, 35.3868864173375]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/sunset-crater/manifest.json); [elevation](../web/public/terrain/sunset-crater/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N35_00_W112_00_DEM/Copernicus_DSM_COG_10_N35_00_W112_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km window spanning Bonito flow and Sunset Crater cone context. Forest canopy can affect the DSM; cone-scale volcanism differs from planetary shield-volcano flanks. [Evidence](https://www.nps.gov/articles/nps-geodiversity-atlas-sunset-crater-volcano-national-monument-arizona.htm).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (marius-hills):
Matches: Volcanic cone and lava-flow context motivates comparing routes and terrain relief.
Differences: Forests, recent terrestrial surface processes and cinders differ from lunar regolith and vacuum. The study crops do not establish corresponding vents or cave structures.

Pair-specific explanation (arsia-flank):
Matches: Basaltic lava landscapes support a proposed volcanic surface-operations comparison.
Differences: Sunset is a localized cinder cone with flows, not a shield-volcano flank of equivalent scale. Vegetation affects the Earth DSM; geological age, atmosphere and material mechanics are not matched.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Great Sand Dunes study area (`great-sand-dunes`)

Centre (longitude, latitude): -105.53, 37.75.
Study bbox: `[-105.55757583171815, 37.728107454939874, -105.50244022566906, 37.771886281027186]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/great-sand-dunes/manifest.json); [elevation](../web/public/terrain/great-sand-dunes/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_W106_00_DEM/Copernicus_DSM_COG_10_N37_00_W106_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km dunefield window; mixed mineral sand with volcanic and other source rocks, not pure quartz or a measured basaltic-sand equivalent. Regional DEM cannot establish dune migration or grain mechanics. [Evidence](https://www.nps.gov/grsa/learn/nature/volcanic-origins-of-great-sand-dunes.htm).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Aeolian dune landforms motivate a comparison of regional relief and terrain access.
Differences: The mixed terrestrial mineral assemblage is not established as equivalent to Bagnold basaltic sand. Water-mediated sand supply, wind regime and gravity differ; coarse MOLA cannot resolve equivalent slipfaces or migration.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Bisti badlands study area (`bisti-badlands`)

Centre (longitude, latitude): -108.25, 36.27.
Study bbox: `[-108.27761196340852, 36.247632076098604, -108.22237317658643, 36.292362786806216]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/bisti-badlands/manifest.json); [elevation](../web/public/terrain/bisti-badlands/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N36_00_W109_00_DEM/Copernicus_DSM_COG_10_N36_00_W109_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km badlands window with eroded sedimentary outcrops. Terrestrial weathering and fossil-bearing strata do not imply Martian depositional or biological equivalence. [Evidence](https://www.blm.gov/programs/national-conservation-lands/new-mexico/bisti-de-na-zin-wilderness).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Eroded layered sedimentary terrain offers a candidate operations comparison for access to exposed strata.
Differences: Bisti badlands are not a verified Jezero delta replica; depositional history and lithology differ. Terrestrial fossils and weathering have no demonstrated biological or environmental counterpart at Jezero; hoodoos are unresolved by coarse planetary DEMs.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Lanzarote Timanfaya volcanic study area (`lanzarote-timanfaya`)

Centre (longitude, latitude): -13.75, 28.97.
Study bbox: `[-13.775038322180237, 28.947974967630294, -13.724951299647643, 28.9920208072966]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/lanzarote-timanfaya/manifest.json); [elevation](../web/public/terrain/lanzarote-timanfaya/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N28_00_W014_00_DEM/Copernicus_DSM_COG_10_N28_00_W014_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km volcanic surface window in the Timanfaya region. ESA documents Lanzarote planetary field training; this window is not claimed as an exact PANGAEA traverse or a cave model. [Evidence](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_Pangaea/Lanzarote_and_ESA_united_by_space).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (marius-hills):
Matches: Basaltic volcanic surfaces support a proposed regional flow-relief and geological-operations comparison; ESA uses Lanzarote for planetary training.
Differences: This selected window is not the documented training traverse or a measured one-to-one lunar flow match. Earth atmosphere and surface alteration differ from lunar regolith; surface elevation contains no cave interiors.

Pair-specific explanation (arsia-flank):
Matches: Volcanic terrain motivates a candidate route-planning comparison between exposed flow landscapes.
Differences: Lanzarote vents and flows differ in scale and geological history from the Arsia shield-volcano flank. Shared volcanic context does not establish matched temperatures, rock abundance or contact mechanics.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Askja eastern volcanic terrain study area (`askja-east`)

Centre (longitude, latitude): -16.6, 65.055.
Study bbox: `[-16.652638646461963, 65.03278243871668, -16.547444575094392, 65.0772009831221]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/askja-east/manifest.json); [elevation](../web/public/terrain/askja-east/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N65_00_W017_00_DEM/Copernicus_DSM_COG_10_N65_00_W017_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km window east of Askja in lava and tephra terrain near Dreki. Regional volcanic context is supported; exact lithologic fractions and equivalence to published ripple plots are unestablished. [Evidence](https://www.vatnajokulsthjodgardur.is/en/areas/askja/askja-eldstod).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Pair-specific explanation (arsia-flank):
Matches: Volcanic surface relief and lava/tephra context motivate a regional volcanic-operations comparison.
Differences: Askja is a central volcanic system influenced by terrestrial glacial and weather processes, not an equivalent Martian shield flank. Local material fractions, snow state and fine volcanic obstacles are not established from this DSM.

Pair-specific explanation (marius-hills):
Matches: Volcanic surface geometry provides a candidate terrain-access comparison.
Differences: The exact study window is not a documented lunar geological equivalent; its lava and tephra mixtures remain unquantified. Seasonal snow, water and atmosphere differ from lunar vacuum and regolith; subsurface shelters are not represented.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Atacama Yungay regional study area (`atacama-yungay`)

Centre (longitude, latitude): -69.86, -24.08.
Study bbox: `[-69.88390526360017, -24.101942118266454, -69.83610277203312, -24.05805440180116]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/atacama-yungay/manifest.json); [elevation](../web/public/terrain/atacama-yungay/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S25_00_W070_00_DEM/Copernicus_DSM_COG_10_S25_00_W070_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km dry-desert window in the Yungay region, not a precisely relocated field sampling plot. Arid surface operations and preservation context motivate comparison; soil mineralogy and historical water deposits are not mapped here. [Evidence](https://ahed.nasa.gov/about/about-image?id=4).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: NASA describes Yungay as an arid Mars-analog environment; exposed dry surfaces motivate an operational and preservation-context comparison.
Differences: The chosen Yungay window is not a delta replica or a relocation of a published sampling plot. Aridity alone does not match Jezero depositional history, current temperature, atmosphere, chemistry or evidence of life.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Sossusvlei dune and pan study area (`sossusvlei-dunes`)

Centre (longitude, latitude): 15.3, -24.77.
Study bbox: `[15.276064087183084, -24.791856415984263, 15.3239442579511, -24.748139806037685]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/sossusvlei-dunes/manifest.json); [elevation](../web/public/terrain/sossusvlei-dunes/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S25_00_E015_00_DEM/Copernicus_DSM_COG_10_S25_00_E015_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km dune-and-pan window near Sossusvlei and Deadvlei. Aeolian relief is relevant; ephemeral water, fog and terrestrial sand composition differ from Mars. Grain proportions and dune migration are unmeasured. [Evidence](https://science.nasa.gov/earth/earth-observatory/namib-sand-sea-149130/).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Dune-field relief and wind-shaped sedimentary landforms motivate a regional aeolian comparison.
Differences: Sossusvlei pans, ephemeral water and coastal-desert fog differ from the Martian dune environment. Earth mineral proportions and grain mechanics are not established as equivalent to Bagnold basaltic sand; MOLA cannot resolve matching slipfaces.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Lonar impact crater study area (`lonar-crater`)

Centre (longitude, latitude): 76.51, 19.975.
Study bbox: `[76.48672027784755, 19.95298620569663, 76.53328606705513, 19.997011203712592]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/lonar-crater/manifest.json); [elevation](../web/public/terrain/lonar-crater/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N19_00_E076_00_DEM/Copernicus_DSM_COG_10_N19_00_E076_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km impact-crater and surrounding basalt window. The lake is represented by surface elevation, not bathymetry or traversable crater-floor terrain. Vegetation and water differ from lunar conditions. [Evidence](https://science.nasa.gov/earth/earth-observatory/lonar-crater-india-8654/).

Proposed pairing: **Shackleton northern rim study area** (`shackleton-rim`). Target context and limitations: Rim neighbourhood, not entire crater or a verified landing site. Ice evidence is regional, not confirmed within this footprint. [Target evidence](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/).

Pair-specific explanation (shackleton-rim):
Matches: Impact-generated rim and basin relief support a proposed crater-operations comparison; NASA documents Lonar as an impact into basalt.
Differences: Lonar includes a saline lake and vegetation; its DSM does not provide lake-floor bathymetry or certify traversable ground. The Earth bowl and surrounding basalt differ from the Shackleton polar rim footprint, lunar materials, gravity and illumination.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Wolfe Creek impact crater study area (`wolfe-creek`)

Centre (longitude, latitude): 127.795, -19.171.
Study bbox: `[127.77187450655192, -19.19297020085174, 127.81811945126782, -19.149027244409577]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/wolfe-creek/manifest.json); [elevation](../web/public/terrain/wolfe-creek/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S20_00_E127_00_DEM/Copernicus_DSM_COG_10_S20_00_E127_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km window around a preserved impact crater in desert terrain. Regional rim and floor relief are represented; local target-rock fractions, rim hazards and mechanical strength are not measured. [Evidence](https://science.nasa.gov/earth/earth-observatory/wolfe-creek-crater-8488/).

Proposed pairing: **Shackleton northern rim study area** (`shackleton-rim`). Target context and limitations: Rim neighbourhood, not entire crater or a verified landing site. Ice evidence is regional, not confirmed within this footprint. [Target evidence](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/).

Pair-specific explanation (shackleton-rim):
Matches: Preserved impact-rim and basin relief motivate a regional crater-access comparison.
Differences: A small terrestrial crater with infill and vegetation is not equivalent to the selected lunar rim footprint. Local material composition, polar shadow, ice abundance and landing safety are not established as equivalent.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Wadi Rum desert study area (`wadi-rum`)

Centre (longitude, latitude): 35.44, 29.54.
Study bbox: `[35.41457949775989, 29.517764424355892, 35.465431155594665, 29.56223164251572]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/wadi-rum/manifest.json); [elevation](../web/public/terrain/wadi-rum/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N29_00_E035_00_DEM/Copernicus_DSM_COG_10_N29_00_E035_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km window south of Rum village through sand-filled valleys and rock relief. Regional sandstone and granite context is documented; local material fractions are unmapped. This is not a Jezero delta reconstruction or a field-access approval. [Evidence](https://science.nasa.gov/earth/earth-observatory/wadi-rum-jordan-49945/).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Exposed rock relief and sediment-filled desert valleys motivate a candidate traverse and outcrop-access comparison.
Differences: Wadi Rum sandstone/granite mountains and sand valleys are not a Jezero delta replica or matched depositional sequence. Shared desert appearance does not establish matched mineralogy, atmosphere, temperatures or soil mechanics.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Richat eastern ridges study area (`richat-ridges`)

Centre (longitude, latitude): -11.31, 21.16.
Study bbox: `[-11.333584789865851, 21.137878396174635, -11.28642200625809, 21.18211906988036]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/richat-ridges/manifest.json); [elevation](../web/public/terrain/richat-ridges/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N21_00_W012_00_DEM/Copernicus_DSM_COG_10_N21_00_W012_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km eastern-ridge window within the much larger Richat structure. Richat is an eroded geological dome, not an impact crater. Mixed regional rock types are documented; the window is not a whole-structure model or a mapped lithologic survey. [Evidence](https://science.nasa.gov/earth/earth-observatory/eyeing-the-richat-structure/).

Proposed pairing: **Lucus Planum yardang study area** (`lucus-planum`). Target context and limitations: Sixteen-kilometre regional window centred on NASA THEMIS PIA24008 (187.227 E converted to -172.773 E). Imagery documents wind-eroded yardangs; coarse MOLA elevation cannot resolve individual ridges or demonstrate material equivalence. [Target evidence](https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/).

Pair-specific explanation (lucus-planum):
Matches: Erosion-resistant ridges and intervening low ground motivate a candidate regional terrain-access comparison.
Differences: Richat cuestas expose an eroded geological dome; Lucus Planum yardangs are not the same landform or structural history. Richat is not an impact crater. Mixed Earth rock types do not establish Martian material composition; the coarse planetary DEM cannot resolve individual ridge walls.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Harrat Khaybar volcanic study area (`harrat-khaybar`)

Centre (longitude, latitude): 39.93, 25.67.
Study bbox: `[39.9057739389923, 25.64803958280337, 39.954234812961325, 25.691956682825555]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/harrat-khaybar/manifest.json); [elevation](../web/public/terrain/harrat-khaybar/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N25_00_E039_00_DEM/Copernicus_DSM_COG_10_N25_00_E039_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km window in the central volcanic field near Jabal Qidr. Basalt flows, silicic domes and pyroclastic deposits occur regionally; a uniform basalt substrate is not assigned without a local geological overlay. Surface relief does not resolve caves or eruption hazards. [Evidence](https://science.nasa.gov/earth/earth-observatory/harrat-khaybar-volcanic-field-8650/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (marius-hills):
Matches: Volcanic flows and vents support a proposed surface-relief and route-planning comparison.
Differences: The terrestrial field includes silicic and pyroclastic as well as basaltic material; a uniform lunar basalt equivalent is unestablished. Earth alteration and atmosphere differ from lunar regolith and vacuum; surface grids do not model caves or wheel-scale hazards.

Pair-specific explanation (arsia-flank):
Matches: Regional volcanic surface relief provides a proposed comparison for operations over flow landscapes.
Differences: A terrestrial field of cones and domes differs in scale and eruption history from the Arsia shield flank. Local rock fractions and mechanical properties are unmeasured; a terrain score does not validate environmental equivalence.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Payun Matru western flank study area (`payun-matru`)

Centre (longitude, latitude): -69.3, -36.4.
Study bbox: `[-69.32702282427489, -36.421836370901126, -69.27299219960457, -36.37815758359001]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/payun-matru/manifest.json); [elevation](../web/public/terrain/payun-matru/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S37_00_W070_00_DEM/Copernicus_DSM_COG_10_S37_00_W070_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km volcanic flank window west of the Payun Matru caldera, not the whole shield or caldera. Regional volcanic composition is varied and local material fractions remain unknown. Shield-flank relief motivates comparison; Earth geological history and atmosphere differ. [Evidence](https://science.nasa.gov/earth/earth-observatory/payun-volcanic-field-80017/).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Pair-specific explanation (arsia-flank):
Matches: Shield-volcano flank context supports a proposed regional relief and approach-planning comparison.
Differences: The small western Payun window is not the whole shield; planetary dimensions, geological history and gravity differ. Local volcanic composition, weathering and mechanical strength are not established as equivalent to Arsia basalt.

Pair-specific explanation (marius-hills):
Matches: Volcanic surface relief supports a candidate terrain-access comparison.
Differences: A terrestrial shield flank differs from the Marius volcanic-plain footprint and does not reproduce lunar vents or pits. The selected Earth material mixture is unmapped; neither source resolves cave interiors, shelter safety or lunar regolith mechanics.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Tongariro western volcanic study area (`tongariro-west`)

Centre (longitude, latitude): 175.58, -39.15.
Study bbox: `[175.55161413110943, -39.1720925148958, 175.60836867533007, -39.127901228799125]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/tongariro-west/manifest.json); [elevation](../web/public/terrain/tongariro-west/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S40_00_E175_00_DEM/Copernicus_DSM_COG_10_S40_00_E175_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km western volcanic mountain window near Mangatepopo. The regional volcanoes are andesitic; local tephra, lava and sediment fractions are unmapped and are not relabeled basalt. Snow, vegetation and water can affect the DSM. No route permission or volcanic safety approval is implied. [Evidence](https://www.doc.govt.nz/parks-and-recreation/places-to-go/central-north-island/places/tongariro-national-park/about-tongariro-national-park/central-north-island-volcanoes/).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (arsia-flank):
Matches: Volcanic mountain relief offers a candidate operations comparison across elevated volcanic terrain.
Differences: Tongariro regional andesitic volcanism differs from the basaltic Martian shield setting; local material fractions are not mapped. Terrestrial snow, vegetation, water and active-volcano processes differ from Mars; the surface model supplies no field-access or hazard approval.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Erg Chebbi dune study area (`erg-chebbi`)

Centre (longitude, latitude): -3.96, 31.16.
Study bbox: `[-3.9855612550655932, 31.138021248638378, -3.9344503355355176, 31.18197401488382]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/erg-chebbi/manifest.json); [elevation](../web/public/terrain/erg-chebbi/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N31_00_W004_00_DEM/Copernicus_DSM_COG_10_N31_00_W004_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Selected 4.8 km central dune window northeast of Merzouga. Star-dune context supports an aeolian terrain comparison; local sand mineral fractions and migration are unmeasured. Shallow aquifers and terrestrial rainfall differ from current Mars; no Martian groundwater inference follows. [Evidence](https://science.nasa.gov/earth/earth-observatory/the-shallow-aquifers-of-erg-chebbi-89181/).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Wind-shaped dune relief motivates a regional aeolian terrain comparison.
Differences: Erg Chebbi star-dune organization and unmeasured sand composition are not established as equivalents of Bagnold basaltic dunes. Rain-fed shallow aquifers and Earth wind/gravity differ from Mars; coarse MOLA does not resolve equivalent slipfaces or dune migration.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Teide Las Canadas study area (`teide-canadas`)

Centre (longitude, latitude): -16.63, 28.25.
Study bbox: `[-16.65494553443794, 28.227913238526952, -16.605064463305833, 28.27208279406447]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/teide-canadas/manifest.json); [elevation](../web/public/terrain/teide-canadas/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N28_00_W017_00_DEM/Copernicus_DSM_COG_10_N28_00_W017_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Southern Las Canadas floor and volcanic relief near Roques de Garcia; not the whole Teide edifice. [Evidence](https://science.nasa.gov/earth/earth-observatory/tenerife-canary-islands-88659/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Pair-specific explanation (marius-hills):
Matches: Volcanic floor and flow-related relief offer a candidate surface-access comparison.
Differences: A terrestrial caldera complex with varied volcanic rocks is not a lunar volcanic plain or pit reconstruction. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Etna eastern flank study area (`etna-east`)

Centre (longitude, latitude): 15.04, 37.73.
Study bbox: `[15.012589962033584, 37.70822033518761, 15.067426082209575, 37.75177322726335]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/etna-east/manifest.json); [elevation](../web/public/terrain/etna-east/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_E015_00_DEM/Copernicus_DSM_COG_10_N37_00_E015_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Eastern volcanic flank near Valle del Bove, excluding the summit centre; later eruptions may have changed the DSM surface. [Evidence](https://science.nasa.gov/earth/earth-observatory/mount-etna-erupts-15782/).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (arsia-flank):
Matches: Volcanic flank relief supports an engineering comparison of gradients and terrain access.
Differences: Etna is a terrestrial stratovolcano; its collapse valley, eruption history and scale differ from the Arsia shield flank. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Piton de la Fournaise Enclos study area (`fournaise-enclos`)

Centre (longitude, latitude): 55.73, -21.24.
Study bbox: `[55.70654097462126, -21.261988854643906, 55.75345218187035, -21.218008273117732]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/fournaise-enclos/manifest.json); [elevation](../web/public/terrain/fournaise-enclos/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S22_00_E055_00_DEM/Copernicus_DSM_COG_10_S22_00_E055_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Enclos volcanic surface east of the summit cone; historic DSM does not track subsequent lava emplacement. [Evidence](https://science.nasa.gov/earth/earth-observatory/piton-de-la-fournaise-volcano-18211/).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (arsia-flank):
Matches: Shield-volcano flow terrain supports a proposed regional surface-operations comparison.
Differences: Active terrestrial lava and steep local relief do not reproduce Martian eruption ages, weathering or shield dimensions. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Fogo caldera study area (`fogo-caldera`)

Centre (longitude, latitude): -24.35, 14.95.
Study bbox: `[-24.37269980000161, 14.927927667068007, -24.3272956774674, 14.972070882081564]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/fogo-caldera/manifest.json); [elevation](../web/public/terrain/fogo-caldera/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N14_00_W025_00_DEM/Copernicus_DSM_COG_10_N14_00_W025_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Pico do Fogo and surrounding Cha das Caldeiras context; the 2014 eruption overlaps the DSM acquisition period. [Evidence](https://science.nasa.gov/earth/earth-observatory/fire-island-cabo-verde-148613/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Pair-specific explanation (marius-hills):
Matches: Volcanic cone and flow relief motivate a limited terrain-access comparison.
Differences: This volcanic depression is not an impact crater or a lunar pit; settlements and post-acquisition lava can affect the Earth surface. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Bromo Sandsea caldera study area (`bromo-sandsea`)

Centre (longitude, latitude): 112.95, -7.94.
Study bbox: `[112.92799926060869, -7.961934721196827, 112.97200304910652, -7.918064674926288]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/bromo-sandsea/manifest.json); [elevation](../web/public/terrain/bromo-sandsea/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S08_00_E112_00_DEM/Copernicus_DSM_COG_10_S08_00_E112_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Bromo cone and surrounding Sandsea caldera floor; ash surface, vegetation and later eruptions are not resolved as material classes. [Evidence](https://science.nasa.gov/earth/earth-observatory/gunung-bromo-indonesia-5062/).

Proposed pairing: **Marius Hills volcanic study area** (`marius-hills`). Target context and limitations: Volcanic terrain near pit region; elevation surface does not establish subsurface resources. [Target evidence](https://www.lroc.asu.edu/posts/230).

Pair-specific explanation (marius-hills):
Matches: Contrasting volcanic cone and floor relief provides a candidate operations comparison.
Differences: Bromo is a terrestrial volcanic caldera setting, not an impact crater or a lunar basalt/regolith equivalent. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## El Pinacate El Elegante study area (`pinacate-elegante`)

Centre (longitude, latitude): -113.5, 31.77.
Study bbox: `[-113.52607150703756, 31.747729781156195, -113.4739404021317, 31.79226588973946]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/pinacate-elegante/manifest.json); [elevation](../web/public/terrain/pinacate-elegante/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N31_00_W114_00_DEM/Copernicus_DSM_COG_10_N31_00_W114_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Window around El Elegante maar and surrounding volcanic desert; the reserve and its distant dune fields are not represented in full. [Evidence](https://whc.unesco.org/en/list/1410/).

Proposed pairing: **Arsia Mons flank study area** (`arsia-flank`). Target context and limitations: Regional volcanic terrain; no cave or safe landing claim. Replaces broad lava-tube placeholder. [Target evidence](https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/).

Pair-specific explanation (arsia-flank):
Matches: Volcanic desert relief supports a candidate reconnaissance and route-planning comparison.
Differences: A localized volcanic maar is not an impact crater or an equivalent Martian shield flank; formation process and dimensions differ. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Bardenas Blanca badlands study area (`bardenas-blanca`)

Centre (longitude, latitude): -1.49, 42.21.
Study bbox: `[-1.5197546217609195, 42.18786871623101, -1.460225332077408, 42.2321243254919]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/bardenas-blanca/manifest.json); [elevation](../web/public/terrain/bardenas-blanca/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N42_00_W002_00_DEM/Copernicus_DSM_COG_10_N42_00_W002_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Eroded sedimentary terrain near Castildetierra in Bardenas Blanca; not a mapped geological unit or whole reserve. [Evidence](https://www.unesco.org/en/mab/bardenas-reales).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Eroded sedimentary exposures motivate a candidate outcrop-access comparison.
Differences: Terrestrial badland drainage and strata are not a Jezero delta reconstruction; local clay fractions and strength remain unmeasured. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Tabernas badlands study area (`tabernas-badlands`)

Centre (longitude, latitude): -2.46, 37.06.
Study bbox: `[-2.4873088044559424, 37.03810464557375, -2.432675676420392, 37.081889249005144]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/tabernas-badlands/manifest.json); [elevation](../web/public/terrain/tabernas-badlands/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N37_00_W003_00_DEM/Copernicus_DSM_COG_10_N37_00_W003_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Gullied badlands southwest of Tabernas; chosen analysis window is not claimed as the exact ESA rover field-trial route. [Evidence](https://www.juntadeandalucia.es/medioambiente/portal/en/web/ventanadelvisitante/detalle-buscador-mapa/-/asset_publisher/Jlbxh2qB3NwR/content/desierto-de-tabernas/255035).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Dry gullies and exposed sediments offer an outcrop and rover-operations comparison.
Differences: Flash-flood erosion in Earth sedimentary terrain does not reproduce Jezero delta deposition or present Martian environmental conditions. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Ischigualasto sedimentary study area (`ischigualasto`)

Centre (longitude, latitude): -67.95, -30.07.
Study bbox: `[-67.97527744732446, -30.091988390111702, -67.92471157868927, -30.048007112353897]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/ischigualasto/manifest.json); [elevation](../web/public/terrain/ischigualasto/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S31_00_W068_00_DEM/Copernicus_DSM_COG_10_S31_00_W068_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Central eroded sedimentary landscape within Ischigualasto; small window does not represent the entire fossil-bearing sequence. [Evidence](https://whc.unesco.org/en/list/966).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Layered sedimentary exposure and eroded relief support a candidate geological-access comparison.
Differences: Earth Triassic strata and fossils do not establish Martian depositional equivalence or evidence of life at Jezero. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Talampaya canyon study area (`talampaya-canyon`)

Centre (longitude, latitude): -67.84, -29.79.
Study bbox: `[-67.86522780903947, -29.8120076530901, -67.81476137208527, -29.767987938985648]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/talampaya-canyon/manifest.json); [elevation](../web/public/terrain/talampaya-canyon/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S30_00_W068_00_DEM/Copernicus_DSM_COG_10_S30_00_W068_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Canyon and surrounding sandstone plateau near the principal Talampaya gorge; 30 m sampling smooths narrow walls. [Evidence](https://whc.unesco.org/en/list/966).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Sedimentary cliffs and access through relief offer a candidate terrain-operations comparison.
Differences: A deeply eroded terrestrial canyon is not a delta; wall geometry, fossils and depositional history are not matched to Jezero. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Valle de la Luna salt-range study area (`valle-luna-chile`)

Centre (longitude, latitude): -68.285, -22.925.
Study bbox: `[-68.30866110229537, -22.946918651668934, -68.26133135768514, -22.903078020015304]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/valle-luna-chile/manifest.json); [elevation](../web/public/terrain/valle-luna-chile/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S23_00_W069_00_DEM/Copernicus_DSM_COG_10_S23_00_W069_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Salt-range relief west of San Pedro de Atacama; excludes the wider Atacama basin and does not map local mineral fractions. [Evidence](https://simbio.mma.gob.cl/CbaAP/VistaImpresion/1053).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Dry exposed basin-related terrain motivates a candidate reconnaissance comparison.
Differences: Salt-range relief and terrestrial erosion do not establish an equivalent Jezero delta or matched Martian mineral inventory. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Uyuni Incahuasi salt-flat study area (`uyuni-incahuasi`)

Centre (longitude, latitude): -67.625, -20.24.
Study bbox: `[-67.64830407752261, -20.2619965166146, -67.60168947370668, -20.2180008078365]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/uyuni-incahuasi/manifest.json); [elevation](../web/public/terrain/uyuni-incahuasi/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S21_00_W068_00_DEM/Copernicus_DSM_COG_10_S21_00_W068_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Incahuasi island and adjacent salt flat; includes contrasting rock and salt surfaces, and seasonal water is not bathymetry. [Evidence](https://science.nasa.gov/earth/earth-observatory/salar-de-uyuni-bolivia-6096/).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Closed-basin salt deposits and local relief offer a limited basin-exploration comparison.
Differences: An evaporitic playa with a rock island is not a delta replica; seasonal flooding and salt-crust mechanics differ from Mars. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Makgadikgadi Kubu pan-margin study area (`makgadikgadi-kubu`)

Centre (longitude, latitude): 25.825, -20.89.
Study bbox: `[25.801611678780034, -20.91197489456891, 25.848381615883504, -20.868022261265384]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/makgadikgadi-kubu/manifest.json); [elevation](../web/public/terrain/makgadikgadi-kubu/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S21_00_E025_00_DEM/Copernicus_DSM_COG_10_S21_00_E025_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Pan-margin window around Kubu with surrounding salt-pan context; mixed rock, sediment and vegetation are not classified pixel by pixel. [Evidence](https://modis.gsfc.nasa.gov/gallery/individual.php?db_date=2026-02-05).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Dry lake-basin surfaces and isolated relief motivate a candidate basin-operations comparison.
Differences: Seasonal inundation, vegetation and terrestrial salts do not establish Jezero delta geometry or comparable bearing strength. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Tsondab northern dune study area (`tsondab-dunes`)

Centre (longitude, latitude): 15.32, -23.93.
Study bbox: `[15.296219688209657, -23.951860434173543, 15.343788284916108, -23.908135940500042]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/tsondab-dunes/manifest.json); [elevation](../web/public/terrain/tsondab-dunes/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_S24_00_E015_00_DEM/Copernicus_DSM_COG_10_S24_00_E015_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Selected dune-and-river-termination context north of Tsondabvlei, distinct from the Sossusvlei window; not a relocated sampling plot. [Evidence](https://esrs.jsc.nasa.gov/SearchPhotos/photo.pl?frame=23405&mission=ISS047&roll=E).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Wind-shaped dune relief provides a regional aeolian comparison.
Differences: River termination and terrestrial moisture differ from Bagnold; sand composition, dune migration and equivalent slipfaces are unmeasured. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Rub al Khali Oman dune study area (`rub-khali-oman`)

Centre (longitude, latitude): 54.1, 20.6.
Study bbox: `[54.07643812421093, 20.577816403821608, 54.12355531285517, 20.622181337281187]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/rub-khali-oman/manifest.json); [elevation](../web/public/terrain/rub-khali-oman/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N20_00_E054_00_DEM/Copernicus_DSM_COG_10_N20_00_E054_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Interior dune-and-interdune window in the Omani Empty Quarter; source photograph supports regional context, not exact acquisition alignment. [Evidence](https://eol.jsc.nasa.gov/Collections/EarthFromSpace/photoinfo.pl?PHOTO=ISS027-E-34290).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Dune and interdune relief motivates a proposed aeolian terrain-access comparison.
Differences: Earth dune organization and unmeasured sediment composition are not equivalent to Bagnold basaltic sand or Martian winds. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Badain Jaran dune study area (`badain-jaran`)

Centre (longitude, latitude): 102.45, 39.83.
Study bbox: `[102.42099270906199, 39.80763921170886, 102.47898955342019, 39.85235479991958]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/badain-jaran/manifest.json); [elevation](../web/public/terrain/badain-jaran/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N39_00_E102_00_DEM/Copernicus_DSM_COG_10_N39_00_E102_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Southeastern sand-sea window within the dune-and-lake region; individual lake beds and mineral fractions are not mapped. [Evidence](https://whc.unesco.org/en/list/1638/).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Large dune relief supports a regional aeolian geometry comparison.
Differences: Stabilized mega-dunes and interdunal groundwater lakes differ from Bagnold; the DSM cannot establish migration or lake-floor topography. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Taklamakan interior dune study area (`taklamakan-interior`)

Centre (longitude, latitude): 83.2, 38.8.
Study bbox: `[83.17154864013172, 38.77772647408139, 83.22846822785318, 38.82226763986381]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/taklamakan-interior/manifest.json); [elevation](../web/public/terrain/taklamakan-interior/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N38_00_E083_00_DEM/Copernicus_DSM_COG_10_N38_00_E083_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Interior sand-sea window away from populated oasis margins; not representative of the entire Tarim Basin or a dune time series. [Evidence](https://science.nasa.gov/earth/earth-observatory/taklimakan-desert-1925/).

Proposed pairing: **Bagnold dune regional study area** (`bagnold`). Target context and limitations: Regional context around dunes; MOLA cannot resolve individual dune slipfaces. [Target evidence](https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/).

Pair-specific explanation (bagnold):
Matches: Aeolian dune-field relief supports a proposed surface-operations comparison.
Differences: Earth sand provenance, atmospheric density and dune mobility are not matched; coarse MOLA does not resolve equivalent dune slipfaces. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Lut western yardang study area (`lut-yardangs`)

Centre (longitude, latitude): 57.83, 30.53.
Study bbox: `[57.804648691046914, 30.508046934250956, 57.85536254194595, 30.551948406810908]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/lut-yardangs/manifest.json); [elevation](../web/public/terrain/lut-yardangs/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N30_00_E057_00_DEM/Copernicus_DSM_COG_10_N30_00_E057_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Western Lut kalut ridge-and-corridor window northeast of Shahdad; not the whole desert or a mineralogical transect. [Evidence](https://whc.unesco.org/en/list/1505/).

Proposed pairing: **Lucus Planum yardang study area** (`lucus-planum`). Target context and limitations: Sixteen-kilometre regional window centred on NASA THEMIS PIA24008 (187.227 E converted to -172.773 E). Imagery documents wind-eroded yardangs; coarse MOLA elevation cannot resolve individual ridges or demonstrate material equivalence. [Target evidence](https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/).

Pair-specific explanation (lucus-planum):
Matches: Wind-eroded ridges support a proposed yardang-process and terrain-access comparison.
Differences: Consolidated Earth basin deposits do not establish Lucus material composition or cementation; source resolution limits ridge-wall comparison. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Dunhuang yardang study area (`dunhuang-yardangs`)

Centre (longitude, latitude): 93.23, 40.5.
Study bbox: `[93.2014341264308, 40.47818315695645, 93.25858428799184, 40.521809818866345]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/dunhuang-yardangs/manifest.json); [elevation](../web/public/terrain/dunhuang-yardangs/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N40_00_E093_00_DEM/Copernicus_DSM_COG_10_N40_00_E093_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Ridge-field window west of Dunhuang in the nominated yardang area; reference is a tentative-list submission, not inscription or planetary validation. [Evidence](https://whc.unesco.org/en/tentativelists/5990).

Proposed pairing: **Lucus Planum yardang study area** (`lucus-planum`). Target context and limitations: Sixteen-kilometre regional window centred on NASA THEMIS PIA24008 (187.227 E converted to -172.773 E). Imagery documents wind-eroded yardangs; coarse MOLA elevation cannot resolve individual ridges or demonstrate material equivalence. [Target evidence](https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/).

Pair-specific explanation (lucus-planum):
Matches: Aeolian erosion of layered deposits supports a candidate yardang terrain comparison.
Differences: Terrestrial sediment history and local moisture differ; MOLA cannot validate individual ridge correspondence or equal mechanical strength. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Dallol salt-dome study area (`dallol`)

Centre (longitude, latitude): 40.3, 14.24.
Study bbox: `[40.277496563203975, 14.218046932013205, 40.322507735500125, 14.261951319381605]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/dallol/manifest.json); [elevation](../web/public/terrain/dallol/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N14_00_E040_00_DEM/Copernicus_DSM_COG_10_N14_00_E040_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Dallol salt dome and surrounding pan; regional weather does not measure vent or brine temperature, chemistry or crust strength. [Evidence](https://volcano.si.edu/volcano.cfm?vn=221041).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Salt deposition and altered basin terrain provide a limited geological-process comparison.
Differences: An active hydrothermal salt system is not a Jezero delta or a modern Martian thermal environment; no biological or chemical equivalence is established. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Lake Abbe eastern margin study area (`lake-abbe-margin`)

Centre (longitude, latitude): 41.84, 11.145.
Study bbox: `[41.817699764556565, 11.122976344389945, 41.86230351981937, 11.167022837223069]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/lake-abbe-margin/manifest.json); [elevation](../web/public/terrain/lake-abbe-margin/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N11_00_E041_00_DEM/Copernicus_DSM_COG_10_N11_00_E041_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Eastern lake-margin and salt-flat context; individual carbonate chimneys are below reliable DSM representation and lake surface is not bathymetry. [Evidence](https://www.esa.int/ESA_Multimedia/Images/2023/07/Earth_from_Space_Ethiopian_painting).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Basin-margin deposits and hydrothermal context motivate a limited geological-access comparison.
Differences: A modern saline lake with carbonate chimneys differs from Jezero delta history; no equivalent water, resources or biological interpretation follows. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Hverir Namafjall study area (`hverir-namafjall`)

Centre (longitude, latitude): -16.81, 65.64.
Study bbox: `[-16.863998259193945, 65.61771149473972, -16.75608911498658, 65.66227161939592]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/hverir-namafjall/manifest.json); [elevation](../web/public/terrain/hverir-namafjall/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N65_00_W017_00_DEM/Copernicus_DSM_COG_10_N65_00_W017_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Namafjall ridge and Hverir geothermal field with surrounding volcanic terrain; footprint exceeds the small vent field and does not measure spring chemistry. [Evidence](https://ust.is/library/Skrar/2005/Myvatn_enska.pdf).

Proposed pairing: **Jezero western delta study area** (`jezero`). Target context and limitations: Delta and surrounding crater floor; coarse DEM mixes geological units. [Target evidence](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/).

Pair-specific explanation (jezero):
Matches: Exposed altered volcanic surfaces motivate a candidate reconnaissance and sampling-operations comparison.
Differences: Modern terrestrial geothermal activity is not a delta or a measurement of Jezero hydrothermal conditions; spring temperatures cannot be inferred from regional weather. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.

## Pingualuit crater study area (`pingualuit`)

Centre (longitude, latitude): -73.66, 61.28.
Study bbox: `[-73.70592885196562, 61.2578734487334, -73.61400909283087, 61.3021123286018]`. Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.

Terrain: [manifest](../web/public/terrain/pingualuit/manifest.json); [elevation](../web/public/terrain/pingualuit/elevation.f32).
Source: [Copernicus GLO-30 tile](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N61_00_W074_00_DEM/Copernicus_DSM_COG_10_N61_00_W074_00_DEM.tif); [licence](../web/public/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf). Manifest and elevation SHA-256 checksums are in the catalog.

Interpretation: Candidate analog: selected 4.8 km study window. Crater rim, lake surface and surrounding tundra; the lake is not a modeled crater floor and seasonal ice/snow can alter surface returns. [Evidence](https://www.nunavikparks.ca/en/parks/pingualuit/).

Proposed pairing: **Shackleton northern rim study area** (`shackleton-rim`). Target context and limitations: Rim neighbourhood, not entire crater or a verified landing site. Ice evidence is regional, not confirmed within this footprint. [Target evidence](https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/).

Pair-specific explanation (shackleton-rim):
Matches: Impact-generated rim relief offers a proposed crater-access comparison.
Differences: A water-filled terrestrial crater differs from a lunar polar rim; the grid contains no lake bathymetry, mapped ice thickness or matched lunar illumination. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Limitations: Morphology and substrate are area interpretations, not pixel classifications or soil mechanics. No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.

Unknown feature measurements: .

Friction, cohesion and bulk density are not inferred from substrate. Environmental values retain their modeled/observed status, resolution and time coverage in the catalog; annual wind magnitudes are not wind vectors.
