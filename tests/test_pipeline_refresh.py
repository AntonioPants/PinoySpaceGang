import json
from pathlib import Path
import numpy as np
import pytest
from scripts.catalog.build import PUBLIC, sha
from scripts.catalog.diviner import thermal_bins, band_for
from scripts.catalog.comparison_notes import comparison_notes

def test_current_coverage_and_scan_include_every_catalog_target():
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    coverage=json.loads(Path('data/catalog-coverage.json').read_text())
    scan=json.loads(Path('data/earth_index/matches.json').read_text())
    assert {r['id'] for r in coverage['sites']}=={r['id'] for r in catalog['sites']}
    assert set(scan['targets'])=={r['id'] for r in catalog['sites'] if r['body']!='earth'}

@pytest.mark.parametrize('sid',['apollo-11-tranquillity','apollo-12-procellarum','tycho-central-peak','peary-rim'])
def test_new_diviner_bands_reproduce_retained_values(sid,tmp_path):
    site=next(s for s in json.loads((PUBLIC/'sites.json').read_text())['sites'] if s['id']==sid)
    result=thermal_bins(site,tmp_path,offline=True,retained=PUBLIC/'terrain'/sid/'diviner-cell.tab')
    assert result
    for key,value in result.items(): assert value==site['conditions'][key]

def test_scanned_earth_weather_is_sourced_not_copied_from_seed():
    sites=json.loads((PUBLIC/'sites.json').read_text())['sites']
    scans=[s for s in sites if s.get('catalog_origin')=='regional_scan']
    for site in scans:
        path=PUBLIC/'terrain'/site['id']/'power-daily-2024.json'
        raw=json.loads(path.read_text())
        assert raw['geometry']['coordinates'][:2]==pytest.approx([site['longitude'],site['latitude']],abs=.001)
        for key,parameter in [('wind_speed_10m','WS10M'),('surface_temperature','TS'),('albedo','ALLSKY_SRF_ALB')]:
            record=site['conditions'][key]
            vals=[v for v in raw['properties']['parameter'][parameter].values() if v!=raw['header']['fill_value'] and np.isfinite(v)]
            assert record['value']==pytest.approx(np.mean(vals))
            assert record['source']['response_sha256']==sha(path)
            assert record['status']=='modeled'

def test_explanations_do_not_promote_exploratory_pairs():
    sites=json.loads((PUBLIC/'sites.json').read_text())['sites'];earth=next(s for s in sites if s['body']=='earth');target=next(s for s in sites if s['id']=='apollo-11-tranquillity')
    notes=comparison_notes(earth,target,'different_family')
    assert notes['status']=='catalog_interpretation_unreviewed'
    assert 'not a published endorsement' in notes['scope']
    assert notes['sources']==[earth['evidence_url'],target['evidence_url']]
    assert target['description'] in notes['differences'][0]

@pytest.mark.parametrize('lat',[float('nan'),91,-91])
def test_diviner_invalid_latitude_rejected(lat):
    with pytest.raises(ValueError):band_for(lat)
