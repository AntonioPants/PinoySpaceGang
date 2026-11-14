import numpy as np
from scripts.catalog.scoring import compare
from scripts.catalog.build import descriptors
from rasterio.transform import from_origin

def test_missing_is_not_zero():
    assert compare({}, {})['terrain_score'] is None
    assert compare({}, {})['coverage']==0

def test_common_scale_and_fixed_population():
    z=np.tile(np.arange(161,dtype='float32'),(161,1))
    a=descriptors(z,from_origin(0,0,30,30),{'product_id':'synthetic-test','url':'https://example.org'},30)
    assert a['slope_mean']['analysis_resolution_m']==1000
    assert compare(a,a)['terrain_score']==1
    b={k:dict(v) for k,v in a.items()}; b['relief']['analysis_resolution_m']=500
    assert compare(a,b)['terrain_score'] is None
    assert compare(a,a)==compare(a,a)

def test_fixed_distance_contributions_and_nonfinite():
    def record(value):
        return {'value':value,'status':'derived','analysis_resolution_m':1000,'unit':'m'}
    a={k:record(0) for k in ['slope_mean','roughness_rms','relief']}
    b={k:record(v) for k,v in [('slope_mean',15),('roughness_rms',75),('relief',500)]}
    assert compare(a,b)['terrain_score']==0.3
    assert compare(a,b)['coverage']==1
    b['relief']['value']=float('nan')
    assert compare(a,b)['terrain_score'] is None
    assert compare(a,b)['coverage']==0.8


def test_new_real_terrain_windows_reproduce_from_native_samples():
    import json
    from pathlib import Path
    import rasterio
    from rasterio.warp import reproject, Resampling
    root = Path(__file__).resolve().parents[1]
    catalog = json.loads((root / 'web/public/sites.json').read_text())
    for sid in ['haughton', 'qaidam']:
        site = next(s for s in catalog['sites'] if s['id'] == sid)
        folder = root / 'web/public/terrain' / sid
        manifest = json.loads((folder / 'manifest.json').read_text())
        values = np.fromfile(folder / 'elevation.f32', dtype='<f4').reshape(161, 161)
        assert np.isfinite(values).all() and np.ptp(values) > 1
        with rasterio.open(folder / 'elevation.tif') as dst:
            np.testing.assert_array_equal(values, dst.read(1))
            reprojection = np.full_like(values, np.nan)
            with rasterio.open(folder / manifest['source']['subset_file']) as src:
                reproject(rasterio.band(src, 1), reprojection,
                          src_transform=src.transform, src_crs=src.crs,
                          dst_transform=dst.transform, dst_crs=dst.crs,
                          dst_nodata=np.nan, resampling=Resampling.bilinear)
            np.testing.assert_allclose(values, reprojection, rtol=0, atol=0.001)
        assert site['completeness']['terrain_available'] is True
        assert manifest['source']['vertical_datum'] == 'EGM2008'
    assert next(s for s in catalog['sites'] if s['id'] == 'qaidam')['matches'] == []
    assert not any(p['earth_id'] == 'qaidam' for p in catalog['pairings'])
