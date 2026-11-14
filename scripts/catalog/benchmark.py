"""Benchmark terrain-similarity methods against the literature-informed pairings.

Usage: python -m scripts.catalog.benchmark [--write]

The literature-informed pairings are the only available reference set. They were
proposed for geological/process reasons, not measured terrain equivalence, so this
is a discrimination check for engineering scores, never scientific validation.
For every planetary target with known analogs, all Earth sites are ranked purely
by score (no evidence-tier boost) and three numbers are reported:

- auc: chance that a known analog outranks a non-analog (0.5 = random, 1 = perfect);
- recall_at_10: share of the known analogs that land in the top ten;
- mean_rank: mean rank of the known analogs (1 = best).
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

from . import analog_score, terrain_features as tf
from .scoring import compare
from .accuracy import sample_features

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT/'web/public'
OUTPUT = ROOT/'data/matching-benchmark.json'
PRODUCTION = 'analog_score_landform_plus_terrain'


def load_grid(site, public=PUBLIC):
    terrain = site['terrain']
    raw = (public/terrain['manifest_url'].lstrip('/')).parent.joinpath('elevation.f32').read_bytes()
    if hashlib.sha256(raw).hexdigest() != terrain['elevation_sha256']:
        raise ValueError(f'{site["id"]}: elevation checksum mismatch')
    z = np.frombuffer(raw, dtype='<f4').reshape(terrain['rows'], terrain['columns']).astype('float64')
    return z, float(terrain['spacing_m'])


def rank_metrics(scores, known):
    """scores: {earth_id: score}; known: set of earth ids that are reference analogs."""
    finite={k:v for k,v in scores.items() if v is not None and np.isfinite(v)}
    order = sorted(finite, key=lambda k: (-finite[k], k))
    ranks = {sid: i+1 for i, sid in enumerate(order)}
    pos = [finite[k] for k in known if k in finite]
    neg = [finite[k] for k in finite if k not in known]
    wins = sum((p > n) + 0.5*(p == n) for p in pos for n in neg)
    return {'auc': round(wins/(len(pos)*len(neg)), 4) if pos and neg else None,
            'recall_at_10': sum(k in ranks and ranks[k] <= 10 for k in known)/len(known) if known else None,
            'mean_rank': float(np.mean([ranks.get(k,len(scores)+1) for k in known])) if known else None,
            'score_gap_pp':float(np.mean(pos)-max(neg)) if pos and neg else None,
            'known_unscorable':sorted(known-finite.keys()),
            'known': len(known), 'candidates': len(scores)}


def method_scores(catalog, public=PUBLIC, include_candidate=True):
    """Return {method: {target_id: {earth_id: score_percent}}} for every method."""
    earth = [s for s in catalog['sites'] if s['role'] == 'earth_analog' and s.get('terrain')]
    targets = [s for s in catalog['sites'] if s['role'] == 'planetary_target' and s.get('terrain')]
    grids = {s['id']: load_grid(s, public) for s in earth+targets}
    v1 = {sid: sample_features(z.astype('float32'), spacing) for sid, (z, spacing) in grids.items()}
    out = {'v1_fixed_scale_1km': {}, PRODUCTION: {}}
    frozen = analog_score.load_scales()
    if include_candidate: out[tf.METHOD]={}
    for target in targets:
        tid = target['id']
        out['v1_fixed_scale_1km'][tid] = {
            e['id']: 100*score for e in earth
            if (score := compare(v1[e['id']], v1[tid])['terrain_score']) is not None}
        # Live ranking score: landform-family agreement plus frozen-scale terrain similarity.
        live = analog_score.resolution_for(grids[tid][1])
        centre = tf.features(*grids[tid], live)
        out[PRODUCTION][tid] = {e['id']: analog_score.combine(
            analog_score.terrain_percent(tf.features(*grids[e['id']], live), centre, frozen.get(live)),
            analog_score.landform(e['morphology'], target['morphology'])['match_percent']) for e in earth}
        if not include_candidate: continue
        resolution = tf.common_resolution(grids[tid][1])
        vectors = {sid: tf.features(*grids[sid], resolution) for sid in [tid]+[e['id'] for e in earth]}
        if vectors[tid] is None:
            continue
        pool = {e['id']: vectors[e['id']] for e in earth if vectors[e['id']] is not None}
        scales = tf.robust_scales(list(pool.values()))
        out[tf.METHOD][tid] = {sid: tf.similarity_percent(v, vectors[tid], scales) for sid, v in pool.items()}
    return out


def benchmark(catalog, public=PUBLIC, include_candidate=True):
    known = {}
    for pair in catalog['pairings']:
        known.setdefault(pair['planetary_id'], set()).add(pair['earth_id'])
    report = {'reference': 'literature_informed_proposal pairings; process-based hypotheses, not validated terrain matches',
              'ranking': 'pure score order, no evidence-tier boost', 'methods': {}}
    for method, per_target in method_scores(catalog, public, include_candidate).items():
        rows = {}
        for tid, scores in sorted(per_target.items()):
            rows[tid] = rank_metrics(scores, known.get(tid,set()))
        labeled=[r for r in rows.values() if r['known']]
        weights = [r['known'] for r in labeled]
        summary = {key: float(np.average([r[key] for r in labeled], weights=weights))
                   for key in ('auc', 'recall_at_10', 'mean_rank','score_gap_pp')} if labeled else {}
        summary['macro_recall_at_10']=float(np.mean([r['recall_at_10'] for r in labeled])) if labeled else None
        report['methods'][method] = {'summary_weighted_by_known_pairs': summary, 'targets': rows}
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--write', action='store_true', help=f'write {OUTPUT.relative_to(ROOT)}')
    parser.add_argument('--candidate',action='store_true',help='Also evaluate the experimental descriptor score; not production ranking')
    args = parser.parse_args(argv)
    report = benchmark(json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8')),include_candidate=args.candidate)
    for method, data in report['methods'].items():
        print(f'\n{method}: {data["summary_weighted_by_known_pairs"]}')
        for tid, row in data['targets'].items():
            if not row['known']:
                print(f'  {tid:18} no reference labels (metrics null)')
                continue
            print(f'  {tid:18} auc {row["auc"]:.2f}  recall@10 {row["recall_at_10"]:.2f}  '
                  f'mean rank {row["mean_rank"]:5.1f} gap {row["score_gap_pp"]:.2f} pp of {row["candidates"]}  ({row["known"]} known)')
    OUTPUT.write_text(json.dumps(report, indent=2,allow_nan=False)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
