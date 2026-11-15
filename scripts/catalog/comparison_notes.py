"""Traceable exploratory explanations, never a promotion to literature ground truth."""
def comparison_notes(earth, planet, relation):
    earth_label=earth['morphology'].replace('_',' ')
    planet_label=planet['morphology'].replace('_',' ')
    inferred=earth.get('inferred_landforms',[])
    if inferred and earth['morphology']=='unknown':
        earth_label='unreviewed regional inference: '+', '.join(inferred)
    return {
        'status':'catalog_interpretation_unreviewed',
        'matches':[
            f"{earth['name']} and {planet['name']} are compared at common terrain-analysis resolution using slope, roughness, relief and shape; this supports an engineering terrain-rehearsal hypothesis.",
            f"Landform relation: {relation.replace('_',' ')}. Earth: {earth_label}; target: {planet_label}. This categorical comparison is not independently verified geology."],
        'differences':[
            f"Target context: {planet['description']}",
            f"Earth context: {earth['description']}",
            f"Earth substrate {earth['substrate']} versus target {planet['substrate']}; unknown labels do not establish material equivalence. Earth air, gravity and radiation differ; contact mechanics are not measured."],
        'sources':list(dict.fromkeys([earth['evidence_url'],planet['evidence_url']])),
        'scope':'Automatically assembled from sourced catalog descriptions and the existing landform relation. Sources support individual site context, not a published endorsement of this particular pairing. Human geological review remains required.'}
