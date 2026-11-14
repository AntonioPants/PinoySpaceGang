from copy import deepcopy
import json

import pytest

from scripts.catalog.build import PUBLIC
from scripts.catalog.matching import attach_matching, environment_feature, comparison, CONTRACT, eligibility_reason


def quantity(value, unit='K'):
    return {'value':value,'unit':unit,'status':'modeled','source':{'url':'https://example.org/test-data'},
        'method':'synthetic unit test','time_coverage':'test season',
        'comparison_contract':dict(zip(CONTRACT,['surface temperature','mean','seasonal mean','1000m area mean',None]),
                                   review_source_url='https://example.org/test-review')}


def test_converts_temperature_units_only_after_contract_review():
    a,b=quantity(273.15),quantity(0,'degC')
    assert environment_feature('surface_temperature',a,b)['similarity_percent']==100
    b['comparison_contract']['statistic']='maximum'
    assert environment_feature('surface_temperature',a,b)['similarity_percent'] is None


@pytest.mark.parametrize('mutation',[
    {'status':'assumed'}, {'source':None}, {'value':None}, {'value':float('nan')},
    {'comparison_contract':{}}, {'unit':'unknown'}, {'time_coverage':None},
])
def test_missing_or_incompatible_evidence_cannot_be_scored(mutation):
    a=quantity(273.15)
    b=dict(a,**mutation)
    assert environment_feature('surface_temperature',a,b)['similarity_percent'] is None


def test_inapplicable_wind_is_not_zero_wind():
    result=environment_feature('wind_speed_10m',quantity(0,'m/s'),{'status':'not_applicable','value':None})
    assert result['similarity_percent'] is None
    assert result['status']=='physically_inapplicable'


def test_all_pairs_rank_without_claiming_scientific_accuracy():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    result=attach_matching(deepcopy(catalog),PUBLIC)['analog_matching']
    assert result==catalog['analog_matching']
    assert result==attach_matching(dict(catalog,sites=list(reversed(catalog['sites']))),PUBLIC)['analog_matching']
    rows=result['comparisons']
    maximum=min(10,sum(s['body']=='earth' for s in catalog['sites']))*sum(s['body']!='earth' for s in catalog['sites'])
    # Quality cutoffs may legitimately leave fewer than ten candidates for a target.
    assert len(rows) == maximum
    assert len({(r['earth_id'],r['planetary_id']) for r in rows}) == len(rows)
    for row in rows:
        assert row['total_similarity_percent'] is None
        assert row['environment_similarity_percent'] is None
        assert row['evidence_coverage_percent']==50
        assert row['validated_accuracy_percent'] is None and not row['scientifically_validated']
        assert row['verification']['catalog_features_reproduced']
        # The displayed score is half landform-family agreement, half terrain similarity.
        assert row['analog_score_percent']==pytest.approx(0.5*row['landform_match_percent']+0.5*row['terrain_similarity_percent'],abs=1e-3)
        low,high=row['verification']['terrain_range_percent']
        assert low-1e-3 <= row['terrain_similarity_percent'] <= high+1e-3
    for target in {r['planetary_id'] for r in rows}:
        candidates=[r for r in rows if r['planetary_id']==target]
        assert len(candidates) == 10
        assert [r['candidate_rank'] for r in candidates]==list(range(1,len(candidates)+1))
        proposed=[r for r in candidates if r['evidence_status']=='literature_informed_proposal']
        assert candidates[:len(proposed)]==proposed
        for tier in (proposed,candidates[len(proposed):]):
            assert [r['analog_score_percent'] for r in tier]==sorted((r['analog_score_percent'] for r in tier),reverse=True)


def test_screened_top_ten_exactly_matches_exhaustive_comparisons():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    fast=attach_matching(deepcopy(catalog),PUBLIC)['analog_matching']
    exhaustive=attach_matching(deepcopy(catalog),PUBLIC,exhaustive=True)['analog_matching']
    assert fast['comparisons']==exhaustive['comparisons']
    assert fast['selection']['pruned_pairs']>0
    assert fast['selection']['detailed_pairs']<exhaustive['selection']['detailed_pairs']
    # Exhaustive mode compares every pair that survives the data checks and the exploratory cutoff.
    assert exhaustive['selection']['detailed_pairs']==exhaustive['selection']['potential_pairs']-exhaustive['selection']['filtered_pairs']
    cutoff=exhaustive['selection']['min_exploratory_score_percent']
    assert all(r['analog_score_percent']>=cutoff for r in exhaustive['comparisons'] if r['evidence_status']=='exploratory_terrain_only')
    assert len(fast['selection']['screening'])==fast['selection']['potential_pairs']


def test_filter_rejects_missing_or_incompatible_inputs_without_geology_assumptions():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    site=deepcopy(next(s for s in catalog['sites'] if s['body']=='earth'))
    assert eligibility_reason(site) is None
    site['morphology']='different_landform'
    site['substrate']='unknown'
    assert eligibility_reason(site) is None
    site['comparison_features']['slope_mean']['analysis_resolution_m']=30
    assert 'incompatible' in eligibility_reason(site)
    site['terrain']=None
    assert 'No terrain' in eligibility_reason(site)


def test_stale_descriptor_cannot_prune_or_enter_the_shortlist():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    site=next(s for s in catalog['sites'] if s['body']=='earth')
    site['comparison_features']['relief']['value']+=500
    result=attach_matching(catalog,PUBLIC)['analog_matching']
    assert not any(r['earth_id']==site['id'] for r in result['comparisons'])
    rejected=[r for r in result['selection']['screening'] if r['earth_id']==site['id']]
    assert all(r['status']=='filtered' and 'reproduce' in r['reason'] for r in rejected)


def test_build_shares_one_source_sampling_pass_per_site(monkeypatch):
    from scripts.catalog import accuracy, matching
    from scripts.catalog.metadata import make_catalog
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    original=accuracy.site_samples
    calls={}
    def tracked(site,public):
        calls[site['id']]=calls.get(site['id'],0)+1
        return original(site,public)
    monkeypatch.setattr(accuracy,'site_samples',tracked)
    monkeypatch.setattr(matching,'site_samples',tracked)
    result=make_catalog(deepcopy(catalog['sites']),PUBLIC)
    assert result['analog_matching']==catalog['analog_matching']
    assert set(calls)=={s['id'] for s in catalog['sites']}
    assert set(calls.values())=={1}


def test_total_requires_complete_evidence_and_remains_engineering_index():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    earth=deepcopy(next(s for s in catalog['sites'] if s['id']=='amboy'))
    planet=deepcopy(next(s for s in catalog['sites'] if s['id']=='arsia-flank'))
    audit=next(p['accuracy_check'] for p in catalog['pairings'] if p['earth_id']=='amboy')
    for site in (earth,planet):
        site['conditions']={key:quantity(value,unit) for key,value,unit in [
            ('wind_speed_10m',5,'m/s'),('surface_temperature',273.15,'K'),
            ('air_temperature_2m',273.15,'K'),('albedo',0.2,'1')]}
        for key,p in site['conditions'].items():
            p['comparison_contract']['quantity_definition']=key
            p['comparison_contract']['reference_height_m']=10 if key=='wind_speed_10m' else 2 if key=='air_temperature_2m' else None
    result=comparison(earth,planet,audit,True)
    assert result['environment_similarity_percent']==100
    assert result['evidence_coverage_percent']==100
    assert result['total_similarity_percent']==round(50*audit['recomputed_terrain_score']+50,4)
    assert result['validated_accuracy_percent'] is None
    planet['conditions']['albedo']['value']=None
    assert comparison(earth,planet,audit,True)['total_similarity_percent'] is None
