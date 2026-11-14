import json
from copy import deepcopy

import numpy as np

from scripts.catalog.accuracy import sample_features, audit_pair, attach_accuracy
from scripts.catalog.build import ROOT, PUBLIC, descriptors
from rasterio.transform import from_origin


def test_audit_reproduces_descriptor_method_on_asymmetric_plane():
    row,col=np.indices((161,161))
    z=(2*col+3*row).astype('float32')
    expected=descriptors(z,from_origin(0,0,30,30),{},30)
    actual=sample_features(z,30)
    for key in expected:
        assert np.isclose(actual[key]['value'],expected[key]['value'])
    assert sample_features(z,30,(10000,0))=={}


def test_unknown_is_not_accuracy_and_sparse_features_do_not_score():
    site={'conditions': {}, 'morphology':'crater', 'substrate':'unknown'}
    result=audit_pair(site,site,None,None)
    assert result['recomputed_terrain_score'] is None
    assert result['validated_accuracy_percent'] is None
    assert result['window_sensitivity']['score_min'] is None
    assert result['status']=='insufficient_or_inconsistent_data'


def test_production_audit_is_deterministic_and_reproduces_all_proposed_pairs():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    result=attach_accuracy(deepcopy(catalog),PUBLIC)
    assert result==attach_accuracy(deepcopy(result),PUBLIC)
    for pair in result['pairings']:
        audit=pair['accuracy_check']
        assert audit['catalog_features_reproduced']
        assert audit['recomputed_terrain_score']==pair['terrain_score']
        assert audit['window_sensitivity']['valid_comparisons']==25
        assert audit['validated_accuracy_percent'] is None
        assert audit['sources']['earth']['elevation_sha256']
        if pair['planetary_id']=='shackleton-rim':
            assert audit['environment_checks'][0]['comparison_status']=='not_applicable'


def test_changed_catalog_feature_is_flagged_not_validated():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    next(s for s in catalog['sites'] if s['id']=='amboy')['comparison_features']['relief']['value']+=100
    attach_accuracy(catalog,PUBLIC)
    pair=next(p for p in catalog['pairings'] if p['earth_id']=='amboy')
    assert not pair['accuracy_check']['catalog_features_reproduced']
