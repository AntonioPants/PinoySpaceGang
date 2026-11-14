import json

from scripts.catalog import scan_matches as sm
from scripts.catalog.matching import MIN_EXPLORATORY_SCORE_PERCENT


def row(i, score, lon, lat=0.0):
    return {'id': f'w{i}', 'analog_score_percent': score, 'longitude': lon, 'latitude': lat}


def test_shortlist_applies_cutoff_separation_and_catalog_exclusion():
    step = 0.03  # about 3.3 km of longitude at the equator: overlapping neighbours
    scored = [row(1, 90, 0), row(2, 89, step), row(3, 88, 3*step), row(4, 69, 9*step), row(5, 95, 20*step)]
    picked = sm.shortlist(scored, catalog_points=[(20*step, 0.0)], cutoff=70)
    # w5 sits on an existing catalog site, w2 overlaps w1, w4 is below the cutoff.
    assert [r['id'] for r in picked] == ['w1', 'w3']
    assert sm.shortlist([row(i, 80, i) for i in range(30)], [], limit=10, cutoff=70)[-1]['id'] == 'w17'


def test_region_seeds_supply_only_known_landforms():
    regions = [{'id': 'r', 'seed_site_ids': ['a', 'b', 'missing']}]
    sites = {'a': {'morphology': 'lava_field'}, 'b': {'morphology': 'not_a_label'}}
    assert sm.inferred_landforms(regions, sites) == {'r': ['lava_field']}


def test_published_shortlists_follow_the_live_rules():
    report = json.loads(sm.OUTPUT.read_text(encoding='utf-8'))
    assert report['scientifically_validated'] is False
    assert report['rules']['min_score_percent'] == MIN_EXPLORATORY_SCORE_PERCENT
    for target in report['targets'].values():
        picks = target['shortlist']
        assert len(picks) <= 10 and [p['candidate_rank'] for p in picks] == list(range(1, len(picks)+1))
        for p in picks:
            assert p['evidence_status'] == 'exploratory_terrain_only'
            assert p['landform']['status'] == 'inferred_from_scan_region_unreviewed'
            assert p['analog_score_percent'] >= MIN_EXPLORATORY_SCORE_PERCENT
            assert abs(p['analog_score_percent']-(0.5*p['landform']['match_percent']+0.5*p['terrain_similarity_percent'])) < 1e-3
        for i, a in enumerate(picks):
            for b in picks[:i]:
                assert sm.distance_km((a['longitude'], a['latitude']), (b['longitude'], b['latitude'])) >= sm.MIN_SEPARATION_KM
