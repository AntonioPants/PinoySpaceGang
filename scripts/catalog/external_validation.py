"""Run the frozen literature-reference pilot, including exclusions and failed checks.

python -m scripts.catalog.external_validation [--check]
Source-reviewed exploratory retrieval is separate from eligible validation. A
published process analogy is never relabelled terrain truth or project review.
"""
import argparse
import json
from pathlib import Path

from .build import ROOT, PUBLIC, dump, sha
from . import analog_score as score, terrain_features as tf
from .validity import order, reference_audit


def verify_freeze(protocol):
    for path,expected in protocol['method_sha256'].items():
        if sha(ROOT/path)!=expected:raise ValueError(f'Frozen method changed: {path}; reserve new regions before evaluating a revised method')


def generate(public=PUBLIC):
    protocol=json.loads((ROOT/'data/validation-protocol.json').read_text())
    verify_freeze(protocol)
    catalog=json.loads((public/'sites.json').read_text())
    reserved=json.loads((public/'validation-terrain/sites.json').read_text())
    if reserved['request_config_sha256']!=sha(ROOT/'data/validation-sites.json'):
        raise ValueError('Reserved-site request changed; regenerate terrain before evaluation')
    refs=json.loads((ROOT/'data/validation-references.json').read_text())
    catalog_ids={s['id'] for s in catalog['sites']}
    if any(s['id'] in catalog_ids for s in reserved['sites']):raise ValueError('Reserved site leaked into production catalog')
    combined={'sites':catalog['sites']+reserved['sites'],'pairings':catalog['pairings']}
    sites={s['id']:s for s in combined['sites']}
    grids={s['id']:tf.pack_grid(s,public/'validation-terrain')[:2] for s in reserved['sites']}
    earth=sorted((s for s in combined['sites'] if s['role']=='earth_analog'),key=lambda s:s['id'])
    grids.update({s['id']:tf.pack_grid(s,public)[:2] for s in earth if s['id'] not in grids})
    fitted=json.loads(score.SCALES_PATH.read_text())['fitted_earth_site_ids']
    audit=reference_audit(combined,refs['references'],fitted,protocol)
    rows=[]
    for ref in audit['references']:
        target,positive=sites.get(ref['planetary_id']),sites.get(ref['earth_id'])
        if not target or not positive or target['id'] not in grids:continue
        z,spacing=grids[target['id']];cell=score.resolution_for(spacing)
        p=tf.features(z,spacing,cell)
        scores={s['id']:score.combine(score.terrain_percent(tf.features(*grids[s['id']],cell),p,score.load_scales()[cell]),
            score.landform(s.get('morphology'),target['morphology'],s.get('inferred_landforms',()))['match_percent']) for s in earth}
        ranking=order(scores)
        rank=ranking.index(positive['id'])+1 if positive['id'] in ranking else None
        rows.append({'reference_id':ref['id'],'planetary_id':target['id'],'earth_id':positive['id'],
            'planetary_name':target['name'],'earth_name':positive['name'],'source_url':ref['source_url'],
            'scope':ref['scope'],'counterevidence_url':ref.get('counterevidence_url'),
            'eligible':ref['eligible'],'exclusions':ref['exclusions'],
            'analysis_spacing_m':cell,'analysis_window_m':4000//cell*cell,
            'score_only_rank':rank,'candidate_count':len(ranking),'in_top_ten':rank is not None and rank<=10,
            'similarity_percent':scores[positive['id']],
            'elevation_sha256':{sid:sites[sid]['terrain']['elevation_sha256'] for sid in (target['id'],positive['id'])},
            'interpretation':'Exploratory retrieval stress test. A miss is retained; a hit would not validate unresolved gully morphology or flow mechanism.'})
    eligible=[r for r in rows if r['eligible']]
    regions={sites[r['planetary_id']]['region'] for r in eligible}
    return {'version':'1.0.0','status':'published_evidence_pilot_review_pending',
        'generator_sha256':sha(Path(__file__)),
        'reserved_config_sha256':reserved['request_config_sha256'],
        'evaluation_use':'This pilot is now consumed. Future tuning must reserve new confirmation regions.',
        'protocol_sha256':sha(ROOT/'data/validation-protocol.json'),
        'references_sha256':sha(ROOT/'data/validation-references.json'),
        'reserved_catalog_sha256':sha(public/'validation-terrain/sites.json'),
        'catalog_sha256':sha(public/'sites.json'),'method_sha256':protocol['method_sha256'],
        'candidate_ids':[s['id'] for s in earth],'reference_audit':audit,
        'exploratory_retrieval':rows,'independent_metrics':{'eligible_references':len(eligible),
            'independent_regions':len(regions),'positive_reference_recall_at_ten':
                sum(r['in_top_ten'] for r in eligible)/len(eligible) if len(regions)>=protocol['rules']['minimum_independent_regions_for_summary'] else None,
            'validated_accuracy_percent':None,
            'reason':'Independent project review, compatible feature scale and at least five independent planetary regions are required for a summary.'},
        'production_changed':False}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
    result=generate();path=PUBLIC/'external-validation.json'
    if args.check:
        if json.loads(path.read_text())!=result:raise SystemExit('External validation pilot is stale')
    else:dump(path,result)
    print('Literature pilot:',[(r['reference_id'],r['score_only_rank'],r['candidate_count'],r['eligible']) for r in result['exploratory_retrieval']])
