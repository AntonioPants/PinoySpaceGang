"""Reproducible ranking sensitivity and external-reference eligibility audit.

python -m scripts.catalog.validity [--check]
Does not tune or replace production ranking. All sensitivity runs use the full
Earth pool, preserve the literature tier, and share one perturbation across it.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from . import analog_score as score, terrain_features as tf
from .accuracy import OFFSETS

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'web/public'
OUTPUT = PUBLIC / 'comparison-validity.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def order(scores, proposals=()):
    return sorted((sid for sid, value in scores.items() if value is not None),
                  key=lambda sid: (sid not in proposals, -scores[sid], sid))


def summarize_ranks(runs, sid):
    ranks = [run.index(sid)+1 for run in runs if sid in run]
    return {'rank_range': [min(ranks), max(ranks)] if ranks else None,
            'top_ten_runs': sum(r <= 10 for r in ranks), 'valid_runs': len(ranks),
            'requested_runs': len(runs)}


def reference_audit(catalog, references, fitted_ids, protocol=None):
    """Fail closed on reused labels, fit regions, missing packs and unreviewed provenance.

    A 100 km exclusion also catches nearby windows whose region names differ.
    These are eligibility checks, not a retrospective cross-validation claim.
    """
    sites = {s['id']: s for s in catalog['sites']}
    pairs = {(p['planetary_id'], p['earth_id']) for p in catalog['pairings']}
    fitted = [sites[sid] for sid in fitted_ids if sid in sites]
    rows = []
    for ref in references:
        earth, target = sites.get(ref['earth_id']), sites.get(ref['planetary_id'])
        lat, lon = ref['earth_latitude'], ref['earth_longitude']
        def near(s):
            a, b = math.radians(lat), math.radians(s['latitude'])
            h = math.sin((a-b)/2)**2 + math.cos(a)*math.cos(b)*math.sin(math.radians(lon-s['longitude'])/2)**2
            return 6371*2*math.asin(min(1, math.sqrt(h))) < 100
        reasons = []
        if not earth or not earth.get('terrain'): reasons.append('missing_earth_terrain')
        if not target or not target.get('terrain'): reasons.append('missing_target_terrain')
        if (ref['planetary_id'], ref['earth_id']) in pairs: reasons.append('reused_catalog_pair')
        if any(s['region'] == ref['earth_region'] or near(s) for s in fitted): reasons.append('earth_region_used_for_scale_fit')
        development_ids={p['planetary_id'] for p in catalog['pairings']}
        if ref['planetary_id'] in development_ids: reasons.append('target_used_in_development_benchmark')
        if target and target.get('region') and any(sites[tid].get('region') == target['region'] for tid in development_ids if tid in sites and tid != ref['planetary_id']):
            reasons.append('target_region_used_in_development_benchmark')
        if not ref.get('independent_review'): reasons.append('independent_review_pending')
        if ref.get('development_exposure') != 'held_out': reasons.append('development_exposure_not_verified')
        if ref.get('terrain_shape_ground_truth') is not True: reasons.append('reference_not_terrain_shape_ground_truth')
        if target and target.get('terrain') and target['terrain'].get('spacing_m',0)>ref.get('maximum_supported_analysis_spacing_m',math.inf):
            reasons.append('reference_features_unresolved_at_analysis_scale')
        if protocol:
            for site, prefix in ((earth,'earth'),(target,'target')):
                if not site:continue
                radius={'earth':6371,'mars':3396.19,'moon':1737.4}[site['body']]
                for used in protocol['development_sites']:
                    if used['body']!=site['body']:continue
                    a,b=map(math.radians,(site['latitude'],used['latitude']))
                    h=math.sin((a-b)/2)**2+math.cos(a)*math.cos(b)*math.sin(math.radians(site['longitude']-used['longitude'])/2)**2
                    if site['id']==used['id'] or used['region']==site['region'] or radius*2*math.asin(min(1,math.sqrt(h)))<protocol['rules']['regional_exclusion_km']:
                        reasons.append(prefix+'_region_exposed_in_frozen_development_catalog');break
        rows.append({**ref, 'eligible': not reasons, 'exclusions': reasons})
    return {'status': 'eligible_references_available' if any(r['eligible'] for r in rows) else 'no_independent_validation_yet',
            'validated_accuracy_percent': None, 'region_exclusion_km': 100, 'references': rows}


def generate(catalog, public=PUBLIC):
    earth = sorted((s for s in catalog['sites'] if s['role'] == 'earth_analog' and s.get('terrain')), key=lambda s:s['id'])
    targets = sorted((s for s in catalog['sites'] if s['role'] == 'planetary_target' and s.get('terrain')), key=lambda s:s['id'])
    grids = {s['id']: tf.pack_grid(s, public)[:2] for s in earth+targets}
    frozen = score.load_scales()
    cache = {}
    def windows(site, cell):
        key = (site['id'], cell)
        if key not in cache: cache[key] = score.window_features(*grids[site['id']], cell)
        return cache[key]
    report = {}
    for target in targets:
        tid = target['id']
        cell = score.resolution_for(grids[tid][1])
        scales = frozen[cell]
        planet = windows(target, cell)
        forms = {e['id']: score.landform(e['morphology'],target['morphology'],e.get('inferred_landforms',())) for e in earth}
        proposed = {p['earth_id'] for p in catalog['pairings'] if p['planetary_id'] == tid}
        values = {e['id']: [score.terrain_percent(a,b,scales) for a in windows(e,cell) for b in planet] for e in earth}
        central = {sid: v[0] for sid,v in values.items()}
        def combine(v, sid, weight=.5):
            return None if v is None else (1-weight)*v + weight*forms[sid]['match_percent']
        base_scores = {sid: combine(v,sid) for sid,v in central.items()}
        base_order = order(base_scores, proposed)
        runs = {'window': [order({sid:combine(v[i],sid) for sid,v in values.items()},proposed) for i in range(25)],
                'weight': [order({sid:combine(v,sid,w) for sid,v in central.items()},proposed) for w in (.25,.5,.75)]}
        # Coarser sampling loses some descriptor supports. Compare both scales on
        # the SAME shared feature set and frozen normalization; never refit here.
        coarse = {s['id']: windows(s,cell*2)[0] for s in earth+[target]}
        fine = {s['id']: windows(s,cell)[0] for s in earth+[target]}
        keys = {k:v for k,v in scales.items() if all(p and p.get(k) is not None for p in list(coarse.values())+list(fine.values()))}
        runs['scale'] = [order({e['id']:combine(score.terrain_percent(pool[e['id']],pool[tid],keys), e['id']) for e in earth},proposed) for pool in (fine,coarse)]
        rows = {}
        for e in earth:
            sid=e['id']
            a,b = fine[sid],fine[tid]
            features = [{'feature':k,'unit':tf.UNITS[k],'earth':round(a[k],4),'planetary':round(b[k],4),
                         'scaled_difference':round(abs(a[k]-b[k])/v,4)} for k,v in scales.items() if a and b and a.get(k) is not None and b.get(k) is not None]
            features.sort(key=lambda f:(f['scaled_difference'],f['feature']))
            rows[sid] = {'earth_elevation_sha256':e['terrain']['elevation_sha256'],
                         'planetary_elevation_sha256':target['terrain']['elevation_sha256'],
                         'baseline_rank':base_order.index(sid)+1 if sid in base_order else None,
                         'score_only_rank':order(base_scores).index(sid)+1 if sid in order(base_scores) else None,
                         'similarity_percent':base_scores[sid], 'terrain_percent':central[sid],
                         'landform':forms[sid], 'evidence_priority':sid in proposed,
                         'sensitivity':{axis:summarize_ranks(r,sid) for axis,r in runs.items()},
                         'closest_features':features[:3], 'largest_differences':list(reversed(features[-3:])),
                         'source_urls':[e['terrain']['source_url'],target['terrain']['source_url']],
                         'substrates': [e['substrate'],target['substrate']]}
        report[tid]={'analysis_spacing_m':cell,'analysis_window_m':math.floor(4000/cell)*cell,
                     'scale_test_spacing_m':[cell,cell*2], 'scale_features':sorted(keys), 'candidates':rows}
    refs = json.loads((ROOT/'data/validation-references.json').read_text())
    fitted = json.loads(score.SCALES_PATH.read_text())['fitted_earth_site_ids']
    protocol=json.loads((ROOT/'data/validation-protocol.json').read_text())
    validation=reference_audit(catalog,refs['references'],fitted,protocol)
    # Positive references measure retrieval only. Unlabelled sites are not negatives.
    evaluated=[]
    for ref in validation['references']:
        if ref['eligible']:
            candidate=report[ref['planetary_id']]['candidates'].get(ref['earth_id'])
            rank=candidate['score_only_rank'] if candidate else None
            evaluated.append({'reference_id':ref['id'],'score_only_rank':rank,'in_top_ten':rank is not None and rank<=10})
    validation['retrieval']={'evaluated_references':evaluated,
        'recall_at_ten':sum(r['in_top_ten'] for r in evaluated)/len(evaluated) if evaluated else None,
        'scope':'Positive-reference retrieval in pure score order; unlabelled candidates are not verified negatives. No accuracy estimate.'}
    return {'version':'1.0.0', 'catalog_sha256':digest(public/'sites.json'),
            'generator_sha256':digest(Path(__file__)),
            'scales_sha256':digest(score.SCALES_PATH), 'references_sha256':digest(ROOT/'data/validation-references.json'),
            'protocol_sha256':digest(ROOT/'data/validation-protocol.json'),
            'scope':'Engineering sensitivity scenarios, not confidence intervals or probability of correctness. Production ranking unchanged.',
            'methods':{'window_offsets_m':OFFSETS,'landform_weights':[.25,.5,.75],
                       'ranking':'Literature priority, descending similarity, stable site ID; score-only rank also reported.',
                       'scale':'Native and twice-native cells on shared resolved features with existing frozen scales; diagnostic only.'},
            'independent_validation':validation, 'targets':report}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    result=generate(json.loads((PUBLIC/'sites.json').read_text()))
    targets=result.pop('targets')
    result['target_ids']=sorted(targets)
    outputs={OUTPUT:result, **{PUBLIC/'comparison-validity'/f'{tid}.json':row for tid,row in targets.items()}}
    for path, data in outputs.items():
        serialized=json.dumps(data,allow_nan=False,separators=(',',':'))+'\n'
        if args.check:
            if json.loads(path.read_text()) != json.loads(serialized): raise SystemExit(f'Validity audit is stale: {path}')
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(serialized)
    print(f'Validity audit: {len(targets)} targets; {result["independent_validation"]["status"]}')


if __name__ == '__main__': main()
