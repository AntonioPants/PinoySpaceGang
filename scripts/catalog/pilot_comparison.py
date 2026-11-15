"""Compare staged stereo pilots against the live DEM without changing calibration.

python -m scripts.catalog.pilot_comparison [--check]
The before/after rankings use identical physical windows, cells, features, frozen
normalizers, landform weights and Earth candidates. Changes isolate source data;
they do not by themselves demonstrate greater retrieval accuracy.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from .build import ROOT, PUBLIC, dump, sha
from . import analog_score as score, terrain_features as tf
from .validity import order, summarize_ranks


def load_pilot(site, public=PUBLIC):
    folder=public/'terrain-pilots'/site['id']
    audit=json.loads((folder/'audit.json').read_text())
    m=json.loads((folder/'manifest.json').read_text())
    config=json.loads((ROOT/'data/terrain-upgrade-pilots.json').read_text())
    product=next(p for p in config['pilots'] if p['site_id']==site['id'])
    if audit.get('product_config_sha256')!=hashlib.sha256(json.dumps(product,sort_keys=True).encode()).hexdigest():
        raise ValueError('Pilot configuration changed; regenerate from retained sources')
    if audit['catalog_elevation_sha256']!=site['terrain']['elevation_sha256']:
        raise ValueError('Pilot baseline differs from catalog')
    if audit['manifest_sha256']!=sha(folder/'manifest.json') or audit['pilot_elevation_sha256']!=sha(folder/'elevation.f32'):
        raise ValueError('Pilot pack checksum mismatch')
    grid=m['grid']
    z=np.frombuffer((folder/'elevation.f32').read_bytes(),dtype='<f4').reshape(grid['rows'],grid['columns'])
    if not np.isfinite(z).all() or audit['minimum_cell_valid_fraction']<1-1e-6:
        raise ValueError('Pilot lacks complete measured coverage')
    return z,grid['spacing_m'],audit,m


def generate(public=PUBLIC):
    catalog=json.loads((public/'sites.json').read_text())
    earth=sorted((s for s in catalog['sites'] if s['role']=='earth_analog'),key=lambda s:s['id'])
    grids={s['id']:tf.pack_grid(s,public)[:2] for s in earth}
    scales=score.load_scales()
    results={}
    for site in catalog['sites']:
        if not (public/'terrain-pilots'/site['id']/'audit.json').exists():continue
        z,spacing,audit,m=load_pilot(site,public)
        old,old_spacing=tf.pack_grid(site,public)[:2]
        cell=score.resolution_for(old_spacing)
        baseline=score.window_features(old,old_spacing,cell)
        updated=score.window_features(z,spacing,cell)
        forms={s['id']:score.landform(s['morphology'],site['morphology'],s.get('inferred_landforms',())) for s in earth}
        efeatures={sid:score.window_features(*grid,cell) for sid,grid in grids.items()}
        proposed={p['earth_id'] for p in catalog['pairings'] if p['planetary_id']==site['id']}
        def values(planet):
            return {sid:[score.terrain_percent(a,b,scales[cell]) for a in vecs for b in planet] for sid,vecs in efeatures.items()}
        old_values,new_values=values(baseline),values(updated)
        def combine(v,sid):return score.combine(v,forms[sid]['match_percent'])
        def ranks(vals,priority=()):return [order({sid:combine(v[i],sid) for sid,v in vals.items()},priority) for i in range(25)]
        before,after=ranks(old_values),ranks(new_values)
        published=ranks(new_values,proposed)
        candidates={sid:{'baseline_score_rank':before[0].index(sid)+1,'pilot_score_rank':after[0].index(sid)+1,
            'earth_elevation_sha256':next(s['terrain']['elevation_sha256'] for s in earth if s['id']==sid),
            'baseline_similarity_percent':combine(v[0],sid),
            'pilot_priority_rank':published[0].index(sid)+1,
            'baseline_terrain_percent':v[0],'pilot_terrain_percent':new_values[sid][0],
            'pilot_similarity_percent':combine(new_values[sid][0],sid),
            'window_sensitivity':summarize_ranks(after,sid)} for sid,v in old_values.items()}
        # Same-cell descriptors isolate source differences, never error against
        # independent truth. No finer baseline is synthesized by upsampling.
        a=tf.sample(old,old_spacing,cell);b=tf.sample(z,spacing,cell)
        # descriptors below use measured 30 m cells; no artificial 30 m baseline.
        fine=tf.sample(z,spacing,spacing)
        qa=audit.get('quality')
        warnings=['Independent artifact/geological review pending; rankings remain experimental.']
        if qa and qa['minimum_cell_accepted_fraction']<1-1e-6:warnings.append('Confidence map includes pixels outside successful-correlation/manually-edited codes; preview with caution.')
        if not qa:warnings.append('No confidence raster was available in this product listing; finite elevations do not establish stereo reliability.')
        if audit['relative_vertical_error_m'] is None:warnings.append('Product-specific vertical-error estimate is unavailable.')
        results[site['id']]={**audit,'source_metadata':m['source'],'warnings':warnings,
            'analysis_spacing_m':cell,'analysis_window_m':a['window_m'],
            'baseline_descriptors':a['values'],'pilot_descriptors':b['values'],
            'fine_descriptors':fine['values'],'fine_analysis_spacing_m':spacing,
            'top_ten_overlap':len(set(before[0][:10])&set(after[0][:10])),
            'changed_score_ranks':sum(c['baseline_score_rank']!=c['pilot_score_rank'] for c in candidates.values()),
            'candidates':candidates,
            'interpretation':'Same-method source sensitivity, not accuracy improvement. 30 m descriptors are separate from the coarser ranking calculation.'}
    return {'version':'1.0.0','catalog_sha256':sha(public/'sites.json'),
            'generator_sha256':sha(Path(__file__)),
            'scales_sha256':sha(score.SCALES_PATH),'config_sha256':sha(ROOT/'data/terrain-upgrade-pilots.json'),
            'pilots':results,'production_changed':False}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
    report=generate();path=PUBLIC/'terrain-pilot-comparison.json'
    if args.check:
        if json.loads(path.read_text())!=report:raise SystemExit('Stereo comparison is stale')
    else:dump(path,report)
    print('Measured stereo comparison:',[(sid,r['changed_score_ranks'],r['top_ten_overlap']) for sid,r in report['pilots'].items()])
