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
