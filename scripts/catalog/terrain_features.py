"""Physical-scale terrain descriptors, independent of ranking and vertical datum."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling
from scipy.ndimage import uniform_filter

from .accuracy import OFFSETS
from .build import PUBLIC, ROOT, dump

VERSION = '2.0.0'
METHOD = 'v2_multifeature_common_resolution'
UNITS = {'slope_mean': 'deg', 'slope_p90': 'deg', 'relief': 'm',
         **{f'slope_gt_{v}': '1' for v in (5, 10, 15, 20)},
         **{f'roughness_{v}m': 'm' for v in (150, 450, 1000)},
         'bowl_share': '1', 'ridge_share': '1', 'hypsometric_integral': '1',
         'roughness_fine':'m','roughness_mid':'m','roughness_coarse':'m'}


def describe(z, cell):
    """Finite north-first metre grid; neighbourhood outputs use interior cells only."""
    z = np.asarray(z, dtype='float64')
    if z.ndim != 2 or min(z.shape)<3 or not np.isfinite(z).all() or cell<=0:
        raise ValueError('Requires a finite 2D grid, at least 3 cells per side, positive metre spacing')
    dy, dx = np.gradient(z, cell)
    slope = np.degrees(np.arctan(np.hypot(dx,dy)))
    relief = float(np.ptp(z))
    values = {'slope_mean': float(slope.mean()), 'slope_p90': float(np.percentile(slope,90)),
              'relief': relief, 'hypsometric_integral': float((z.mean()-z.min())/relief) if relief>1e-9 else 0.5}
    values.update({f'slope_gt_{v}': float(np.mean(slope>v)) for v in (5,10,15,20)})
    support, unavailable = {}, {}
    for width in (150,450,1000):
        key=f'roughness_{width}m'
        n=int(np.ceil(width/cell))
        if n%2==0: n+=1
        support[key]=n*cell
        if n<3 or n>min(z.shape):
            values[key]=None
            unavailable[key]='Requested support is unresolved at this spacing or exceeds the analysis window; not upsampled into evidence.'
            continue
        half=n//2
        centered=z-z.mean()  # avoids cancellation when elevations have a large datum offset
        mean=uniform_filter(centered,n)
        rms=np.sqrt(np.maximum(0,uniform_filter(centered**2,n)-mean**2))
        values[key]=float(rms[half:-half,half:-half].mean())
    # Dimensionless TPI relative to local RMS; same 1000m minimum support on both bodies.
    n=max(3,int(np.ceil(1000/cell)))
    if n%2==0: n+=1
    half=n//2
    if n>min(z.shape):
        values.update(bowl_share=None,ridge_share=None)
        unavailable.update({k:'TPI neighbourhood exceeds analysis window.' for k in ('bowl_share','ridge_share')})
    else:
        centered=z-z.mean()
        mean=uniform_filter(centered,n)
        rms=np.sqrt(np.maximum(0,uniform_filter(centered**2,n)-mean**2))
        tpi=np.divide(centered-mean,rms,out=np.zeros_like(z),where=rms>1e-9)[half:-half,half:-half]
        values.update(bowl_share=float(np.mean(tpi < -0.5)),ridge_share=float(np.mean(tpi > 0.5)))
    support.update(bowl_share=n*cell,ridge_share=n*cell)
    # Remove one best-fit regional plane before scale-specific residual roughness.
    yy,xx=np.indices(z.shape,dtype=float)
    design=np.column_stack((np.ones(z.size),xx.ravel(),yy.ravel()))
    residual=(z.ravel()-design@np.linalg.lstsq(design,z.ravel(),rcond=None)[0]).reshape(z.shape)
    for key,n in [('roughness_fine',3),('roughness_mid',5),('roughness_coarse',7)]:
        support[key]=n*cell
        if n>min(z.shape):
            values[key]=None
            unavailable[key]='Neighbourhood exceeds analysis window.'
        else:
            half=n//2
            rms=np.sqrt(np.maximum(0,uniform_filter(residual**2,n)-uniform_filter(residual,n)**2))
            values[key]=float(rms[half:-half,half:-half].mean())
    return {'values':values,'units':UNITS,'neighbourhood_support_m':support,
            'unavailable':unavailable,'cell_size_m':cell,'window_m':cell*z.shape[0],
            'rows':z.shape[0],'columns':z.shape[1]}


def sample(z, spacing, cell=1000.0, offset=(0,0)):
    # Largest integer number of cells <=4km: common physical support within each pair.
    n=int(np.floor(4000/cell))
    width=n*cell
    left=(z.shape[1]*spacing-width)/2+offset[0]
    top=(z.shape[0]*spacing-width)/2-offset[1]
    if n<3 or min(left,top)<0 or left+width>z.shape[1]*spacing or top+width>z.shape[0]*spacing:
        return None
    out=np.full((n,n),np.nan,dtype='float64')
    reproject(z.astype('float64'),out,src_transform=from_origin(0,0,spacing,spacing),
        dst_transform=from_origin(left,-top,cell,cell),src_crs='EPSG:3857',dst_crs='EPSG:3857',
        src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.average)
    return describe(out,cell) if np.isfinite(out).all() else None


def common_resolution(spacing):
    """Prototype adapter: never claim resolution finer than the supplied grid."""
    return max(150.0,float(spacing))


def features(z,spacing,resolution,offset=(0,0)):
    if resolution < spacing: return None
    p=sample(z,spacing,resolution,offset)
    return p['values'] if p else None


def robust_scales(vectors):
    """Experimental reference spread; production must freeze the fitted output."""
    result={}
    for key in UNITS:
        vals=np.array([v[key] for v in vectors if v.get(key) is not None],dtype=float)
        if len(vals)!=len(vectors) or not np.isfinite(vals).all(): continue
        mad=float(np.median(np.abs(vals-np.median(vals))))*1.4826
        iqr=float(np.subtract(*np.percentile(vals,[75,25])))/1.349
        scale=max(mad,iqr)
        if scale>1e-9: result[key]=scale
    return result


def similarity_percent(a,b,scales):
    if not scales or any(a.get(k) is None or b.get(k) is None for k in scales): return None
    distance=np.mean([abs(a[k]-b[k])/s for k,s in scales.items()])
    return float(100*np.exp(-distance))


def pack_grid(site,public):
    t=site['terrain']
    path=Path(public)/t['manifest_url'].lstrip('/')
    m=json.loads(path.read_text(encoding='utf-8'))
    raw=(path.parent/m['grid']['sample_file']).read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=t['elevation_sha256']:
        raise ValueError(f'{site["id"]}: grid checksum mismatch')
    return np.frombuffer(raw,dtype='<f4').reshape(t['rows'],t['columns']),t['spacing_m'],{
        'source_url':t['source_url'],'elevation_sha256':digest,'license_url':m.get('license_url') or m['source']['license_url'],
        'time_coverage':m['source'].get('coverage') or m['source'].get('acquisition_period'),'native_resolution_m_approx':t['native_resolution_m_approx'],
        'method':'Area-average metric cells; finite-difference slopes; local RMS height, standardized TPI, normalized hypsometry. See docs/ANALOG_MATCHING.md.',
        'status':'derived','vertical_datum':m['source'].get('vertical_datum'),
        'caveat':'Engineering descriptors of a regional surface model; no scientific equivalence or subpixel detail.'}


def generate(catalog,public=PUBLIC,cells=(1000.0,)):
    sites={}
    for site in sorted(catalog['sites'],key=lambda s:s['id']):
        if not site.get('terrain'): continue
        z,spacing,provenance=pack_grid(site,public)
        profiles={str(cell):[sample(z,spacing,cell,offset) for offset in OFFSETS] for cell in cells}
        sites[site['id']]={'provenance':provenance,'profiles':profiles}
    return {'descriptor_version':VERSION,'offsets_east_north_m':OFFSETS,
        'provenance_scope':'Each site provenance applies to every number in its profiles; support metadata are processing parameters.',
        'sites':sites}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'data/terrain-descriptors.json')
    args=parser.parse_args()
    catalog=json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    dump(args.output,generate(catalog))


if __name__=='__main__': main()
