"""Explicit scientific scope for proposed comparisons; never validated equivalence."""
from .global_sites import NOTES as GLOBAL_NOTES
NOTES = {
    ('wadi-rum', 'jezero'): (
        ['Exposed rock relief and sediment-filled desert valleys motivate a candidate traverse and outcrop-access comparison.'],
        ['Wadi Rum sandstone/granite mountains and sand valleys are not a Jezero delta replica or matched depositional sequence.', 'Shared desert appearance does not establish matched mineralogy, atmosphere, temperatures or soil mechanics.']),
    ('richat-ridges', 'lucus-planum'): (
        ['Erosion-resistant ridges and intervening low ground motivate a candidate regional terrain-access comparison.'],
        ['Richat cuestas expose an eroded geological dome; Lucus Planum yardangs are not the same landform or structural history.', 'Richat is not an impact crater. Mixed Earth rock types do not establish Martian material composition; the coarse planetary DEM cannot resolve individual ridge walls.']),
    ('harrat-khaybar', 'marius-hills'): (
        ['Volcanic flows and vents support a proposed surface-relief and route-planning comparison.'],
        ['The terrestrial field includes silicic and pyroclastic as well as basaltic material; a uniform lunar basalt equivalent is unestablished.', 'Earth alteration and atmosphere differ from lunar regolith and vacuum; surface grids do not model caves or wheel-scale hazards.']),
    ('harrat-khaybar', 'arsia-flank'): (
        ['Regional volcanic surface relief provides a proposed comparison for operations over flow landscapes.'],
        ['A terrestrial field of cones and domes differs in scale and eruption history from the Arsia shield flank.', 'Local rock fractions and mechanical properties are unmeasured; a terrain score does not validate environmental equivalence.']),
    ('payun-matru', 'arsia-flank'): (
        ['Shield-volcano flank context supports a proposed regional relief and approach-planning comparison.'],
        ['The small western Payun window is not the whole shield; planetary dimensions, geological history and gravity differ.', 'Local volcanic composition, weathering and mechanical strength are not established as equivalent to Arsia basalt.']),
    ('payun-matru', 'marius-hills'): (
        ['Volcanic surface relief supports a candidate terrain-access comparison.'],
        ['A terrestrial shield flank differs from the Marius volcanic-plain footprint and does not reproduce lunar vents or pits.', 'The selected Earth material mixture is unmapped; neither source resolves cave interiors, shelter safety or lunar regolith mechanics.']),
    ('tongariro-west', 'arsia-flank'): (
        ['Volcanic mountain relief offers a candidate operations comparison across elevated volcanic terrain.'],
        ['Tongariro regional andesitic volcanism differs from the basaltic Martian shield setting; local material fractions are not mapped.', 'Terrestrial snow, vegetation, water and active-volcano processes differ from Mars; the surface model supplies no field-access or hazard approval.']),
    ('erg-chebbi', 'bagnold'): (
        ['Wind-shaped dune relief motivates a regional aeolian terrain comparison.'],
        ['Erg Chebbi star-dune organization and unmeasured sand composition are not established as equivalents of Bagnold basaltic dunes.', 'Rain-fed shallow aquifers and Earth wind/gravity differ from Mars; coarse MOLA does not resolve equivalent slipfaces or dune migration.']),
    ('lanzarote-timanfaya', 'marius-hills'): (
        ['Basaltic volcanic surfaces support a proposed regional flow-relief and geological-operations comparison; ESA uses Lanzarote for planetary training.'],
        ['This selected window is not the documented training traverse or a measured one-to-one lunar flow match.', 'Earth atmosphere and surface alteration differ from lunar regolith; surface elevation contains no cave interiors.']),
    ('lanzarote-timanfaya', 'arsia-flank'): (
        ['Volcanic terrain motivates a candidate route-planning comparison between exposed flow landscapes.'],
        ['Lanzarote vents and flows differ in scale and geological history from the Arsia shield-volcano flank.', 'Shared volcanic context does not establish matched temperatures, rock abundance or contact mechanics.']),
    ('askja-east', 'arsia-flank'): (
        ['Volcanic surface relief and lava/tephra context motivate a regional volcanic-operations comparison.'],
        ['Askja is a central volcanic system influenced by terrestrial glacial and weather processes, not an equivalent Martian shield flank.', 'Local material fractions, snow state and fine volcanic obstacles are not established from this DSM.']),
    ('askja-east', 'marius-hills'): (
        ['Volcanic surface geometry provides a candidate terrain-access comparison.'],
        ['The exact study window is not a documented lunar geological equivalent; its lava and tephra mixtures remain unquantified.', 'Seasonal snow, water and atmosphere differ from lunar vacuum and regolith; subsurface shelters are not represented.']),
    ('atacama-yungay', 'jezero'): (
        ['NASA describes Yungay as an arid Mars-analog environment; exposed dry surfaces motivate an operational and preservation-context comparison.'],
        ['The chosen Yungay window is not a delta replica or a relocation of a published sampling plot.', 'Aridity alone does not match Jezero depositional history, current temperature, atmosphere, chemistry or evidence of life.']),
    ('sossusvlei-dunes', 'bagnold'): (
        ['Dune-field relief and wind-shaped sedimentary landforms motivate a regional aeolian comparison.'],
        ['Sossusvlei pans, ephemeral water and coastal-desert fog differ from the Martian dune environment.', 'Earth mineral proportions and grain mechanics are not established as equivalent to Bagnold basaltic sand; MOLA cannot resolve matching slipfaces.']),
    ('lonar-crater', 'shackleton-rim'): (
        ['Impact-generated rim and basin relief support a proposed crater-operations comparison; NASA documents Lonar as an impact into basalt.'],
        ['Lonar includes a saline lake and vegetation; its DSM does not provide lake-floor bathymetry or certify traversable ground.', 'The Earth bowl and surrounding basalt differ from the Shackleton polar rim footprint, lunar materials, gravity and illumination.']),
    ('wolfe-creek', 'shackleton-rim'): (
        ['Preserved impact-rim and basin relief motivate a regional crater-access comparison.'],
        ['A small terrestrial crater with infill and vegetation is not equivalent to the selected lunar rim footprint.', 'Local material composition, polar shadow, ice abundance and landing safety are not established as equivalent.']),
    ('cima-lava-field', 'marius-hills'): (
        ['Basaltic volcanic surfaces and regional lava-tube interest motivate surface-route comparison.'],
        ['This surface DSM does not represent a cave interior or establish lunar shelter stability.', 'Desert alteration, atmosphere and cinder-cone context differ from airless lunar volcanic terrain.']),
    ('cima-lava-field', 'arsia-flank'): (
        ['Volcanic flow relief supports a proposed surface-access comparison.'],
        ['Small terrestrial vents differ in scale and eruption history from a Martian shield-volcano flank.', 'Cave occurrence, regolith strength and rock abundance are not transferable from these elevation grids.']),
    ('sunset-crater', 'marius-hills'): (
        ['Volcanic cone and lava-flow context motivates comparing routes and terrain relief.'],
        ['Forests, recent terrestrial surface processes and cinders differ from lunar regolith and vacuum.', 'The study crops do not establish corresponding vents or cave structures.']),
    ('sunset-crater', 'arsia-flank'): (
        ['Basaltic lava landscapes support a proposed volcanic surface-operations comparison.'],
        ['Sunset is a localized cinder cone with flows, not a shield-volcano flank of equivalent scale.', 'Vegetation affects the Earth DSM; geological age, atmosphere and material mechanics are not matched.']),
    ('great-sand-dunes', 'bagnold'): (
        ['Aeolian dune landforms motivate a comparison of regional relief and terrain access.'],
        ['The mixed terrestrial mineral assemblage is not established as equivalent to Bagnold basaltic sand.', 'Water-mediated sand supply, wind regime and gravity differ; coarse MOLA cannot resolve equivalent slipfaces or migration.']),
    ('bisti-badlands', 'jezero'): (
        ['Eroded layered sedimentary terrain offers a candidate operations comparison for access to exposed strata.'],
        ['Bisti badlands are not a verified Jezero delta replica; depositional history and lithology differ.', 'Terrestrial fossils and weathering have no demonstrated biological or environmental counterpart at Jezero; hoodoos are unresolved by coarse planetary DEMs.']),
    ('meteor-crater', 'shackleton-rim'): (
        ['Both are impact-landform study areas; crater-related relief supports slope and approach-planning experiments.'],
        ['Meteor includes a bowl/ejecta neighbourhood, while this Shackleton crop samples a rim.', 'Terrestrial sedimentary rock, atmosphere and erosion differ from lunar regolith, vacuum and polar illumination.']),
    ('badwater', 'jezero'): (
        ['Both provide a basin/sedimentary context relevant to interpreting past water and contrasting flat deposits with surrounding relief.'],
        ['Badwater evaporite playa is not a Jezero delta replica; mineral mixtures and depositional histories are not established as equivalent.', 'Modern terrestrial heat, groundwater and salt-crust mechanics do not reproduce current Martian conditions.']),
    ('barrow-observatory', 'phoenix'): (
        ['Ice-rich periglacial ground and polygonal surface processes motivate a northern-plains operations comparison.'],
        ['Vegetation, seasonal thaw and liquid water at Barrow differ from Mars.', 'Thirty-metre DSM and coarse MOLA do not resolve equivalent polygon geometry, ice depth or bearing strength.']),
    ('kilbourne-hole-v1', 'shackleton-rim'): (
        ['Depression walls, slopes and surrounding relief provide a limited terrain-operations comparison.'],
        ['Kilbourne is a volcanic maar; Shackleton is an impact crater. Their formation mechanisms and materials are different.', 'The Kilbourne basin crop is not a lunar rim or thermal/polar-shadow analog.']),
    ('kilbourne-hole-v1', 'arsia-flank'): (
        ['Volcanic context and exposed rocky relief support a proposed volcanic-terrain operations comparison.'],
        ['A localized maar and a large shield-volcano flank have different eruption mechanisms, dimensions and landform geometry.', 'Shared broad basalt labels do not establish identical rock fractions, soil mechanics, atmosphere or temperature.']),
    ('craters-moon', 'arsia-flank'): (
        ['Lava-flow/vent terrain and broad basaltic context support volcanic surface-operations comparisons.'],
        ['Flow ages, textures, weathering and vegetation differ; the Martian crop does not resolve individual lava obstacles.', 'Neither local friction nor plume response follows from the basalt label.']),
    ('craters-moon', 'marius-hills'): (
        ['Volcanic lava and vent context motivates comparing routes and relief in volcanic landscapes.'],
        ['Earth surface alteration and vegetation differ from airless lunar regolith cover.', 'Coarse lunar elevation and this Earth crop do not establish matched vents, pits or cave geometry.']),
    ('lava-beds', 'marius-hills'): (
        ['Volcanic surfaces associated regionally with lava-tube/pit investigations motivate a surface-access comparison.'],
        ['Surface DEMs contain no cave interior, roof thickness or verified traversable passage.', 'Terrestrial weathering, atmosphere and cave access differ from the lunar environment; a surface comparison does not validate a shelter.']),
    ('lava-beds', 'arsia-flank'): (
        ['Volcanic terrain and regional interest in subsurface voids motivate surface reconnaissance comparisons.'],
        ['An Earth lava-tube landscape is not evidence for a cave within the selected Arsia crop.', 'Neither DEM resolves voids, roofs or fine obstacles; atmospheric and material-mechanics equivalence is unestablished.']),
    ('amboy', 'arsia-flank'): (
        ['Volcanic cone/flow context and broad basaltic interpretation offer a volcanic-terrain comparison.'],
        ['Amboy cinder-cone terrain differs from the regional shield-volcano flank crop.', 'Cinder grain sizes, obstacle abundance and strength are not matched by a coarse DEM or a shared substrate label.']),
    ('white-sands', 'bagnold'): (
        ['Wind-transported dunes motivate comparing aeolian landform organization and operations on granular slopes.'],
        ['White Sands gypsum differs from Bagnold basaltic sand; cohesion, density and optical properties cannot be transferred directly.', 'MOLA does not resolve Bagnold dune slipfaces at the Earth DSM scale; wind and gravity differ.']),
    ('capitol-reef', 'jezero'): (
        ['Exposed sedimentary relief and erosion provide a hypothesis for comparing terrain access to layered deposits.'],
        ['Capitol Reef is not a demonstrated Jezero delta analog; lithology and depositional histories require independent comparison.', 'Regional slope/relief similarity cannot validate sediment provenance, resources or landing safety.']),
    ('haughton', 'shackleton-rim'): (
        ['Impact-generated terrain and local relief offer a proposed operations/terrain comparison.'],
        ['The Haughton crop samples floor context; the target crop samples a Shackleton rim neighbourhood.', 'Earth atmosphere, seasonal water, weathering and illumination differ from lunar polar conditions; whole-crater equivalence is not established.']),
    ('qaidam', 'lucus-planum'): (
        ['Published Qaidam field work and NASA THEMIS imagery document wind-eroded ridges (yardangs), motivating an aeolian-erosion process comparison.'],
        ['Qaidam field coordinates and the Lucus THEMIS image centre define separate study windows, not a measured one-to-one ridge correspondence.', 'Local Martian lithology is unresolved; terrestrial sedimentary material does not establish identical cementation or strength.', 'The roughly 463 m MOLA source cannot resolve individual yardang walls or validate crest spacing; atmosphere, gravity and erosional histories differ.']),
}


NOTES.update(GLOBAL_NOTES)

def attach_handoff(catalog):
    """Used by both full builds and incremental registration to avoid drifting handoffs."""
    by_id = {s['id']: s for s in catalog['sites']}
    pairs = {(p['earth_id'], p['planetary_id']): p for p in catalog['pairings']}
    for earth in catalog['sites']:
        if earth['body'] != 'earth':
            continue
        notes = {}
        for target_id in earth['matches']:
            key = (earth['id'], target_id)
            if key not in NOTES or key not in pairs:
                raise ValueError(f'Missing explicit comparison handoff for {key}')
            matches, differences = NOTES[key]
            explanation = {
                'status': 'proposed_unvalidated', 'matches': matches, 'differences': differences,
                'sources': [earth['evidence_url'], by_id[target_id]['evidence_url']],
                'scope': 'Literature-informed comparison hypothesis plus regional terrain descriptors; not independently validated geological equivalence, engineering transfer or landing suitability.',
            }
            notes[target_id] = explanation
            pairs[key]['explanation'] = explanation
        earth['pairing_notes'] = notes
        earth['pairing_status'] = ('proposed_unvalidated' if notes else
                                   'exploratory_terrain_only' if earth.get('catalog_origin')=='regional_scan'
                                   else 'pending_target_selection')
    return catalog
