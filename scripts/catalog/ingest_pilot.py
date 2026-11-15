"""Acquire a measured stereo subset and stage an auditable, area-averaged pilot.

python -m scripts.catalog.ingest_pilot SITE [--offline]
Never changes sites.json, production rankings or physics. Raw source windows and
metadata are retained in the catalog cache; compact 30 m packs are public.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
import requests
from pyproj import CRS
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import Window, from_bounds

from .build import ROOT, PUBLIC, CACHE, dump, sha


def average_complete(raw, transform, source_crs, target_crs, affine, n, scale=1, offset=0):
    """Average physical heights; reject even partially missing destination cells.

    GDAL average ignores nodata, so a second warp explicitly averages a 0/1
    validity raster. A finite output alone is insufficient evidence of coverage.
    """
    valid = np.isfinite(raw)
    heights = np.where(valid, raw.astype('float64') * scale + offset, np.nan)
    out = np.full((n, n), np.nan, dtype='float32')
    coverage = np.zeros((n, n), dtype='float32')
    kwargs = dict(src_transform=transform, src_crs=source_crs,
                  dst_transform=affine, dst_crs=target_crs,
                  resampling=Resampling.average)
    reproject(heights, out, src_nodata=np.nan, dst_nodata=np.nan, **kwargs)
    reproject(valid.astype('float32'), coverage, dst_nodata=0, **kwargs)
    if not np.isfinite(out).all() or np.any(coverage < 1 - 1e-6):
        raise ValueError(f'Incomplete measured footprint: minimum cell coverage {coverage.min():.6f}; no filling allowed')
    return out, coverage


def source_window(url, path, target_crs, bounds, offline):
    receipt_path = path.with_suffix('.json')
    if not path.exists():
        if offline: raise FileNotFoundError(path)
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT='60', GDAL_HTTP_MAX_RETRY='2'):
            with rasterio.open('/vsicurl/' + url) as src:
                b = transform_bounds(target_crs, src.crs, *bounds, densify_pts=101)
                w = from_bounds(*b, src.transform)
                x, y = math.floor(w.col_off)-3, math.floor(w.row_off)-3
                w = Window(x, y, math.ceil(w.col_off+w.width)+3-x, math.ceil(w.row_off+w.height)+3-y)
                if x < 0 or y < 0 or x+w.width > src.width or y+w.height > src.height:
                    raise ValueError('Required footprint extends outside raster')
                if w.width*w.height > 80_000_000: raise ValueError('Source subset exceeds 80 million pixel budget')
                print('Reading measured subset', path.stem, list(w.flatten()), flush=True)
                raw = src.read(1, window=w, masked=True).astype('float32').filled(np.nan)
                path.parent.mkdir(parents=True, exist_ok=True)
                with rasterio.open(path, 'w', driver='GTiff', height=raw.shape[0], width=raw.shape[1],
                                   count=1, dtype='float32', nodata=np.nan, crs=src.crs,
                                   transform=src.window_transform(w), compress='deflate') as dst: dst.write(raw, 1)
                dump(receipt_path, {'url':url, 'subset_sha256':sha(path), 'source_window':list(w.flatten()),
                    'source_crs_wkt':src.crs.to_wkt(), 'scale':src.scales[0], 'offset':src.offsets[0],
                    'source_tags':src.tags(), 'source_shape':list(src.shape), 'source_spacing':list(src.res),
                    'finite_source_fraction':float(np.isfinite(raw).mean())})
    receipt = json.loads(receipt_path.read_text())
    if receipt['url'] != url or receipt['subset_sha256'] != sha(path): raise ValueError('Source receipt mismatch')
    with rasterio.open(path) as src: return src.read(1), src.transform, src.crs, receipt


def retain_metadata(product, folder, offline):
    results = []
    for name, url in product.get('metadata_urls', {}).items():
        path = folder / (name+'.txt')
        if not path.exists():
            if offline: raise FileNotFoundError(path)
            # PDS3 HiRISE labels are attached; read only their first record.
            with requests.get(url, headers={'Range':'bytes=0-32767'}, timeout=(20,60), stream=True) as r:
                r.raise_for_status()
                data = next(r.iter_content(32768))
                if b'PDS_VERSION_ID' in data and b'\r\nEND\r\n' in data:
                    data = data[:data.index(b'\r\nEND\r\n')+7]
                path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
                dump(path.with_suffix('.receipt.json'), {'url':url,'resolved_url':r.url,'sha256':sha(path)})
        receipt=json.loads(path.with_suffix('.receipt.json').read_text())
        if receipt['url']!=url or receipt['sha256']!=sha(path): raise ValueError('Metadata checksum mismatch')
        results.append({'name':name, **receipt})
    return results


def ingest(site_id, offline=False):
    config=json.loads((ROOT/'data/terrain-upgrade-pilots.json').read_text())
    product=next(p for p in config['pilots'] if p['site_id']==site_id)
    catalog=json.loads((PUBLIC/'sites.json').read_text())
    site=next(s for s in catalog['sites'] if s['id']==site_id)
    radius=3396190 if site['body']=='mars' else 1737400
    crs=CRS.from_proj4(f'+proj=aeqd +lat_0={site["latitude"]} +lon_0={site["longitude"]} +R={radius} +units=m')
    n, cell=151, 30
    half=n*cell/2
    affine=from_origin(-half,half,cell,cell)
    folder=CACHE/'terrain-pilots'/product['product_id']
    metadata=retain_metadata(product,folder,offline)
    raw, transform, src_crs, receipt=source_window(product['raster_url'],folder/'elevation-source.tif',crs,(-half,-half,half,half),offline)
    z, coverage=average_complete(raw,transform,src_crs,crs,affine,n,receipt['scale'],receipt['offset'])
    quality=None
    if product.get('quality_raster_url'):
        q, qt, qc, qr=source_window(product['quality_raster_url'],folder/'quality-codes.tif',crs,(-half,-half,half,half),offline)
        vals, counts=np.unique(q[np.isfinite(q)],return_counts=True)
        good=np.isin(q,product.get('accepted_quality_codes',[])).astype('float32')
        support=np.zeros((n,n),dtype='float32')
        reproject(good,support,src_transform=qt,src_crs=qc,dst_transform=affine,dst_crs=crs,
                  resampling=Resampling.average,dst_nodata=0)
        quality={'receipt':qr,'code_counts':{str(int(v)):int(c) for v,c in zip(vals,counts)},
                 'accepted_codes':product.get('accepted_quality_codes',[]),
                 'mean_accepted_fraction':float(support.mean()),'minimum_cell_accepted_fraction':float(support.min()),
                 'scope':'Source subset including crop margin; codes require product documentation. Finite DTM is not proof of reliable stereo correlation.'}
    output=PUBLIC/'terrain-pilots'/site_id
    output.mkdir(parents=True,exist_ok=True)
    z.astype('<f4').tofile(output/'elevation.f32')
    manifest={'schema_version':1,'id':site_id,'name':site['name']+' — stereo pilot','body':site['body'],
        'grid':{'rows':n,'columns':n,'spacing_m':cell,'dtype':'float32','byte_order':'little-endian',
                'sample_file':'elevation.f32','order':'north-first, west-first','crs_wkt':crs.to_wkt(),'affine':list(affine)[:6]},
        'local_frame':{'vertical_offset_m':float(math.floor(z.min()))},
        'source':{'url':product['raster_url'],'product_id':product['product_id'],
                  'native_spacing_m_approx':product['posting_m'],'vertical_datum':product['vertical_datum'],
                  'subset_sha256':receipt['subset_sha256'],'coverage':product.get('acquisition_period'),
                  'resampling':'Area average of finite physical metre elevations; no gap filling.',
                  'scale_applied':receipt['scale'],'offset_applied':receipt['offset']},
        'attribution':product['attribution'],'license_url':product['license_url'],
        'limitations':['Measured stereo pilot; independent geological and artifact review pending.',
                      '30 m averaging is not a claim of 30 m effective accuracy. Subpixel hazards unresolved.',
                      'Comparison only; production scores and Earth landing physics are unchanged.']}
    dump(output/'manifest.json',manifest)
    report={'site_id':site_id,'product_id':product['product_id'],
            'product_config_sha256':hashlib.sha256(json.dumps(product,sort_keys=True).encode()).hexdigest(),
            'catalog_elevation_sha256':site['terrain']['elevation_sha256'],
            'pilot_elevation_sha256':sha(output/'elevation.f32'),
            'manifest_url':f'/terrain-pilots/{site_id}/manifest.json','manifest_sha256':sha(output/'manifest.json'),
            'source_receipt':receipt,'metadata':metadata,'quality':quality,
            'centre_latitude':site['latitude'],'centre_longitude':site['longitude'],
            'output_spacing_m':cell,'window_m':n*cell,'minimum_cell_valid_fraction':float(coverage.min()),
            'relative_vertical_error_m':product.get('relative_vertical_error_m'),
            'error_definition':product.get('error_definition'),'expert_review':'pending',
            'status':'measured_subset_staged','production_changed':False,
            'generator_sha256':sha(Path(__file__)),
            'reproduction_command':f'python -m scripts.catalog.ingest_pilot {site_id} --offline'}
    dump(output/'audit.json',report)
    dump(output/'checksums.json',{p.name:sha(p) for p in output.iterdir() if p.name!='checksums.json'})
    print('Staged measured pilot:',site_id,'range',float(z.min()),float(z.max()),flush=True)
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site');parser.add_argument('--offline',action='store_true');args=parser.parse_args()
    ingest(args.site,args.offline)
