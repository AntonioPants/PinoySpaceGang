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
