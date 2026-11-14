"""Build-time location scanning. No ranking, scoring, browser APIs or invented terrain.

plan prints area/size before retrieval; run downloads only region-intersecting tiles.
The output index is a location handoff for the separately owned accuracy pipeline.
"""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from pyproj import CRS, Transformer
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import Window
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .regions import ROOT, dimensions

RAW=ROOT/'data/raw/location-scan'
INDEX=ROOT/'data/earth_index'
CONFIG=ROOT/'data/scan_regions.json'
VERSION='1.0.0'
CLASSES={0:'nodata',10:'tree_cover',20:'shrubland',30:'grassland',40:'cropland',50:'built_up',
         60:'bare_sparse_vegetation',70:'snow_ice',80:'permanent_water',90:'herbaceous_wetland',95:'mangroves',100:'moss_lichen'}
DEM_LICENSE='https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf'
WC_LICENSE='https://creativecommons.org/licenses/by/4.0/'


def dump(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    temp.replace(path)


def sha(path):
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): digest.update(chunk)
    return digest.hexdigest()


def session():
    s=requests.Session()
    s.mount('https://',HTTPAdapter(max_retries=Retry(total=3,backoff_factor=1,status_forcelist=[429,500,502,503,504])))
    return s


def tile_urls(bbox,kind):
    w,s,e,n=bbox
    step=1 if kind=='dem' else 3
    result=[]
    for lat in range(math.floor(s/step)*step,math.ceil(n/step)*step,step):
        for lon in range(math.floor(w/step)*step,math.ceil(e/step)*step,step):
            ns=f'{"N" if lat>=0 else "S"}{abs(lat):02}'
            ew=f'{"E" if lon>=0 else "W"}{abs(lon):03}'
            if kind=='dem':
                tid=f'Copernicus_DSM_COG_10_{ns}_00_{ew}_00_DEM'
                url=f'https://copernicus-dem-30m.s3.amazonaws.com/{tid}/{tid}.tif'
            else:
                tid=f'ESA_WorldCover_10m_2021_v200_{ns}{ew}_Map'
                url=f'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/{tid}.tif'
            result.append({'id':tid,'kind':kind,'url':url})
    return result


def config(path=CONFIG,region_ids=None):
    c=json.loads(path.read_text(encoding='utf-8'))
    defaults=c['defaults']
    for key in ('min_allowed_fraction','max_excluded_fraction','max_nodata_fraction'):
        if not 0<=defaults[key]<=1: raise ValueError('Invalid land-cover fraction: '+key)
    if defaults['max_download_gb']<=0: raise ValueError('Download budget must be positive')
    if defaults['spacing_m']!=30 or defaults['window_samples']!=161:
        raise ValueError('Pack contract requires 161 samples at 30m')
    if defaults['stride_m']<=0 or defaults['stride_m']%30:
        raise ValueError('Stride must be positive and aligned to 30m')
    ids=[r['id'] for r in c['regions']]
    if len(ids)!=len(set(ids)): raise ValueError('Duplicate region ID')
    for r in c['regions']:
        if not r['id'] or any(ch not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for ch in r['id']): raise ValueError('Unsafe region ID')
        w,s,e,n=r['bbox']
        if not (-180<=w<e<=180 and -80<=s<n<=84): raise ValueError('Invalid/non-UTM region bounds')
        if max(dimensions(r['bbox']))>200001: raise ValueError('Region exceeds 200 km; split it')
        if not r['source_url'].startswith('https://') or not r['target_types']: raise ValueError('Region requires evidence and intended target types')
    if region_ids and set(region_ids)-set(ids): raise ValueError('Unknown region ID')
    regions=[r for r in c['regions'] if r['id'] in region_ids] if region_ids else [r for r in c['regions'] if r['enabled']]
    return c,regions


def plan(c,regions,max_gb=None):
    tiles={t['id']:t for r in regions for kind in ('dem','mask') for t in tile_urls(r['bbox'],kind)}
    area=sum(w*h/1e6 for w,h in map(lambda r:dimensions(r['bbox']),regions))
    # Deliberately conservative compressed-tile estimates; HEAD replaces them before retrieval.
    estimate=sum(64_000_000 if t['kind']=='dem' else 256_000_000 for t in tiles.values())
    result={'schema_version':VERSION,'regions':[r['id'] for r in regions], 'region_area_km2':round(area,3),
        'estimated_download_bytes':estimate,'estimate_method':'64 MB per DEM tile, 256 MB per WorldCover tile; verified with Content-Length before GET.',
        'max_download_bytes':int((max_gb if max_gb is not None else c['defaults']['max_download_gb'])*1e9),
        'tiles':sorted(tiles.values(),key=lambda t:t['id'])}
    print(f'PLAN: {len(regions)} regions, {area:,.1f} km2, {len(tiles)} unique tiles, estimated {estimate/1e9:.3f} GB; limit {result["max_download_bytes"]/1e9:g} GB',flush=True)
    if estimate>result['max_download_bytes']: raise ValueError('Estimated size exceeds configured budget; narrow regions or explicitly increase --max-gb')
    return result


def inspect_tile(t,offline=False):
    path=RAW/'tiles'/(t['id']+'.tif')
    receipt=path.with_suffix('.json')
    if path.exists() and receipt.exists():
        r=json.loads(receipt.read_text())
        if sha(path)!=r['sha256'] or r['url']!=t['url']: raise ValueError(f'Cached checksum/URL mismatch: {t["id"]}')
        return dict(t,bytes=path.stat().st_size,status='cached',sha256=r['sha256'])
    if offline: return dict(t,status='unavailable_offline',bytes=0)
    with session() as s:
        response=s.head(t['url'],timeout=60,allow_redirects=True)
        if response.status_code==404: return dict(t,status='not_distributed',bytes=0)
        response.raise_for_status()
        size=int(response.headers.get('Content-Length',0))
        if size<=0: raise ValueError('Cannot enforce budget without a Content-Length: '+t['id'])
        return dict(t,bytes=size,status='available')


def fetch_tile(t):
    if t['status']!='available': return t
    path=RAW/'tiles'/(t['id']+'.tif'); path.parent.mkdir(parents=True,exist_ok=True)
    part=path.with_suffix('.part')
    with session() as s, s.get(t['url'],stream=True,timeout=(30,120)) as response:
        response.raise_for_status()
        count=0
        with part.open('wb') as f:
            for chunk in response.iter_content(1024*1024):
                count+=len(chunk)
                if count>t['bytes']: raise ValueError('Server object exceeds preflight byte budget')
                f.write(chunk)
        if count!=t['bytes']: raise ValueError('Incomplete download: '+t['id'])
    part.replace(path)
    receipt=dict(t,sha256=sha(path),status='downloaded',license_url=DEM_LICENSE if t['kind']=='dem' else WC_LICENSE,
        product_id='COP-DEM-GLO-30' if t['kind']=='dem' else 'ESA WorldCover 10m 2021 v200',
        time_coverage='primarily 2011-2015; per-pixel acquisition unknown' if t['kind']=='dem' else '2021',
        method='Unmodified provider GeoTIFF downloaded over HTTPS; SHA-256 over complete file bytes.')
    dump(path.with_suffix('.json'),receipt)
    print(f'Downloaded {t["id"]}: {count/1e6:.1f} MB',flush=True)
    return receipt


def land_cover(values,defaults):
    counts=np.bincount(np.asarray(values,dtype='uint8').ravel(),minlength=256)
    total=int(counts.sum())
    fractions={str(i):float(n/total) for i,n in enumerate(counts) if n} if total else {}
    allowed=sum(fractions.get(str(k),0) for k in (60,70))
    excluded=sum(fractions.get(str(k),0) for k in (10,40,50,80,90,95))
    unknown=sum(v for k,v in fractions.items() if int(k) not in CLASSES or k=='0')
    keep=(total>0 and allowed>=defaults['min_allowed_fraction'] and excluded<=defaults['max_excluded_fraction'] and unknown<=defaults['max_nodata_fraction'])
    return {'fractions':fractions,'allowed_fraction':allowed,'excluded_fraction':excluded,'nodata_fraction':unknown,'accepted':keep}


def prepare_region(region,tiles):
    w,s,e,n=region['bbox']; lon,lat=(w+e)/2,(s+n)/2
    crs=CRS.from_epsg((32600 if lat>=0 else 32700)+min(60,int((lon+180)//6)+1))
    left,bottom,right,top=transform_bounds('EPSG:4326',crs,w,s,e,n,densify_pts=21)
    left=math.floor(left/30)*30; top=math.ceil(top/30)*30
    folder=RAW/'regions'/region['id']; folder.mkdir(parents=True,exist_ok=True)
    receipt={'region':region,'crs':crs.to_string(),'sources':{}}
    for kind,step,dtype,nodata,method in [('dem',30,'float32',np.nan,Resampling.bilinear),('mask',10,'uint8',0,Resampling.nearest)]:
        rows=math.ceil((top-bottom)/30)*int(30/step); cols=math.ceil((right-left)/30)*int(30/step)
        array=np.full((rows,cols),nodata,dtype=dtype)
        transform=from_origin(left,top,step,step)
        source=[]
        for tile in tile_urls(region['bbox'],kind):
            entry=tiles[tile['id']]
            if entry['status'] not in ('cached','downloaded'): continue
            path=RAW/'tiles'/(tile['id']+'.tif')
            with rasterio.open(path) as src:
                reproject(rasterio.band(src,1),array,src_transform=src.transform,src_crs=src.crs,
                    src_nodata=src.nodata,dst_transform=transform,dst_crs=crs,dst_nodata=nodata,
                    resampling=method,init_dest_nodata=False,num_threads=2)
            source.append({'tile_id':tile['id'],'url':tile['url'],'sha256':entry['sha256']})
        path=folder/(kind+'.tif')
        with rasterio.open(path,'w',driver='GTiff',height=rows,width=cols,count=1,dtype=dtype,
            crs=crs,transform=transform,nodata=nodata,compress='deflate',tiled=True) as dst: dst.write(array,1)
        receipt['sources'][kind]={'tiles':source,'sha256':sha(path),'spacing_m':step,
            'method':'Bilinear elevation reprojection' if kind=='dem' else 'Nearest categorical reprojection to 10m; full-window class fractions',
            'product_id':'COP-DEM-GLO-30' if kind=='dem' else 'ESA WorldCover 10m 2021 v200',
            'native_resolution_m_approx':30 if kind=='dem' else 10,
            'time_coverage':'primarily 2011-2015; per-pixel acquisition unknown' if kind=='dem' else '2021',
            'units':'m above EGM2008' if kind=='dem' else 'WorldCover class codes (dimensionless)',
            'license_url':DEM_LICENSE if kind=='dem' else WC_LICENSE}
    dump(folder/'receipt.json',receipt)
    return folder,receipt


def windows(region,folder,receipt,defaults):
    stride=defaults['stride_m']; size=defaults['window_samples']; step=defaults['spacing_m']
    if step!=30 or stride<=0 or stride%step or size!=161: raise ValueError('Current pack contract requires 161 samples, 30m spacing and a positive 30m-aligned stride')
    rejected=Counter(); accepted=[]; considered=0
    with rasterio.open(folder/'dem.tif') as dem, rasterio.open(folder/'mask.tif') as mask:
        back=Transformer.from_crs(dem.crs,4326,always_xy=True)
        forward=Transformer.from_crs(4326,dem.crs,always_xy=True)
        ax,ay=forward.transform(*region['anchor'])
        for row in range(0,dem.height-size+1,int(stride/step)):
            for col in range(0,dem.width-size+1,int(stride/step)):
                considered+=1
                win=Window(col,row,size,size)
                transform=dem.window_transform(win)
                bbox=transform_bounds(dem.crs,'EPSG:4326',*rasterio.transform.array_bounds(size,size,transform),densify_pts=21)
                rw,rs,re,rn=region['bbox']
                if bbox[0]<rw or bbox[1]<rs or bbox[2]>re or bbox[3]>rn:
                    rejected['outside_region']+=1; continue
                mix=land_cover(mask.read(1,window=Window(col*3,row*3,size*3,size*3)),defaults)
                if not mix['accepted']: rejected['land_cover']+=1; continue
                z=dem.read(1,window=win)
                if z.shape!=(size,size) or not np.isfinite(z).all(): rejected['dem_nodata']+=1; continue
                x,y=transform*(size/2,size/2); lon,lat=back.transform(x,y)
                dx,dy=(x-ax)/1000,(y-ay)/1000
                label=f'{region["name"]}: {abs(dx):.1f} km {"E" if dx>=0 else "W"}, {abs(dy):.1f} km {"N" if dy>=0 else "S"}'
                accepted.append({'id':f'scan-{region["id"]}-r{row}-c{col}','name':label,'region_id':region['id'],
                    'longitude':round(lon,7),'latitude':round(lat,7),'bbox':[round(v,7) for v in bbox],
                    'target_types':region['target_types'],'evidence_status':'exploratory_terrain_only',
                    'land_cover':mix,'terrain_window':{'region_dem':str((folder/'dem.tif').relative_to(ROOT)).replace('\\','/'),
                        'row':row,'column':col,'rows':size,'columns':size,'spacing_m':step,
                        'row_order':'north_to_south','column_order':'west_to_east','crs':dem.crs.to_string(),
                        'affine':list(transform)[:6],'elevation_sha256':hashlib.sha256(z.astype('<f4').tobytes()).hexdigest()},
                    'elevation_summary_m':{'min':round(float(z.min()),3),'mean':round(float(z.mean()),3),'max':round(float(z.max()),3)},
                    'source_receipt':region['id'],'descriptor_status':'awaiting_accuracy_pipeline',
                    'limitations':['Land cover is a 2021 classification, not current traversability or soil mechanics.',
                        'Bare/sparse does not distinguish sand, rock, lava or salt composition. No research-tier pairing inferred.']})
    return accepted,{'considered':considered,'accepted':len(accepted),'rejected':dict(rejected)}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['plan','run'])
    parser.add_argument('--config',type=Path,default=CONFIG)
    parser.add_argument('--region',action='append')
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--max-gb',type=float)
    parser.add_argument('--stride-m',type=int)
    args=parser.parse_args(argv)
    c,regions=config(args.config,args.region)
    if args.stride_m is not None:
        if args.stride_m<=0 or args.stride_m%30: raise ValueError('Stride must be positive and aligned to 30m')
        c['defaults']['stride_m']=args.stride_m
    p=plan(c,regions,args.max_gb)
    dump(ROOT/'data/location-scan-plan.json',p)
    if args.action=='plan': return
    with ThreadPoolExecutor(max_workers=4) as pool:
        inspected=list(pool.map(lambda t:inspect_tile(t,args.offline),p['tiles']))
    actual=sum(t['bytes'] for t in inspected)
    print(f'PREFLIGHT: actual tile bytes {actual/1e9:.3f} GB before downloads; unavailable {sum(t["status"] in ("not_distributed","unavailable_offline") for t in inspected)}',flush=True)
    if actual>p['max_download_bytes']: raise ValueError('Actual provider sizes exceed budget; no downloads started')
    if args.offline and any(t['status']=='unavailable_offline' for t in inspected): raise FileNotFoundError('Offline scan requires every requested tile cached; run online retrieval first')
    with ThreadPoolExecutor(max_workers=4) as pool: fetched=list(pool.map(fetch_tile,inspected))
    tiles={t['id']:t for t in fetched}
    p.update(actual_source_bytes=actual,tiles=fetched)
    dump(ROOT/'data/location-scan-plan.json',p)
    INDEX.mkdir(parents=True,exist_ok=True)
    all_rows=[]; receipts={}; stats={}
    for region in regions:
        print('Scanning '+region['id'],flush=True)
        folder,receipt=prepare_region(region,tiles)
        rows,stat=windows(region,folder,receipt,c['defaults'])
        all_rows.extend(rows); receipts[region['id']]=receipt; stats[region['id']]=stat
        print(f'  {stat}',flush=True)
    # Deterministic output; do not mix an earlier batch into the requested run.
    output=INDEX/'windows.jsonl'; temp=output.with_suffix('.tmp')
    with temp.open('w',encoding='utf-8',newline='\n') as f:
        for row in sorted(all_rows,key=lambda x:x['id']): f.write(json.dumps(row,separators=(',',':'),allow_nan=False)+'\n')
    temp.replace(output)
    dump(INDEX/'sources.json',{'schema_version':VERSION,'region_receipts':receipts,
        'provenance_scope':'Each source_receipt applies to all terrain and land-cover numbers for its windows. Elevation summaries are derived from the referenced regional DSM.',
        'worldcover_classes':CLASSES,'worldcover_doi':'https://doi.org/10.5281/zenodo.7254221',
        'worldcover_attribution':'ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
        'copernicus_attribution':'Copernicus WorldDEM-30, DLR e.V. 2010-2014 and Airbus Defence and Space GmbH 2014-2018; European Union and ESA.'})
    dump(INDEX/'manifest.json',{'schema_version':VERSION,'config_sha256':sha(args.config),'scan_defaults':c['defaults'],
        'window_count':len(all_rows),'regions':stats,'index_bytes':output.stat().st_size,'index_sha256':sha(output),
        'sources_sha256':sha(INDEX/'sources.json'),
        'source_bytes':actual,'descriptor_status':'awaiting_accuracy_pipeline','scores_present':False,
        'reason':'Location discovery handoff only; calibrated features and ranking are owned by the accuracy pipeline.'})
    print(f'INDEX: {len(all_rows)} windows; {output.stat().st_size/1e6:.2f} MB; no scores assigned',flush=True)


if __name__=='__main__': main()
