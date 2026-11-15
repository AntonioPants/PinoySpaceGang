import copy
import hashlib
import json

import pytest

from scripts.catalog import analog_score, export_click_vectors as export

RAW = (export.PUBLIC/'sites.json').read_bytes()
CATALOG = json.loads(RAW.decode('utf-8'))


@pytest.fixture(scope='module')
def built():
    return export.build(CATALOG, sites_sha256=hashlib.sha256(RAW).hexdigest())


def test_every_earth_pack_and_planetary_target_is_exported(built):
    vectors, fixtures = built
    earth = [s['id'] for s in CATALOG['sites'] if s['role'] == 'earth_analog' and s.get('terrain')]
    assert sorted(vectors['sites']) == sorted(earth)
    planets = [s['id'] for s in CATALOG['sites'] if s['role'] == 'planetary_target' and s.get('terrain')]
    assert sorted(fixtures['targets']) == sorted(planets)
    scales = analog_score.load_scales()
    assert vectors['scales_by_resolution_m'] == {'150.0': scales[150.0], '500.0': scales[500.0]}
    assert len(scales[150.0]) == 15 and len(scales[500.0]) == 12
    assert {t['resolution_m'] for t in fixtures['targets'].values()} == {150.0, 500.0}


def test_published_scores_are_reproduced_from_the_exported_vectors(built):
    vectors, fixtures = built
    assert len(fixtures['published_comparisons']) == sum(
        c['terrain_similarity_percent'] is not None for c in CATALOG['analog_matching']['comparisons'])
    row = fixtures['published_comparisons'][0]
    target = fixtures['targets'][row['planetary_id']]
    earth = vectors['sites'][row['earth_id']]
    terrain = analog_score.terrain_percent(earth['vectors'][str(target['resolution_m'])], target['vector'],
                                           vectors['scales_by_resolution_m'][str(target['resolution_m'])])
    assert round(terrain, 2) == round(row['terrain_similarity_percent'], 2)


def test_a_changed_published_score_fails_the_export():
    changed = copy.deepcopy(CATALOG)
    changed['analog_matching']['comparisons'][0]['analog_score_percent'] += 0.5
    with pytest.raises(export.ParityError):
        export.build(changed)


def test_committed_outputs_match_the_current_catalog(built):
    for name, fresh in zip(('earth-vectors.json', 'fixtures.json'), built):
        committed = json.loads((export.OUT/name).read_text(encoding='utf-8'))
        assert committed == json.loads(json.dumps(fresh)), f'{name} is stale: rerun export_click_vectors'
