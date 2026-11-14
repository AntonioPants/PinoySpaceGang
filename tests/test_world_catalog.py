"""International catalog additions and georeferencing, independent of ranking policy."""
import json

import numpy as np
import pytest
import rasterio
from pyproj import Transformer
from rasterio.warp import reproject, Resampling

from scripts.catalog import build

SITES = {
    'teide-canadas': ('Spain', 32628),
    'etna-east': ('Italy', 32633),
    'fournaise-enclos': ('France', 32740),
    'fogo-caldera': ('Cabo Verde', 32626),
    'bromo-sandsea': ('Indonesia', 32749),
    'pinacate-elegante': ('Mexico', 32612),
    'bardenas-blanca': ('Spain', 32630),
    'tabernas-badlands': ('Spain', 32630),
    'ischigualasto': ('Argentina', 32719),
    'talampaya-canyon': ('Argentina', 32719),
    'valle-luna-chile': ('Chile', 32719),
    'uyuni-incahuasi': ('Bolivia', 32719),
    'makgadikgadi-kubu': ('Botswana', 32735),
    'tsondab-dunes': ('Namibia', 32733),
    'rub-khali-oman': ('Oman', 32640),
    'badain-jaran': ('China', 32648),
    'taklamakan-interior': ('China', 32644),
    'lut-yardangs': ('Iran', 32640),
    'dunhuang-yardangs': ('China', 32646),
    'dallol': ('Ethiopia', 32637),
    'lake-abbe-margin': ('Djibouti', 32637),
    'hverir-namafjall': ('Iceland', 32628),
    'pingualuit': ('Canada', 32618),
    'wadi-rum': ('Jordan', 32636),
    'richat-ridges': ('Mauritania', 32629),
    'harrat-khaybar': ('Saudi Arabia', 32637),
    'payun-matru': ('Argentina', 32719),
    'tongariro-west': ('New Zealand', 32760),
    'erg-chebbi': ('Morocco', 32630),
    'lanzarote-timanfaya': ('Spain', 32628),
    'askja-east': ('Iceland', 32628),
    'atacama-yungay': ('Chile', 32719),
    'sossusvlei-dunes': ('Namibia', 32733),
    'lonar-crater': ('India', 32643),
    'wolfe-creek': ('Australia', 32752),
}


@pytest.mark.parametrize('lon,lat,epsg', [(-69.86,-24.08,32719),(15.30,-24.77,32733),
    (127.795,-19.171,32752),(-16.60,65.055,32628),(180,0,32660),(-180,0,32601)])
def test_utm_hemisphere_and_zone(lon, lat, epsg):
    crs=build.earth_utm_crs(lon,lat)
    assert crs.to_epsg()==epsg
    east,north=Transformer.from_crs(4326,crs,always_xy=True).transform(lon,lat)
    assert 0<=north<=10_000_000
    back=Transformer.from_crs(crs,4326,always_xy=True).transform(east,north)
    np.testing.assert_allclose(back,(lon,lat),atol=1e-8)


@pytest.mark.parametrize('lon,lat', [(0,-85),(0,85),(181,0),(float('nan'),0)])
def test_unsupported_geographic_inputs_fail_explicitly(lon,lat):
    with pytest.raises(ValueError,match='UTM latitude'):
        build.earth_utm_crs(lon,lat)


@pytest.mark.parametrize('sid', SITES)
def test_international_pack_has_real_reproducible_data_and_sourced_handoff(sid,tmp_path,monkeypatch):
    catalog=json.loads((build.PUBLIC/'sites.json').read_text())
    site=next(s for s in catalog['sites'] if s['id']==sid)
    country,epsg=SITES[sid]
    assert country in site['region']
    assert site['body']=='earth' and site['role']=='earth_analog'
    pack=build.PUBLIC/'terrain'/sid
    with rasterio.open(pack/'elevation.tif') as dst, rasterio.open(pack/'source-window.tif') as src:
        assert dst.crs.to_epsg()==epsg
        assert dst.transform.a==30 and dst.transform.e==-30
        east,north=Transformer.from_crs(4326,dst.crs,always_xy=True).transform(site['longitude'],site['latitude'])
        assert dst.index(east,north)==(80,80)
        actual=np.full((161,161),np.nan,dtype='float32')
        reproject(rasterio.band(src,1),actual,src_transform=src.transform,src_crs=src.crs,
            dst_transform=dst.transform,dst_crs=dst.crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
        assert np.isfinite(actual).all() and np.ptp(actual)>1
        np.testing.assert_allclose(actual,dst.read(1),rtol=0,atol=0.001)
        np.testing.assert_array_equal(dst.read(1).ravel(),np.fromfile(pack/'elevation.f32',dtype='<f4'))
    monkeypatch.setattr(build,'CACHE',tmp_path)
    weather=build.environment(site,True)
    for key in ('wind_speed_10m','air_temperature_2m','surface_temperature','albedo'):
        assert weather[key]==site['conditions'][key]
        assert weather[key]['source']['response_sha256']==build.sha(pack/'power-daily-2024.json')
    for key in ('friction','cohesion','bulk_density'):
        assert site['conditions'][key]['value'] is None
    assert site['matches']
    for pair in (p for p in catalog['pairings'] if p['earth_id']==sid):
        assert pair['explanation']['status']=='proposed_unvalidated'
        assert pair['explanation']['matches'] and pair['explanation']['differences']
