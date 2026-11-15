from datetime import date, timedelta
import json

import numpy as np
import pytest
import rasterio
from rasterio.warp import reproject, Resampling

from scripts.catalog.assess_sources import weather_summary
from scripts.catalog.build import PUBLIC, sha
from scripts.catalog.diviner import thermal_bins


def weather():
    return {'daily_units': {'temperature_2m_mean': '\u00b0C', 'wind_speed_10m_mean': 'm/s'},
            'daily': {'time': [(date(2024, 1, 1)+timedelta(days=i)).isoformat() for i in range(366)],
                      'temperature_2m_mean': [None]*366, 'wind_speed_10m_mean': [0]*366}}


def test_alternative_weather_preserves_unknown_and_true_zero():
    summary = weather_summary(weather())
    assert summary['temperature_2m_mean']['value'] is None
    assert summary['temperature_2m_mean']['status'] == 'unknown'
    assert summary['wind_speed_10m_mean']['value'] == 0
    assert summary['wind_speed_10m_mean']['sample_count'] == 366


def test_alternative_weather_rejects_wrong_units_and_duplicate_days():
    data = weather()
    data['daily_units']['wind_speed_10m_mean'] = 'km/h'
    with pytest.raises(ValueError, match='units'):
        weather_summary(data)
    data = weather()
    data['daily']['time'][1] = data['daily']['time'][0]
    with pytest.raises(ValueError, match='unique'):
        weather_summary(data)


@pytest.mark.parametrize('sid', ['malapert-massif', 'mons-mouton'])
def test_lunar_terrain_and_thermal_summaries_reproduce_from_retained_data(sid, tmp_path):
    site = next(s for s in json.loads((PUBLIC/'sites.json').read_text())['sites'] if s['id'] == sid)
    pack = PUBLIC/'terrain'/sid
    with rasterio.open(pack/'elevation.tif') as dst, rasterio.open(pack/'source-window.tif') as src:
        actual = np.full((33, 33), np.nan, dtype='float32')
        reproject(rasterio.band(src, 1), actual, src_transform=src.transform, src_crs=src.crs,
                  dst_transform=dst.transform, dst_crs=dst.crs, dst_nodata=np.nan,
                  resampling=Resampling.bilinear)
        np.testing.assert_array_equal(actual, dst.read(1))
        assert np.isfinite(actual).all() and np.ptp(actual) > 1
    thermal = thermal_bins(site, tmp_path, offline=True, retained=pack/'diviner-cell.tab')
    for key, value in thermal.items():
        assert value == site['conditions'][key]
        assert sha(pack/'diviner-cell.tab') == value['source']['sha256']
    for key in ('air_temperature_2m', 'wind_speed_10m'):
        assert site['conditions'][key]['status'] == 'not_applicable'
        assert site['conditions'][key]['value'] is None
    assert site['study_status'] == 'research_area_not_landing_approval'


def test_diviner_never_silently_uses_a_polar_band_for_another_latitude(tmp_path):
    from scripts.catalog.diviner import band_for
    assert band_for(25) == ('20n30n', 20)
    assert band_for(-43.31) == ('50s40s', -50)
    assert band_for(-3) == ('10s00s', -10)
    assert band_for(90) == ('80n90n', 80)
    assert thermal_bins(dict(id='test', longitude=0, latitude=25), tmp_path, True) == {}


def test_missing_earth_weather_cache_cannot_erase_existing_conditions(tmp_path, monkeypatch):
    from scripts.catalog import build
    monkeypatch.setattr(build, 'CACHE', tmp_path)
    with pytest.raises(FileNotFoundError, match='Offline weather'):
        build.environment(dict(id='test', body='earth'), True)


@pytest.mark.parametrize('sid', ['cima-lava-field','sunset-crater','great-sand-dunes','bisti-badlands'])
def test_new_earth_packs_reproduce_with_retained_dem_and_weather(sid, tmp_path, monkeypatch):
    from scripts.catalog import build
    site = next(s for s in json.loads((PUBLIC/'sites.json').read_text())['sites'] if s['id']==sid)
    pack=PUBLIC/'terrain'/sid
    with rasterio.open(pack/'elevation.tif') as dst, rasterio.open(pack/'source-window.tif') as src:
        actual=np.full((161,161),np.nan,dtype='float32')
        reproject(rasterio.band(src,1),actual,src_transform=src.transform,src_crs=src.crs,
                  dst_transform=dst.transform,dst_crs=dst.crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
        np.testing.assert_allclose(actual,dst.read(1),rtol=0,atol=0.001)
        assert np.isfinite(actual).all() and np.ptp(actual)>1
    monkeypatch.setattr(build,'CACHE',tmp_path)
    environmental=build.environment(site,True)
    for key in ('wind_speed_10m','air_temperature_2m','surface_temperature','albedo'):
        assert environmental[key]==site['conditions'][key]
        assert environmental[key]['source']['response_sha256']==sha(pack/'power-daily-2024.json')
