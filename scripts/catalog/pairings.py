"""Explicit scientific scope for proposed comparisons; never validated equivalence."""
NOTES = {
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
        earth['pairing_status'] = 'proposed_unvalidated' if notes else 'pending_target_selection'
    return catalog
