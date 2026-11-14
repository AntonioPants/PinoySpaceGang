import json

import numpy as np

from scripts.catalog import terrain_features as tf
from scripts.catalog.benchmark import PRODUCTION, PUBLIC, benchmark, rank_metrics


def test_rank_metrics_reward_known_analogs_at_the_top():
    scores = {'a': 90, 'b': 80, 'c': 70, 'd': 60}
    assert rank_metrics(scores, {'a', 'b'}) == {'auc': 1.0, 'recall_at_10': 1.0, 'mean_rank': 1.5, 'known': 2, 'candidates': 4,'score_gap_pp':15.0,'known_unscorable':[]}
    assert rank_metrics(scores, {'c', 'd'})['auc'] == 0.0


def test_features_are_resolution_matched_and_ignore_regional_tilt():
    y, x = np.mgrid[:161, :161]*30.0
    flat, tilted = np.zeros((161, 161)), 0.05*x
    bumpy = 20*np.sin(x/200)*np.sin(y/200)
    a, b, c = (tf.features(z, 30.0, 150.0) for z in (flat, tilted, bumpy))
    assert a['roughness_fine'] == 0 and b['roughness_fine'] < 1e-6 < c['roughness_fine']
    assert abs(b['slope_mean']-np.degrees(np.arctan(0.05))) < 0.01
    # A grid cannot be compared at a finer resolution than its own samples.
    assert tf.features(flat[:33, :33], 500.0, 150.0) is None
    scales = tf.robust_scales([a, b, c])
    assert tf.similarity_percent(c, c, scales) == 100
    assert tf.similarity_percent(a, c, scales) < 100


def test_benchmark_reports_every_method_without_claiming_validation():
    report = benchmark(json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8')))
    assert 'not validated' in report['reference']
    assert set(report['methods']) == {'v1_fixed_scale_1km', PRODUCTION, tf.METHOD}
    summary = {name: m['summary_weighted_by_known_pairs'] for name, m in report['methods'].items()}
    # The live analog score must keep beating the retired terrain-only score on the catalog's reference pairs.
    assert summary[PRODUCTION]['auc'] > 0.85 > summary['v1_fixed_scale_1km']['auc']
    assert summary[PRODUCTION]['recall_at_10'] > 0.7
    for method in report['methods'].values():
        assert method['targets'] and all(0 <= row['auc'] <= 1 for row in method['targets'].values() if row['known'])


def test_missing_reference_scores_are_not_dropped():
    r=rank_metrics({'a':None, 'b':20}, {'a'})
    assert r['mean_rank']==3 and r['known_unscorable']==['a']
    assert r['recall_at_10']==0
    assert r['score_gap_pp'] is None
    assert rank_metrics({'a':20},set())['recall_at_10'] is None
