import numpy as np
import pytest
from scripts.catalog.terrain_features import describe,sample


def test_plane_slope_and_datum_invariance():
    y,x=np.mgrid[:101,:101]
    z=x*30*np.tan(np.radians(12))
    a,b=describe(z,30),describe(z+1e6,30)
    assert a['values']['slope_p90']==pytest.approx(12)
    assert a['values']['slope_gt_10']==1 and a['values']['slope_gt_15']==0
    for key,v in a['values'].items():
        assert b['values'][key]==pytest.approx(v,abs=1e-7)
    assert a['values']['bowl_share']==a['values']['ridge_share']==0


def test_bowl_and_ridge_signs_and_flat_convention():
    y,x=np.mgrid[-20:21,-20:21]
    bowl=describe((x*x+y*y).astype(float),30)['values']
    ridge=describe(-(x*x+y*y).astype(float),30)['values']
    assert bowl['bowl_share']==ridge['ridge_share']
    flat=describe(np.ones((33,33)),150)['values']
    assert flat['hypsometric_integral']==0.5 and flat['relief']==0
    assert flat['roughness_150m'] is None
    assert flat['roughness_450m']==0


def test_nodata_and_out_of_bounds_are_not_silently_filled():
    with pytest.raises(ValueError): describe(np.full((4,4),np.nan),1000)
    assert sample(np.ones((161,161)),30,150,(10000,0)) is None
