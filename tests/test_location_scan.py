import json
import numpy as np
import pytest
from scripts.locations import scan
from scripts.locations.regions import initial_regions
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds
from scripts.locations.store import WindowStore
from scripts.locations.materialize import stage_window, validate_pack


def defaults():
    return {'min_allowed_fraction':0.8,'max_excluded_fraction':0.05,'max_nodata_fraction':0.01,'max_download_gb':20}


def test_class_filter_never_turns_water_or_nodata_into_bare_ground():
    assert scan.land_cover(np.full((10,10),60),defaults())['accepted']
    assert scan.land_cover(np.full((10,10),70),defaults())['accepted']
    for value in (0,10,40,50,80,90,95,255):
        assert not scan.land_cover(np.full((10,10),value),defaults())['accepted']
    values=np.full(100,60); values[:6]=80
    assert not scan.land_cover(values,defaults())['accepted']
    values[:6]=20
    assert scan.land_cover(values,defaults())['accepted']


def test_tile_enumeration_handles_negative_degrees_and_edges():
    dem=scan.tile_urls((-1.1,-1.1,-0.9,-0.9),'dem')
    assert len(dem)==4 and len({t['id'] for t in dem})==4
    assert 'S02_00_W002' in dem[0]['id']
    assert len(scan.tile_urls((0,0,1,1),'dem'))==1
    mask=scan.tile_urls((-3,-3,0,0),'mask')
    assert len(mask)==1 and 'S03W003' in mask[0]['id']


def test_plan_fails_budget_before_network(monkeypatch):
    monkeypatch.setattr(scan,'session',lambda:pytest.fail('No network in plan'))
    with pytest.raises(ValueError,match='budget'):
        scan.plan({'defaults':defaults()},[{'id':'test','bbox':[0,0,0.1,0.1]}],max_gb=0.001)


def test_region_configuration_covers_all_existing_seeds_and_limits_batch():
    c,active=scan.config()
    sites=json.loads((scan.ROOT/'web/public/sites.json').read_text(encoding='utf-8'))['sites']
    expected={s['id'] for s in sites if s['body']=='earth' and not s['id'].startswith('scan-')}
    actual=[sid for r in c['regions'] for sid in r['seed_site_ids']]
    assert set(actual)==expected and len(actual)==len(set(actual))
    assert len(active)==30
    assert len({r['country'] for r in active})==26


def test_invalid_region_and_unknown_selection_are_rejected(tmp_path):
    c,_=scan.config()
    c['regions'][0]['bbox']=[0,0,20,20]
    path=tmp_path/'regions.json'; path.write_text(json.dumps(c))
    with pytest.raises(ValueError,match='200 km'): scan.config(path)
    with pytest.raises(ValueError,match='Unknown region'): scan.config(region_ids=['missing'])


@pytest.fixture
def window_fixture(tmp_path,monkeypatch):
    """Synthetic asymmetric heights are test data only, never production assets."""
    monkeypatch.setattr(scan,'ROOT',tmp_path)
    folder=tmp_path/'data/raw/location-scan/regions/test-region'
    folder.mkdir(parents=True)
    affine=from_origin(500000,4000000,30,30)
    values=(np.arange(321)[:,None]*1000+np.arange(321)[None,:]).astype('float32')
    with rasterio.open(folder/'dem.tif','w',driver='GTiff',height=321,width=321,
                       count=1,dtype='float32',crs='EPSG:32612',transform=affine,nodata=np.nan) as dst:
        dst.write(values,1)
    with rasterio.open(folder/'mask.tif','w',driver='GTiff',height=963,width=963,
                       count=1,dtype='uint8',crs='EPSG:32612',transform=from_origin(500000,4000000,10,10),nodata=0) as dst:
        dst.write(np.full((963,963),60,dtype='uint8'),1)
    bbox=transform_bounds('EPSG:32612','EPSG:4326',499990,3990360,509640,4000010)
    region={'id':'test-region','name':'Test region','bbox':bbox,'anchor':[-111,36],
            'target_types':['crater_rim'],'source_url':'https://example.com/test-only','country':'Test'}
    receipt={'region':region,'sources':{'dem':{'sha256':scan.sha(folder/'dem.tif'),
        'tiles':[{'url':'https://example.com/test-only','tile_id':'test','sha256':'0'*64}]},
        'mask':{'sha256':scan.sha(folder/'mask.tif')}}}
    settings=dict(defaults(),stride_m=2400,window_samples=161,spacing_m=30)
    rows,stats=scan.windows(region,folder,receipt,settings)
    assert len(rows)==9 and stats['considered']==9
    index=tmp_path/'index'; index.mkdir()
    (index/'windows.jsonl').write_text(''.join(json.dumps(row)+'\n' for row in rows))
    scan.dump(index/'sources.json',{'region_receipts':{'test-region':receipt}})
    scan.dump(index/'manifest.json',{'window_count':len(rows),'index_sha256':scan.sha(index/'windows.jsonl'),
                                    'sources_sha256':scan.sha(index/'sources.json')})
    return tmp_path,index,rows,folder,values


def test_window_reader_preserves_asymmetric_rows_columns_and_coordinates(window_fixture):
    root,index,rows,folder,values=window_fixture
    with WindowStore(index,root) as store:
        row,z,affine,_=store.read(rows[4]['id'])
        assert row['terrain_window']['row']==80 and row['terrain_window']['column']==80
        np.testing.assert_array_equal(z,values[80:241,80:241])
        assert z[0,1]-z[0,0]==1
        assert z[1,0]-z[0,0]==1000
        assert affine*(0.5,0.5)==(502415,3997585)
        assert affine.e==-30 and affine.a==30


def test_reader_rejects_stale_receipts_and_elevation(window_fixture):
    root,index,rows,folder,_=window_fixture
    with rasterio.open(folder/'dem.tif','r+') as dst:
        dst.write(np.array([[np.nan]],dtype='float32'),1,window=rasterio.windows.Window(0,0,1,1))
    with WindowStore(index,root) as store:
        with pytest.raises(ValueError,match='DEM checksum'): store.read(rows[0]['id'])
    (index/'sources.json').write_text('{}')
    with pytest.raises(ValueError,match='receipts checksum'): WindowStore(index,root)


def test_materialization_is_pack_only_and_matches_reader(window_fixture):
    root,index,rows,folder,values=window_fixture
    destination=root/'staging'
    with WindowStore(index,root) as store:
        stage_window(rows[0]['id'],store=store,destination=destination)
    pack=destination/'terrain'/rows[0]['id']
    manifest=validate_pack(pack)
    assert manifest['grid']['order']=='north-first, west-first'
    np.testing.assert_array_equal(np.fromfile(pack/'elevation.f32',dtype='<f4').reshape(161,161),values[:161,:161])
    assert not (destination/'sites.json').exists()
    handoff=json.loads((destination/'handoff.json').read_text())
    assert handoff['catalog_registration_status']=='awaiting_review'
    assert 'matches' not in handoff and 'score' not in handoff


def test_scan_rejects_missing_elevation_without_filling(window_fixture):
    root,index,rows,folder,_=window_fixture
    receipt=json.loads((index/'sources.json').read_text())['region_receipts']['test-region']
    with rasterio.open(folder/'dem.tif','r+') as dst:
        dst.write(np.array([[np.nan]],dtype='float32'),1,window=rasterio.windows.Window(0,0,1,1))
    accepted,stats=scan.windows(receipt['region'],folder,receipt,dict(defaults(),stride_m=2400,window_samples=161,spacing_m=30))
    assert stats['rejected']['dem_nodata']==1
    assert len(accepted)==8 and rows[0]['id'] not in {r['id'] for r in accepted}


def test_reader_checks_geographic_metadata_even_when_index_hash_matches(window_fixture):
    root,index,rows,folder,_=window_fixture
    rows[0]['longitude']+=0.0001
    (index/'windows.jsonl').write_text(''.join(json.dumps(row)+'\n' for row in rows))
    manifest=json.loads((index/'manifest.json').read_text())
    manifest['index_sha256']=scan.sha(index/'windows.jsonl')
    scan.dump(index/'manifest.json',manifest)
    with WindowStore(index,root) as store:
        with pytest.raises(ValueError,match='centre mismatch'): store.read(rows[0]['id'])
