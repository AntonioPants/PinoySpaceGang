# Earth–planetary pairing audit

Rebuild with `python -m scripts.catalog.refresh_metadata`, then `python -m scripts.catalog.accuracy`.

Scores below are regional terrain similarity on a 0–1 scale, **not accuracy percentages**. There is no independent ground-truth validation. See PAIRING_ACCURACY.md for the method and limitations.

| Earth analog | Target | Recomputed score | Shifted-window range | Features reproduce |
|---|---|---:|---|---|
| meteor-crater | shackleton-rim | 0.554145 | 0.502934–0.613751 | True |
| badwater | jezero | 0.854737 | 0.853075–0.854869 | True |
| barrow-observatory | phoenix | 0.939824 | 0.936142–0.943171 | True |
| kilbourne-hole-v1 | shackleton-rim | 0.645536 | 0.591351–0.700077 | True |
| kilbourne-hole-v1 | arsia-flank | 0.893899 | 0.869329–0.914812 | True |
| craters-moon | arsia-flank | 0.903959 | 0.8972–0.922162 | True |
| craters-moon | marius-hills | 0.920694 | 0.911703–0.942667 | True |
| lava-beds | marius-hills | 0.822354 | 0.808345–0.842712 | True |
| lava-beds | arsia-flank | 0.805619 | 0.793842–0.822207 | True |
| amboy | arsia-flank | 0.994808 | 0.988835–0.998189 | True |
| white-sands | bagnold | 0.748415 | 0.724541–0.771998 | True |
| capitol-reef | jezero | 0.981894 | 0.978017–0.988393 | True |
| haughton | shackleton-rim | 0.552238 | 0.514032–0.585233 | True |
| qaidam | lucus-planum | 0.967607 | 0.954804–0.979801 | True |
| cima-lava-field | marius-hills | 0.871676 | 0.854611–0.887376 | True |
| cima-lava-field | arsia-flank | 0.854942 | 0.840107–0.86687 | True |
| sunset-crater | marius-hills | 0.850393 | 0.8209–0.869729 | True |
| sunset-crater | arsia-flank | 0.833659 | 0.806396–0.849224 | True |
| great-sand-dunes | bagnold | 0.953359 | 0.910487–0.980659 | True |
| bisti-badlands | jezero | 0.905361 | 0.902075–0.908597 | True |
| lanzarote-timanfaya | marius-hills | 0.944185 | 0.931288–0.955397 | True |
| lanzarote-timanfaya | arsia-flank | 0.927451 | 0.916784–0.934892 | True |
| askja-east | arsia-flank | 0.742334 | 0.723981–0.759319 | True |
| askja-east | marius-hills | 0.759068 | 0.738485–0.779825 | True |
| atacama-yungay | jezero | 0.951968 | 0.918065–0.990931 | True |
| sossusvlei-dunes | bagnold | 0.928 | 0.858309–0.96648 | True |
| lonar-crater | shackleton-rim | 0.627426 | 0.586806–0.670179 | True |
| wolfe-creek | shackleton-rim | 0.514878 | 0.479594–0.547507 | True |
| wadi-rum | jezero | 0.843129 | 0.82914–0.856934 | True |
| richat-ridges | lucus-planum | 0.930684 | 0.927628–0.935518 | True |
| harrat-khaybar | marius-hills | 0.847194 | 0.823494–0.861433 | True |
| harrat-khaybar | arsia-flank | 0.83046 | 0.808991–0.840928 | True |
| payun-matru | arsia-flank | 0.613776 | 0.601721–0.624806 | True |
| payun-matru | marius-hills | 0.63051 | 0.616225–0.645311 | True |
| tongariro-west | arsia-flank | 0.682316 | 0.605267–0.739973 | True |
| erg-chebbi | bagnold | 0.861771 | 0.819095–0.894657 | True |
| teide-canadas | marius-hills | 0.04806 | 0.0–0.116944 | True |
| etna-east | arsia-flank | 0.154883 | 0.101172–0.231033 | True |
| fournaise-enclos | arsia-flank | 0.004128 | 0.0–0.020464 | True |
| fogo-caldera | marius-hills | 0.110329 | 0.063402–0.11821 | True |
| bromo-sandsea | marius-hills | 0.624603 | 0.603831–0.65993 | True |
| pinacate-elegante | arsia-flank | 0.627851 | 0.601828–0.650223 | True |
| bardenas-blanca | jezero | 0.875959 | 0.873503–0.878936 | True |
| tabernas-badlands | jezero | 0.812185 | 0.806624–0.820756 | True |
| ischigualasto | jezero | 0.977564 | 0.967089–0.987342 | True |
| talampaya-canyon | jezero | 0.901411 | 0.872841–0.909904 | True |
| valle-luna-chile | jezero | 0.972566 | 0.949018–0.991162 | True |
| uyuni-incahuasi | jezero | 0.860243 | 0.857487–0.862233 | True |
| makgadikgadi-kubu | jezero | 0.85821 | 0.855776–0.859422 | True |
| tsondab-dunes | bagnold | 0.846954 | 0.815794–0.875877 | True |
| rub-khali-oman | bagnold | 0.80695 | 0.773123–0.843047 | True |
| badain-jaran | bagnold | 0.887329 | 0.859831–0.928524 | True |
| taklamakan-interior | bagnold | 0.800228 | 0.770162–0.826076 | True |
| lut-yardangs | lucus-planum | 0.978364 | 0.976125–0.980566 | True |
| dunhuang-yardangs | lucus-planum | 0.989595 | 0.987354–0.99424 | True |
| dallol | jezero | 0.916105 | 0.909429–0.918544 | True |
| lake-abbe-margin | jezero | 0.855443 | 0.852916–0.856636 | True |
| hverir-namafjall | jezero | 0.990887 | 0.96819–0.994546 | True |
| pingualuit | shackleton-rim | 0.667467 | 0.622705–0.700591 | True |

## meteor-crater → shackleton-rim

Matches: Both are impact-landform study areas; crater-related relief supports slope and approach-planning experiments.

Differences: Meteor includes a bowl/ejecta neighbourhood, while this Shackleton crop samples a rim. Terrestrial sedimentary rock, atmosphere and erosion differ from lunar regolith, vacuum and polar illumination.

Evidence: https://www.usgs.gov/centers/astrogeology-science-center/science/meteor-crater-sample-collection; https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/

## badwater → jezero

Matches: Both provide a basin/sedimentary context relevant to interpreting past water and contrasting flat deposits with surrounding relief.

Differences: Badwater evaporite playa is not a Jezero delta replica; mineral mixtures and depositional histories are not established as equivalent. Modern terrestrial heat, groundwater and salt-crust mechanics do not reproduce current Martian conditions.

Evidence: https://doi.org/10.1029/2004JE002315; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## barrow-observatory → phoenix

Matches: Ice-rich periglacial ground and polygonal surface processes motivate a northern-plains operations comparison.

Differences: Vegetation, seasonal thaw and liquid water at Barrow differ from Mars. Thirty-metre DSM and coarse MOLA do not resolve equivalent polygon geometry, ice depth or bearing strength.

Evidence: https://tc.copernicus.org/articles/20/265/2026/tc-20-265-2026.html; https://science.nasa.gov/mission/phoenix/

## kilbourne-hole-v1 → shackleton-rim

Matches: Depression walls, slopes and surrounding relief provide a limited terrain-operations comparison.

Differences: Kilbourne is a volcanic maar; Shackleton is an impact crater. Their formation mechanisms and materials are different. The Kilbourne basin crop is not a lunar rim or thermal/polar-shadow analog.

Evidence: https://science.nasa.gov/blogs/notes-from-the-field/2018/01/24/kilbourne-and-aden-two-flavors-of-volcanism/; https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/

## kilbourne-hole-v1 → arsia-flank

Matches: Volcanic context and exposed rocky relief support a proposed volcanic-terrain operations comparison.

Differences: A localized maar and a large shield-volcano flank have different eruption mechanisms, dimensions and landform geometry. Shared broad basalt labels do not establish identical rock fractions, soil mechanics, atmosphere or temperature.

Evidence: https://science.nasa.gov/blogs/notes-from-the-field/2018/01/24/kilbourne-and-aden-two-flavors-of-volcanism/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## craters-moon → arsia-flank

Matches: Lava-flow/vent terrain and broad basaltic context support volcanic surface-operations comparisons.

Differences: Flow ages, textures, weathering and vegetation differ; the Martian crop does not resolve individual lava obstacles. Neither local friction nor plume response follows from the basalt label.

Evidence: https://www.nps.gov/crmo/learn/nature/geologicactivity.htm; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## craters-moon → marius-hills

Matches: Volcanic lava and vent context motivates comparing routes and relief in volcanic landscapes.

Differences: Earth surface alteration and vegetation differ from airless lunar regolith cover. Coarse lunar elevation and this Earth crop do not establish matched vents, pits or cave geometry.

Evidence: https://www.nps.gov/crmo/learn/nature/geologicactivity.htm; https://www.lroc.asu.edu/posts/230

## lava-beds → marius-hills

Matches: Volcanic surfaces associated regionally with lava-tube/pit investigations motivate a surface-access comparison.

Differences: Surface DEMs contain no cave interior, roof thickness or verified traversable passage. Terrestrial weathering, atmosphere and cave access differ from the lunar environment; a surface comparison does not validate a shelter.

Evidence: https://www.nps.gov/labe/learn/nature/geology.htm; https://www.lroc.asu.edu/posts/230

## lava-beds → arsia-flank

Matches: Volcanic terrain and regional interest in subsurface voids motivate surface reconnaissance comparisons.

Differences: An Earth lava-tube landscape is not evidence for a cave within the selected Arsia crop. Neither DEM resolves voids, roofs or fine obstacles; atmospheric and material-mechanics equivalence is unestablished.

Evidence: https://www.nps.gov/labe/learn/nature/geology.htm; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## amboy → arsia-flank

Matches: Volcanic cone/flow context and broad basaltic interpretation offer a volcanic-terrain comparison.

Differences: Amboy cinder-cone terrain differs from the regional shield-volcano flank crop. Cinder grain sizes, obstacle abundance and strength are not matched by a coarse DEM or a shared substrate label.

Evidence: https://www.blm.gov/visit/amboy-crater-national-natural-landmark; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## white-sands → bagnold

Matches: Wind-transported dunes motivate comparing aeolian landform organization and operations on granular slopes.

Differences: White Sands gypsum differs from Bagnold basaltic sand; cohesion, density and optical properties cannot be transferred directly. MOLA does not resolve Bagnold dune slipfaces at the Earth DSM scale; wind and gravity differ.

Evidence: https://www.nps.gov/whsa/learn/gypsum.htm; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## capitol-reef → jezero

Matches: Exposed sedimentary relief and erosion provide a hypothesis for comparing terrain access to layered deposits.

Differences: Capitol Reef is not a demonstrated Jezero delta analog; lithology and depositional histories require independent comparison. Regional slope/relief similarity cannot validate sediment provenance, resources or landing safety.

Evidence: https://www.nps.gov/care/learn/nature/geology.htm; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## haughton → shackleton-rim

Matches: Impact-generated terrain and local relief offer a proposed operations/terrain comparison.

Differences: The Haughton crop samples floor context; the target crop samples a Shackleton rim neighbourhood. Earth atmosphere, seasonal water, weathering and illumination differ from lunar polar conditions; whole-crater equivalence is not established.

Evidence: https://ntrs.nasa.gov/citations/20060013129; https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/

## qaidam → lucus-planum

Matches: Published Qaidam field work and NASA THEMIS imagery document wind-eroded ridges (yardangs), motivating an aeolian-erosion process comparison.

Differences: Qaidam field coordinates and the Lucus THEMIS image centre define separate study windows, not a measured one-to-one ridge correspondence. Local Martian lithology is unresolved; terrestrial sedimentary material does not establish identical cementation or strength. The roughly 463 m MOLA source cannot resolve individual yardang walls or validate crest spacing; atmosphere, gravity and erosional histories differ.

Evidence: https://doi.org/10.1029/2018JE005719; https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/

## cima-lava-field → marius-hills

Matches: Basaltic volcanic surfaces and regional lava-tube interest motivate surface-route comparison.

Differences: This surface DSM does not represent a cave interior or establish lunar shelter stability. Desert alteration, atmosphere and cinder-cone context differ from airless lunar volcanic terrain.

Evidence: https://www.nps.gov/places/the-lava-tube-at-mojave.htm; https://www.lroc.asu.edu/posts/230

## cima-lava-field → arsia-flank

Matches: Volcanic flow relief supports a proposed surface-access comparison.

Differences: Small terrestrial vents differ in scale and eruption history from a Martian shield-volcano flank. Cave occurrence, regolith strength and rock abundance are not transferable from these elevation grids.

Evidence: https://www.nps.gov/places/the-lava-tube-at-mojave.htm; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## sunset-crater → marius-hills

Matches: Volcanic cone and lava-flow context motivates comparing routes and terrain relief.

Differences: Forests, recent terrestrial surface processes and cinders differ from lunar regolith and vacuum. The study crops do not establish corresponding vents or cave structures.

Evidence: https://www.nps.gov/articles/nps-geodiversity-atlas-sunset-crater-volcano-national-monument-arizona.htm; https://www.lroc.asu.edu/posts/230

## sunset-crater → arsia-flank

Matches: Basaltic lava landscapes support a proposed volcanic surface-operations comparison.

Differences: Sunset is a localized cinder cone with flows, not a shield-volcano flank of equivalent scale. Vegetation affects the Earth DSM; geological age, atmosphere and material mechanics are not matched.

Evidence: https://www.nps.gov/articles/nps-geodiversity-atlas-sunset-crater-volcano-national-monument-arizona.htm; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## great-sand-dunes → bagnold

Matches: Aeolian dune landforms motivate a comparison of regional relief and terrain access.

Differences: The mixed terrestrial mineral assemblage is not established as equivalent to Bagnold basaltic sand. Water-mediated sand supply, wind regime and gravity differ; coarse MOLA cannot resolve equivalent slipfaces or migration.

Evidence: https://www.nps.gov/grsa/learn/nature/volcanic-origins-of-great-sand-dunes.htm; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## bisti-badlands → jezero

Matches: Eroded layered sedimentary terrain offers a candidate operations comparison for access to exposed strata.

Differences: Bisti badlands are not a verified Jezero delta replica; depositional history and lithology differ. Terrestrial fossils and weathering have no demonstrated biological or environmental counterpart at Jezero; hoodoos are unresolved by coarse planetary DEMs.

Evidence: https://www.blm.gov/programs/national-conservation-lands/new-mexico/bisti-de-na-zin-wilderness; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## lanzarote-timanfaya → marius-hills

Matches: Basaltic volcanic surfaces support a proposed regional flow-relief and geological-operations comparison; ESA uses Lanzarote for planetary training.

Differences: This selected window is not the documented training traverse or a measured one-to-one lunar flow match. Earth atmosphere and surface alteration differ from lunar regolith; surface elevation contains no cave interiors.

Evidence: https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_Pangaea/Lanzarote_and_ESA_united_by_space; https://www.lroc.asu.edu/posts/230

## lanzarote-timanfaya → arsia-flank

Matches: Volcanic terrain motivates a candidate route-planning comparison between exposed flow landscapes.

Differences: Lanzarote vents and flows differ in scale and geological history from the Arsia shield-volcano flank. Shared volcanic context does not establish matched temperatures, rock abundance or contact mechanics.

Evidence: https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_Pangaea/Lanzarote_and_ESA_united_by_space; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## askja-east → arsia-flank

Matches: Volcanic surface relief and lava/tephra context motivate a regional volcanic-operations comparison.

Differences: Askja is a central volcanic system influenced by terrestrial glacial and weather processes, not an equivalent Martian shield flank. Local material fractions, snow state and fine volcanic obstacles are not established from this DSM.

Evidence: https://www.vatnajokulsthjodgardur.is/en/areas/askja/askja-eldstod; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## askja-east → marius-hills

Matches: Volcanic surface geometry provides a candidate terrain-access comparison.

Differences: The exact study window is not a documented lunar geological equivalent; its lava and tephra mixtures remain unquantified. Seasonal snow, water and atmosphere differ from lunar vacuum and regolith; subsurface shelters are not represented.

Evidence: https://www.vatnajokulsthjodgardur.is/en/areas/askja/askja-eldstod; https://www.lroc.asu.edu/posts/230

## atacama-yungay → jezero

Matches: NASA describes Yungay as an arid Mars-analog environment; exposed dry surfaces motivate an operational and preservation-context comparison.

Differences: The chosen Yungay window is not a delta replica or a relocation of a published sampling plot. Aridity alone does not match Jezero depositional history, current temperature, atmosphere, chemistry or evidence of life.

Evidence: https://ahed.nasa.gov/about/about-image?id=4; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## sossusvlei-dunes → bagnold

Matches: Dune-field relief and wind-shaped sedimentary landforms motivate a regional aeolian comparison.

Differences: Sossusvlei pans, ephemeral water and coastal-desert fog differ from the Martian dune environment. Earth mineral proportions and grain mechanics are not established as equivalent to Bagnold basaltic sand; MOLA cannot resolve matching slipfaces.

Evidence: https://science.nasa.gov/earth/earth-observatory/namib-sand-sea-149130/; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## lonar-crater → shackleton-rim

Matches: Impact-generated rim and basin relief support a proposed crater-operations comparison; NASA documents Lonar as an impact into basalt.

Differences: Lonar includes a saline lake and vegetation; its DSM does not provide lake-floor bathymetry or certify traversable ground. The Earth bowl and surrounding basalt differ from the Shackleton polar rim footprint, lunar materials, gravity and illumination.

Evidence: https://science.nasa.gov/earth/earth-observatory/lonar-crater-india-8654/; https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/

## wolfe-creek → shackleton-rim

Matches: Preserved impact-rim and basin relief motivate a regional crater-access comparison.

Differences: A small terrestrial crater with infill and vegetation is not equivalent to the selected lunar rim footprint. Local material composition, polar shadow, ice abundance and landing safety are not established as equivalent.

Evidence: https://science.nasa.gov/earth/earth-observatory/wolfe-creek-crater-8488/; https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/

## wadi-rum → jezero

Matches: Exposed rock relief and sediment-filled desert valleys motivate a candidate traverse and outcrop-access comparison.

Differences: Wadi Rum sandstone/granite mountains and sand valleys are not a Jezero delta replica or matched depositional sequence. Shared desert appearance does not establish matched mineralogy, atmosphere, temperatures or soil mechanics.

Evidence: https://science.nasa.gov/earth/earth-observatory/wadi-rum-jordan-49945/; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## richat-ridges → lucus-planum

Matches: Erosion-resistant ridges and intervening low ground motivate a candidate regional terrain-access comparison.

Differences: Richat cuestas expose an eroded geological dome; Lucus Planum yardangs are not the same landform or structural history. Richat is not an impact crater. Mixed Earth rock types do not establish Martian material composition; the coarse planetary DEM cannot resolve individual ridge walls.

Evidence: https://science.nasa.gov/earth/earth-observatory/eyeing-the-richat-structure/; https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/

## harrat-khaybar → marius-hills

Matches: Volcanic flows and vents support a proposed surface-relief and route-planning comparison.

Differences: The terrestrial field includes silicic and pyroclastic as well as basaltic material; a uniform lunar basalt equivalent is unestablished. Earth alteration and atmosphere differ from lunar regolith and vacuum; surface grids do not model caves or wheel-scale hazards.

Evidence: https://science.nasa.gov/earth/earth-observatory/harrat-khaybar-volcanic-field-8650/; https://www.lroc.asu.edu/posts/230

## harrat-khaybar → arsia-flank

Matches: Regional volcanic surface relief provides a proposed comparison for operations over flow landscapes.

Differences: A terrestrial field of cones and domes differs in scale and eruption history from the Arsia shield flank. Local rock fractions and mechanical properties are unmeasured; a terrain score does not validate environmental equivalence.

Evidence: https://science.nasa.gov/earth/earth-observatory/harrat-khaybar-volcanic-field-8650/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## payun-matru → arsia-flank

Matches: Shield-volcano flank context supports a proposed regional relief and approach-planning comparison.

Differences: The small western Payun window is not the whole shield; planetary dimensions, geological history and gravity differ. Local volcanic composition, weathering and mechanical strength are not established as equivalent to Arsia basalt.

Evidence: https://science.nasa.gov/earth/earth-observatory/payun-volcanic-field-80017/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## payun-matru → marius-hills

Matches: Volcanic surface relief supports a candidate terrain-access comparison.

Differences: A terrestrial shield flank differs from the Marius volcanic-plain footprint and does not reproduce lunar vents or pits. The selected Earth material mixture is unmapped; neither source resolves cave interiors, shelter safety or lunar regolith mechanics.

Evidence: https://science.nasa.gov/earth/earth-observatory/payun-volcanic-field-80017/; https://www.lroc.asu.edu/posts/230

## tongariro-west → arsia-flank

Matches: Volcanic mountain relief offers a candidate operations comparison across elevated volcanic terrain.

Differences: Tongariro regional andesitic volcanism differs from the basaltic Martian shield setting; local material fractions are not mapped. Terrestrial snow, vegetation, water and active-volcano processes differ from Mars; the surface model supplies no field-access or hazard approval.

Evidence: https://www.doc.govt.nz/parks-and-recreation/places-to-go/central-north-island/places/tongariro-national-park/about-tongariro-national-park/central-north-island-volcanoes/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## erg-chebbi → bagnold

Matches: Wind-shaped dune relief motivates a regional aeolian terrain comparison.

Differences: Erg Chebbi star-dune organization and unmeasured sand composition are not established as equivalents of Bagnold basaltic dunes. Rain-fed shallow aquifers and Earth wind/gravity differ from Mars; coarse MOLA does not resolve equivalent slipfaces or dune migration.

Evidence: https://science.nasa.gov/earth/earth-observatory/the-shallow-aquifers-of-erg-chebbi-89181/; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## teide-canadas → marius-hills

Matches: Volcanic floor and flow-related relief offer a candidate surface-access comparison.

Differences: A terrestrial caldera complex with varied volcanic rocks is not a lunar volcanic plain or pit reconstruction. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/tenerife-canary-islands-88659/; https://www.lroc.asu.edu/posts/230

## etna-east → arsia-flank

Matches: Volcanic flank relief supports an engineering comparison of gradients and terrain access.

Differences: Etna is a terrestrial stratovolcano; its collapse valley, eruption history and scale differ from the Arsia shield flank. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/mount-etna-erupts-15782/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## fournaise-enclos → arsia-flank

Matches: Shield-volcano flow terrain supports a proposed regional surface-operations comparison.

Differences: Active terrestrial lava and steep local relief do not reproduce Martian eruption ages, weathering or shield dimensions. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/piton-de-la-fournaise-volcano-18211/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## fogo-caldera → marius-hills

Matches: Volcanic cone and flow relief motivate a limited terrain-access comparison.

Differences: This volcanic depression is not an impact crater or a lunar pit; settlements and post-acquisition lava can affect the Earth surface. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/fire-island-cabo-verde-148613/; https://www.lroc.asu.edu/posts/230

## bromo-sandsea → marius-hills

Matches: Contrasting volcanic cone and floor relief provides a candidate operations comparison.

Differences: Bromo is a terrestrial volcanic caldera setting, not an impact crater or a lunar basalt/regolith equivalent. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/gunung-bromo-indonesia-5062/; https://www.lroc.asu.edu/posts/230

## pinacate-elegante → arsia-flank

Matches: Volcanic desert relief supports a candidate reconnaissance and route-planning comparison.

Differences: A localized volcanic maar is not an impact crater or an equivalent Martian shield flank; formation process and dimensions differ. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://whc.unesco.org/en/list/1410/; https://science.nasa.gov/solar-system/planets/mars/nasa-orbiter-finds-possible-cave-skylights-on-mars/

## bardenas-blanca → jezero

Matches: Eroded sedimentary exposures motivate a candidate outcrop-access comparison.

Differences: Terrestrial badland drainage and strata are not a Jezero delta reconstruction; local clay fractions and strength remain unmeasured. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://www.unesco.org/en/mab/bardenas-reales; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## tabernas-badlands → jezero

Matches: Dry gullies and exposed sediments offer an outcrop and rover-operations comparison.

Differences: Flash-flood erosion in Earth sedimentary terrain does not reproduce Jezero delta deposition or present Martian environmental conditions. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://www.juntadeandalucia.es/medioambiente/portal/en/web/ventanadelvisitante/detalle-buscador-mapa/-/asset_publisher/Jlbxh2qB3NwR/content/desierto-de-tabernas/255035; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## ischigualasto → jezero

Matches: Layered sedimentary exposure and eroded relief support a candidate geological-access comparison.

Differences: Earth Triassic strata and fossils do not establish Martian depositional equivalence or evidence of life at Jezero. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://whc.unesco.org/en/list/966; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## talampaya-canyon → jezero

Matches: Sedimentary cliffs and access through relief offer a candidate terrain-operations comparison.

Differences: A deeply eroded terrestrial canyon is not a delta; wall geometry, fossils and depositional history are not matched to Jezero. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://whc.unesco.org/en/list/966; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## valle-luna-chile → jezero

Matches: Dry exposed basin-related terrain motivates a candidate reconnaissance comparison.

Differences: Salt-range relief and terrestrial erosion do not establish an equivalent Jezero delta or matched Martian mineral inventory. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://simbio.mma.gob.cl/CbaAP/VistaImpresion/1053; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## uyuni-incahuasi → jezero

Matches: Closed-basin salt deposits and local relief offer a limited basin-exploration comparison.

Differences: An evaporitic playa with a rock island is not a delta replica; seasonal flooding and salt-crust mechanics differ from Mars. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/salar-de-uyuni-bolivia-6096/; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## makgadikgadi-kubu → jezero

Matches: Dry lake-basin surfaces and isolated relief motivate a candidate basin-operations comparison.

Differences: Seasonal inundation, vegetation and terrestrial salts do not establish Jezero delta geometry or comparable bearing strength. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://modis.gsfc.nasa.gov/gallery/individual.php?db_date=2026-02-05; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## tsondab-dunes → bagnold

Matches: Wind-shaped dune relief provides a regional aeolian comparison.

Differences: River termination and terrestrial moisture differ from Bagnold; sand composition, dune migration and equivalent slipfaces are unmeasured. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://esrs.jsc.nasa.gov/SearchPhotos/photo.pl?frame=23405&mission=ISS047&roll=E; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## rub-khali-oman → bagnold

Matches: Dune and interdune relief motivates a proposed aeolian terrain-access comparison.

Differences: Earth dune organization and unmeasured sediment composition are not equivalent to Bagnold basaltic sand or Martian winds. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://eol.jsc.nasa.gov/Collections/EarthFromSpace/photoinfo.pl?PHOTO=ISS027-E-34290; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## badain-jaran → bagnold

Matches: Large dune relief supports a regional aeolian geometry comparison.

Differences: Stabilized mega-dunes and interdunal groundwater lakes differ from Bagnold; the DSM cannot establish migration or lake-floor topography. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://whc.unesco.org/en/list/1638/; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## taklamakan-interior → bagnold

Matches: Aeolian dune-field relief supports a proposed surface-operations comparison.

Differences: Earth sand provenance, atmospheric density and dune mobility are not matched; coarse MOLA does not resolve equivalent dune slipfaces. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://science.nasa.gov/earth/earth-observatory/taklimakan-desert-1925/; https://science.nasa.gov/blog/recap-of-the-bagnold-dune-investigation/

## lut-yardangs → lucus-planum

Matches: Wind-eroded ridges support a proposed yardang-process and terrain-access comparison.

Differences: Consolidated Earth basin deposits do not establish Lucus material composition or cementation; source resolution limits ridge-wall comparison. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://whc.unesco.org/en/list/1505/; https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/

## dunhuang-yardangs → lucus-planum

Matches: Aeolian erosion of layered deposits supports a candidate yardang terrain comparison.

Differences: Terrestrial sediment history and local moisture differ; MOLA cannot validate individual ridge correspondence or equal mechanical strength. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://whc.unesco.org/en/tentativelists/5990; https://www.jpl.nasa.gov/images/pia24008-lucus-planum-yardangs/

## dallol → jezero

Matches: Salt deposition and altered basin terrain provide a limited geological-process comparison.

Differences: An active hydrothermal salt system is not a Jezero delta or a modern Martian thermal environment; no biological or chemical equivalence is established. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://volcano.si.edu/volcano.cfm?vn=221041; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## lake-abbe-margin → jezero

Matches: Basin-margin deposits and hydrothermal context motivate a limited geological-access comparison.

Differences: A modern saline lake with carbonate chimneys differs from Jezero delta history; no equivalent water, resources or biological interpretation follows. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://www.esa.int/ESA_Multimedia/Images/2023/07/Earth_from_Space_Ethiopian_painting; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## hverir-namafjall → jezero

Matches: Exposed altered volcanic surfaces motivate a candidate reconnaissance and sampling-operations comparison.

Differences: Modern terrestrial geothermal activity is not a delta or a measurement of Jezero hydrothermal conditions; spring temperatures cannot be inferred from regional weather. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://ust.is/library/Skrar/2005/Myvatn_enska.pdf; https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/

## pingualuit → shackleton-rim

Matches: Impact-generated rim relief offers a proposed crater-access comparison.

Differences: A water-filled terrestrial crater differs from a lunar polar rim; the grid contains no lake bathymetry, mapped ice thickness or matched lunar illumination. A regional terrain comparison does not establish matched atmosphere, gravity, soil mechanics or landing safety.

Evidence: https://www.nunavikparks.ca/en/parks/pingualuit/; https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/
