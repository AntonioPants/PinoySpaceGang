from scripts.catalog.validity import order, summarize_ranks, reference_audit
from scripts.catalog.terrain_pilots import screen


def test_priority_ties_missing_and_sensitivity_denominator():
    assert order({'a':80,'b':80,'c':None,'d':20},{'d'}) == ['d','a','b']
    assert summarize_ranks([['a','b'],['b'],['b','a']], 'a') == {
        'rank_range':[1,2], 'top_ten_runs':2, 'valid_runs':2, 'requested_runs':3}


def test_external_reference_does_not_bypass_contamination_or_missing_data():
    sites=[{'id':'e','terrain':{},'region':'same region','latitude':0,'longitude':0},
           {'id':'p','terrain':{'ok':True}}]
    ref={'id':'r','earth_id':'e','planetary_id':'p','earth_region':'new name',
         'earth_latitude':0.1,'earth_longitude':0,'independent_review':False,
         'development_exposure':'unknown'}
    result=reference_audit({'sites':sites,'pairings':[{'earth_id':'e','planetary_id':'p'}]},[ref],['e'])
    row=result['references'][0]
    assert not row['eligible']
    assert set(row['exclusions']) == {'missing_earth_terrain','reused_catalog_pair',
        'earth_region_used_for_scale_fit','target_used_in_development_benchmark',
        'independent_review_pending','development_exposure_not_verified','reference_not_terrain_shape_ground_truth'}
    assert result['validated_accuracy_percent'] is None


def test_held_out_complete_reference_can_be_admitted():
    ref={'id':'r','earth_id':'e','planetary_id':'p','earth_region':'held out',
         'earth_latitude':40,'earth_longitude':40,'independent_review':True,
         'development_exposure':'held_out','terrain_shape_ground_truth':True}
    sites=[{'id':'e','terrain':{'ok':True}}, {'id':'p','terrain':{'ok':True}},
           {'id':'fit','region':'training','latitude':0,'longitude':0}]
    assert reference_audit({'sites':sites,'pairings':[]},[ref],['fit'])['references'][0]['eligible']


def test_product_posting_alone_cannot_promote_terrain():
    site={'body':'mars','latitude':18.45,'longitude':77.4}
    product={'bbox':[77.34,18.39,77.47,18.59],'posting_m':1}
    result=screen(site,product)
    assert result['bbox_covers_comparison_window']
    assert result['status']=='requires_review'
    assert len(result['reasons'])==4
    product.update(bbox=[0,0,1,1],relative_vertical_error_m=1,
                   quality_reviewed=True,full_valid_pixel_coverage_verified=True,datum_scale_offset_reviewed=True)
    assert screen(site,product)['status']=='requires_review'


def test_partial_pixels_are_not_silently_averaged_into_complete_coverage():
    import numpy as np
    import pytest
    from rasterio.transform import from_origin
    from scripts.catalog.ingest_pilot import average_complete
    raw=np.ones((6,6),dtype=float)
    raw[2,2]=np.nan
    with pytest.raises(ValueError,match='Incomplete measured footprint'):
        average_complete(raw,from_origin(0,6,1,1),'EPSG:3857','EPSG:3857',from_origin(0,6,2,2),3)
    raw[2,2]=1
    z,coverage=average_complete(raw,from_origin(0,6,1,1),'EPSG:3857','EPSG:3857',from_origin(0,6,2,2),3,2,10)
    assert np.all(z==12) and np.all(coverage==1)


def test_frozen_reference_pilot_retains_exclusions_and_exact_candidate_pool():
    from scripts.catalog.external_validation import generate
    result=generate()
    assert len(result['candidate_ids'])==103 and len(set(result['candidate_ids']))==103
    row=result['exploratory_retrieval'][0]
    assert row['candidate_count']==103 and 1<=row['score_only_rank']<=103
    assert not row['eligible']
    assert 'reference_features_unresolved_at_analysis_scale' in row['exclusions']
    assert not any('region_exposed_in_frozen' in r for r in row['exclusions'])
    assert result['independent_metrics']['positive_reference_recall_at_ten'] is None
    assert result['independent_metrics']['validated_accuracy_percent'] is None


def test_reference_source_and_scale_cannot_bypass_review_or_region_exclusion():
    ref={'id':'r','earth_id':'e','planetary_id':'p','earth_region':'reserved',
         'earth_latitude':0,'earth_longitude':0,'independent_review':True,
         'development_exposure':'held_out','terrain_shape_ground_truth':True,
         'maximum_supported_analysis_spacing_m':30}
    sites=[{'id':'e','body':'earth','terrain':{'spacing_m':30},'region':'reserved','latitude':0,'longitude':0},
           {'id':'p','body':'mars','terrain':{'spacing_m':500},'region':'new name','latitude':0,'longitude':0}]
    protocol={'development_sites':[{'id':'old','body':'mars','latitude':.1,'longitude':0,'region':'old name'}],
              'rules':{'regional_exclusion_km':100}}
    row=reference_audit({'sites':sites,'pairings':[]},[ref],[],protocol)['references'][0]
    assert set(row['exclusions'])=={'reference_features_unresolved_at_analysis_scale','target_region_exposed_in_frozen_development_catalog'}


def test_measured_pilot_has_bound_grid_and_confidence_code_evidence():
    from scripts.catalog.pilot_comparison import generate
    result=generate()
    assert set(result['pilots'])=={'phoenix','apollo-16-descartes'}
    for row in result['pilots'].values():
        assert row['minimum_cell_valid_fraction']==1
        assert len(row['candidates'])==102
        assert row['fine_analysis_spacing_m']==30
        assert row['analysis_spacing_m']>=150
    lunar=result['pilots']['apollo-16-descartes']
    assert set(lunar['quality']['code_counts']).issubset({'0','1','2','3','4','10','11','12','13','14','15'})
    assert .9<lunar['quality']['mean_accepted_fraction']<1
    assert lunar['quality']['minimum_cell_accepted_fraction']<.5
    assert any('Confidence map' in w for w in lunar['warnings'])
