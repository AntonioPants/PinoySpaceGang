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


def same(a, b, path=''):
    """Paths where two exports differ. Floats agree to 1e-9 relative: the last bits of the
    terrain features change with the machine's NumPy build (Windows, macOS and the Linux CI
    differ around 1e-13), and that is not a stale export."""
    if isinstance(a, dict) and isinstance(b, dict):
        return [p for k in a.keys() | b.keys() for p in (same(a[k], b[k], f'{path}/{k}') if k in a and k in b else [f'{path}/{k}'])]
    if isinstance(a, list) and isinstance(b, list):
        return [f'{path} (length)'] if len(a) != len(b) else [p for i, (x, y) in enumerate(zip(a, b)) for p in same(x, y, f'{path}[{i}]')]
    if isinstance(a, float) or isinstance(b, float):
        ok = isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool) and not isinstance(b, bool) and a == pytest.approx(b, rel=1e-9, abs=1e-12)
        return [] if ok else [path]
    return [] if a == b else [path]


def test_float_noise_is_not_staleness_but_a_real_change_is():
    assert same({'v': [1.0000000000001, 2]}, {'v': [1.0, 2]}) == []
    assert same({'v': [1.001, 2]}, {'v': [1.0, 2]}) == ['/v[0]']
    assert same({'a': 1}, {'a': 1, 'b': 2}) == ['/b']
    assert same({'s': 'x'}, {'s': 'y'}) == ['/s']


def test_committed_outputs_match_the_current_catalog(built):
    for name, fresh in zip(('earth-vectors.json', 'fixtures.json'), built):
        committed = json.loads((export.OUT/name).read_text(encoding='utf-8'))
        differences = same(committed, json.loads(json.dumps(fresh)))
        assert not differences, f'{name} is stale at {differences[:5]}: rerun export_click_vectors'

