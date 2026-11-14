import json

import numpy as np
import pytest

from scripts.catalog import analog_score as score


def test_landform_is_a_weighted_term_not_a_filter():
    assert score.landform('lava_field', 'volcanic_plain')['relation'] == 'same_family'
    assert score.landform('impact_crater', 'crater')['match_percent'] == 100
    assert score.landform('crater', 'volcanic_plain') == {
        'earth_family': 'crater', 'planetary_family': 'volcanic', 'relation': 'related_family',
        'match_percent': 50.0, 'status': 'interpretation_only'}
    assert score.landform('dune_field', 'crater')['match_percent'] == 0
    assert score.landform('not_a_known_label', 'crater')['relation'] == 'unknown'
    # A different or unknown landform keeps its terrain half; it can never exceed 50.
    assert score.combine(100, 0) == 50
    assert score.combine(80, 100) == 90
    assert score.combine(None, 100) is None


def test_terrain_similarity_is_symmetric_bounded_and_needs_every_feature():
    scales = {'slope_mean': 2.0, 'relief': 100.0}
    a, b = {'slope_mean': 4.0, 'relief': 300.0}, {'slope_mean': 8.0, 'relief': 100.0}
    assert score.terrain_percent(a, a, scales) == 100
    assert score.terrain_percent(a, b, scales) == pytest.approx(100*np.exp(-1))
    assert score.terrain_percent(a, b, scales) == score.terrain_percent(b, a, scales)
    assert score.terrain_percent(a, {'slope_mean': 8.0, 'relief': None}, scales) is None
    assert score.terrain_percent(a, None, scales) is None


def test_frozen_scales_cover_both_planetary_resolutions():
    scales = score.load_scales()
    assert set(scales) == {150.0, 500.0}
    for values in scales.values():
        assert {'slope_mean', 'relief', 'hypsometric_integral'} <= set(values)
        assert all(v > 0 and np.isfinite(v) for v in values.values())
    frozen = json.loads(score.SCALES_PATH.read_text(encoding='utf-8'))
    assert frozen['status'] == 'frozen_engineering_reference_spread' and len(frozen['fitted_earth_site_ids']) >= 50


def test_inferred_landforms_are_weaker_than_reviewed_labels_and_never_override_them():
    reviewed = score.landform('lava_field', 'volcanic_plain', ['dune_field'])
    assert reviewed['match_percent'] == 100 and reviewed['status'] == 'interpretation_only'
    inferred = score.landform(None, 'volcanic_plain', ['dune_field', 'lava_field'])
    assert inferred['relation'] == 'same_family' and inferred['earth_family'] == 'volcanic'
    assert inferred['match_percent'] == 75 and inferred['status'] == 'inferred_from_scan_region_unreviewed'
    # Related inferred family: 37.5 landform points, so at most 68.75 overall, below a 70% cutoff.
    assert score.combine(100, score.landform(None, 'delta', ['rocky_desert'])['match_percent']) < 70
    # A seed crater does not make its neighbouring ground a crater.
    assert score.landform(None, 'crater', ['impact_crater'])['match_percent'] == 0
    assert score.landform(None, 'crater', [])['relation'] == 'unknown'
