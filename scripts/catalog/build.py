"""Run: python -m scripts.catalog.build [--offline] [--site ID]."""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
import rasterio
import requests
from pyproj import CRS, Transformer
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import from_bounds, Window
from scipy.ndimage import uniform_filter

from .selection import records
from .metadata import make_catalog, preserve_handoff
from .publication import publication
from .diviner import thermal_bins

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'web/public'
CACHE = ROOT / 'data/cache/catalog'
# Public USGS S3 distribution of the same MOLA mosaic; older host may return HTTP 403.
MARS = 'https://asc-mars.s3.us-west-2.amazonaws.com/basemaps/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif'
MOON = 'https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif'

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8', newline='\n')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def property_record(value, unit, status='unknown', source=None, resolution=None, method=None, reason=None, coverage=None):
    return dict(value=value, unit=unit, status=status, source=source,
                native_resolution_m=resolution, analysis_resolution_m=None,
                time_coverage=coverage, method=method,
                caveat='Not a site-specific accuracy estimate.', reason=reason)

def terrain(site, offline, public=PUBLIC):
    sid, body = site['id'],site['body']
    lon, lat = site['longitude'],site['latitude']
    if sid == 'kilbourne-hole-v1':
        path = public / 'terrain' / sid
        m = json.loads((path/'manifest.json').read_text(encoding='utf-8'))
        with rasterio.open(path/'elevation-utm.tif') as src:
            z, crs, affine = src.read(1),src.crs,src.transform
        return z, crs, affine, m['source']['url'], 30.0, m
    radius = 3396190 if body == 'mars' else 1737400
    if body == 'earth':
        lat_tile,lon_tile=math.floor(lat),math.floor(lon)
        tile=f'Copernicus_DSM_COG_10_{"N" if lat_tile>=0 else "S"}{abs(lat_tile):02d}_00_{"E" if lon_tile>=0 else "W"}{abs(lon_tile):03d}_00_DEM'
        url=f'https://copernicus-dem-30m.s3.amazonaws.com/{tile}/{tile}.tif'
        crs=CRS.from_epsg(32600 + int((lon+180)//6)+1)
        geo=CRS.from_epsg(4326)
        step,native=30.0,30.0
    else:
        url=MARS if body=='mars' else MOON
        geo=CRS.from_proj4(f'+proj=longlat +R={radius}')
        crs=CRS.from_proj4(f'+proj=aeqd +lat_0={lat} +lon_0={lon} +R={radius} +units=m')
        step,native=(500.0,463.1) if body=='mars' else (150.0,118.5)
    n=33 if body!='earth' else 161
    east,north=Transformer.from_crs(geo,crs,always_xy=True).transform(lon,lat)
    half=(n-1)*step/2
    affine=from_origin(east-half-step/2,north+half+step/2,step,step)
    path=public/'terrain'/sid
    previous = json.loads((path/'manifest.json').read_text(encoding='utf-8')) if (path/'manifest.json').exists() else {}
    cached=CACHE/f'{sid}{"-west" if sid=="meteor-crater" else ""}-source.tif'
    receipt_path = CACHE/f'{sid}-source.json'
    retained = previous.get('source', {})
    if not cached.exists() and retained.get('subset_file') and retained.get('receipt_file'):
        cached = path/retained['subset_file']
        receipt_path = path/retained['receipt_file']
    if not cached.exists():
        if offline: raise FileNotFoundError(f'Offline source missing: {cached}')
        with rasterio.Env(GDAL_HTTP_TIMEOUT='60', GDAL_HTTP_MAX_RETRY='2', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
            with rasterio.open(url) as src:
                bounds=transform_bounds(crs,src.crs,east-half-step,north-half-step,east+half+step,north+half+step,densify_pts=101)
                win=from_bounds(*bounds,src.transform)
                x0,y0=math.floor(win.col_off)-2,math.floor(win.row_off)-2
                x1,y1=math.ceil(win.col_off+win.width)+2,math.ceil(win.row_off+win.height)+2
                win=Window(x0,y0,x1-x0,y1-y0).intersection(Window(0,0,src.width,src.height))
                if win.width*win.height>8_000_000: raise ValueError('Source window exceeds download budget')
                raw=src.read(1,window=win,masked=True).astype('float32').filled(np.nan)
                raw=raw*src.scales[0]+src.offsets[0]
                cached.parent.mkdir(parents=True,exist_ok=True)
                with rasterio.open(cached,'w',driver='GTiff',height=raw.shape[0],width=raw.shape[1],count=1,dtype='float32',nodata=np.nan,crs=src.crs,transform=src.window_transform(win),compress='deflate') as dst:
                    dst.write(raw,1)
                dump(CACHE/f'{sid}-source.json',{'url':url,'sha256':sha(cached),'scale_applied':src.scales[0],'offset_applied':src.offsets[0],'window':list(win.flatten()),'source_crs':src.crs.to_wkt()})
    z=np.full((n,n),np.nan,dtype='float32')
    receipt=json.loads(receipt_path.read_text(encoding='utf-8'))
    if sha(cached)!=receipt['sha256']:
        raise ValueError('Cached source checksum mismatch; reacquire explicitly')
    with rasterio.open(cached) as src:
        reproject(rasterio.band(src,1),z,src_transform=src.transform,src_crs=src.crs,dst_transform=affine,dst_crs=crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
    if not np.isfinite(z).all(): raise ValueError('Footprint has nodata; no silent filling')
    path.mkdir(parents=True,exist_ok=True)
    with rasterio.open(path/'elevation.tif','w',driver='GTiff',height=n,width=n,count=1,dtype='float32',crs=crs,transform=affine,nodata=np.nan,compress='deflate') as dst: dst.write(z,1)
    z.astype('<f4').tofile(path/'elevation.f32')
    m={'schema_version':1,'id':sid,'name':site['name'],'body':body,
       'grid':{'rows':n,'columns':n,'spacing_m':step,'dtype':'float32','byte_order':'little-endian','sample_file':'elevation.f32','order':'north-first, west-first', 'crs_wkt':crs.to_wkt(),'affine':list(affine)[:6]},
       'local_frame':{'vertical_offset_m':float(np.floor(z.min()))},
       'source':{'url':url,'native_spacing_m_approx':native,'subset_sha256':sha(cached),'vertical_datum':'EGM2008' if body=='earth' else ('MOLA areoid' if body=='mars' else '1737400 m reference sphere'),'coverage':'Copernicus primarily 2011–2015' if body=='earth' else ('MGS mission gridded archive' if body=='mars' else 'LOLA July 2009–July 2013')},
       'limitations':['Regional surface only; no caves, wheel-scale hazards, or landing safety certification.','Native sampling varies with latitude; output spacing is not source resolving power.']}
    m['attribution']='produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved' if body=='earth' else 'NASA MGS MOLA / LRO LOLA Science Teams; USGS Astrogeology mosaic distribution'
    m['license_url']='/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf' if body=='earth' else 'https://astrogeology.usgs.gov/search/map/'+('mars_mgs_mola_dem_463m' if body=='mars' else 'moon_lro_lola_dem_118m')
    if retained.get('subset_file') or sid in ('haughton', 'qaidam', 'lucus-planum'):
        if cached.resolve() != (path/'source-window.tif').resolve():
            shutil.copy2(cached, path/'source-window.tif')
        dump(path/'source-receipt.json', receipt)
        m['source'].update(subset_file='source-window.tif', receipt_file='source-receipt.json')
    dump(path/'manifest.json',m)
    dump(path/'checksums.json',{p.name:sha(p) for p in path.iterdir() if p.name!='checksums.json'})
    return z,crs,affine,url,native,m

def descriptors(z, affine, source, native):
    # Common 1 km analysis cells, same 3 km roughness support for every site.
    step=abs(affine.a)
    # Reproject to exactly 1000m to avoid silently mismatching 990m and 1000m grids.
    n=min(4,int(min(z.shape)*step//1000))
    if n<3: return {}
    out=np.full((n,n),np.nan,dtype='float32')
    dummy='EPSG:3857'
    offset=(min(z.shape)*step-n*1000)/2
    reproject(z,out,src_transform=from_origin(0,0,step,step),src_crs=dummy,dst_transform=from_origin(offset,-offset,1000,1000),dst_crs=dummy,resampling=Resampling.average)
    dy,dx=np.gradient(out.astype('float64'),1000)
    slope=np.degrees(np.arctan(np.hypot(dx,dy)))
    rough=np.sqrt(np.maximum(0,uniform_filter(out.astype('float64')**2,3)-uniform_filter(out.astype('float64'),3)**2))[1:-1,1:-1]
    values={'slope_mean':(float(slope.mean()),'deg'),'roughness_rms':(float(rough.mean()),'m'),'relief':(float(np.ptp(out)),'m')}
    result={}
    for k,(v,u) in values.items():
        p=property_record(v,u,'derived',source,native,'Area-average to 1000m; gradient slope; 3x3 local RMS height; relief max-min.')
        p['analysis_resolution_m']=1000
        p['caveat']='Small footprint and coarse source limit representativeness; RMS includes regional slope.'
        result[k]=p
    return result

def environment(site, offline):
    result={}
    for key,unit in [('wind_speed_10m','m/s'),('air_temperature_2m','degC'),('surface_temperature','K'),('albedo','1'),('friction','1'),('cohesion','Pa'),('bulk_density','kg/m3')]:
        na=site['body']=='moon' and key in ('wind_speed_10m','air_temperature_2m')
        result[key]=property_record(None,unit,'not_applicable' if na else 'unknown',reason='No atmosphere supports this meteorological quantity.' if na else 'No validated site-specific product ingested; substrate does not determine this value.')
    if site['body']=='moon':
        result.update(thermal_bins(site,CACHE,offline))
        return result
    if site['body']!='earth': return result
    cache=CACHE/f"{site['id']}-power-v2.json"
    url='https://power.larc.nasa.gov/api/temporal/daily/point'
    if not cache.exists():
        if offline: return result
        response=requests.get(url,params=dict(parameters='T2M,WS10M,TS,ALLSKY_SRF_ALB',community='RE',longitude=site['longitude'],latitude=site['latitude'],start='20240101',end='20241231',format='JSON'),timeout=90)
        response.raise_for_status(); dump(cache,response.json())
    data=json.loads(cache.read_text(encoding='utf-8'))
    for parameter,key,unit in [('T2M','air_temperature_2m','degC'),('WS10M','wind_speed_10m','m/s'),('TS','surface_temperature','degC'),('ALLSKY_SRF_ALB','albedo','1')]:
        vals=[v for v in data['properties']['parameter'][parameter].values() if v!=data['header']['fill_value'] and np.isfinite(v)]
        if not vals: continue
        p=property_record(float(np.mean(vals)),unit,'modeled',{'product_id':'NASA POWER/MERRA-2 '+parameter,'url':url,'response_sha256':sha(cache)},None,'Mean of available daily values',coverage='2024-01-01/2024-12-31')
        p['caveat']='MERRA-2 0.5 degree latitude x 0.625 degree longitude grid; regional reanalysis, not a local sensor. Wind speed is not an east/north wind vector.'
        p['sample_count']=len(vals)
        p['min_daily']=float(min(vals)); p['max_daily']=float(max(vals))
        p['source']['product_id']='NASA POWER/'+parameter
        if parameter=='ALLSKY_SRF_ALB':
            p['caveat']='CERES SYN1deg all-sky broadband surface albedo; 1 degree grid, not spectral reflectance or local regolith albedo. Missing polar-night values excluded.'
        p['source']['parameter_metadata']=data['parameters'][parameter]
        result[key]=p
    return result

def build_records(args, public):
    previous_catalog = json.loads((public/'sites.json').read_text(encoding='utf-8')) if (public/'sites.json').exists() else {'sites': []}
    previous = {s['id']: s for s in previous_catalog['sites']}
    out=[]; failures=[]
    for s in records():
        if args.site and s['id']!=args.site: continue
        print('Processing',s['id'],flush=True)
        entry=dict(s,role='earth_analog' if s['body']=='earth' else 'planetary_target',study_status='research_area_not_landing_approval',terrain=None,conditions={},comparison_features={},simulation_defaults={})
        entry['classification']={'morphology':s['morphology'],'substrate':s['substrate'],'status':'interpreted','source_url':s['evidence_url']}
        entry['classification']['atmosphere']='terrestrial' if s['body']=='earth' else 'thin_co2' if s['body']=='mars' else 'airless'
        entry['identifiers']={'kilbourne-hole-v1':['volcanic_maar','rim','basin_floor'],'meteor-crater':['impact_crater','ejecta','bowl'],'amboy':['cinder_cone','lava_flow'],'badwater':['playa','evaporite','closed_basin'],'white-sands':['aeolian_dunes','gypsum'],'barrow-observatory':['permafrost','ice_wedge_polygons']}.get(s['id'],[s['morphology']])
        try:
            z,crs,affine,url,native,m=terrain(s,args.offline,public)
            geo=CRS.from_epsg(4326) if s['body']=='earth' else CRS.from_proj4('+proj=longlat +R='+str(3396190 if s['body']=='mars' else 1737400))
            bbox=transform_bounds(crs,geo,*rasterio.transform.array_bounds(*z.shape,affine),densify_pts=101)
            entry['bbox']=list(bbox)
            entry['footprint_method']='Raster outer bounds of square local metric study area centred on selected coordinates; includes surrounding context.'
            manifest_path=public/'terrain'/s['id']/'manifest.json'
            entry['terrain']={'manifest_url':f"/terrain/{s['id']}/manifest.json",'manifest_sha256':sha(manifest_path),'elevation_sha256':sha(manifest_path.parent/'elevation.f32'),'rows':z.shape[0],'columns':z.shape[1],'row_order':'north_to_south','column_order':'west_to_east','spacing_m':abs(affine.a),'source_url':url,'native_resolution_m_approx':native}
            source={'product_id':'COP-DEM-GLO-30' if s['body']=='earth' else ('MGS-MOLA-MEGDR-USGS' if s['body']=='mars' else 'LRO-LOLA-LDEM-USGS'),'url':url}
            dy,dx=np.gradient(z.astype('float64'),abs(affine.a)); sl=np.degrees(np.arctan(np.hypot(dx,dy)))
            for key,value,unit in [('elevation_min',z.min(),'m'),('elevation_max',z.max(),'m'),('elevation_mean',z.mean(),'m'),('slope_mean',sl.mean(),'deg'),('slope_p50',np.percentile(sl,50),'deg'),('slope_p95',np.percentile(sl,95),'deg'),('slope_max',sl.max(),'deg')]:
                p=property_record(float(value),unit,'derived',source,native,'Finite differences on local metre grid; summary over full footprint.')
                p['analysis_resolution_m']=abs(affine.a); entry['conditions'][key]=p
                p['time_coverage']=m['source'].get('coverage',m['source'].get('acquisition_period'))
            v=entry['conditions']['slope_p95']['value']; entry['classification']['slope_p95_class']='level' if v<5 else 'gentle' if v<15 else 'steep' if v<30 else 'very_steep'
            entry['comparison_features']=descriptors(z,affine,source,native)
        except Exception as exc:
            entry['terrain']=None
            entry['bbox']=None; failures.append({'site':s['id'],'stage':'terrain','error':str(exc)})
        try: entry['conditions'].update(environment(s,args.offline))
        except Exception as exc:
            failures.append({'site':s['id'],'stage':'environment','error':str(exc)})
            entry['conditions'].update(environment(s,True))
        entry['limitations']=['Morphology and substrate are area interpretations, not pixel classifications or soil mechanics.','No validated resource inventory; water/ice/cave hypotheses are not confirmed local resources.']
        entry['feature_measurements']={key:{'value':None,'status':'unknown','reason':'Requires feature delineation or dedicated field/high-resolution time-series data; regional DSM statistics are not a substitute.'} for key in {'kilbourne-hole-v1':['crater_diameter','depth_diameter_ratio','rim_relief'],'meteor-crater':['crater_diameter','depth_diameter_ratio','rim_continuity'],'amboy':['cone_height','flow_morphology'],'badwater':['wet_dry_state','salt_mineral_fractions'],'white-sands':['dune_height','crest_spacing','crest_orientation','migration'],'barrow-observatory':['polygon_size','active_layer_depth','ground_temperature']}.get(s['id'],[])}
        if entry['comparison_features'].get('roughness_rms'):
            r=entry['comparison_features']['roughness_rms']['value']
            entry['classification']['roughness_3km']='low' if r<10 else 'moderate' if r<50 else 'high'
        temp=entry['conditions'].get('air_temperature_2m',{}).get('value')
        entry['classification']['annual_air_temperature']=None if temp is None else 'freezing_mean' if temp<0 else 'cool_mean' if temp<15 else 'warm_mean'
        entry['resources']={'status':'unknown','value':None,'reason':'No footprint-specific resource abundance product ingested.'}
        if s['id']=='meteor-crater':
            for key,value,unit in [('crater_diameter',1200,'m'),('crater_depth',180,'m'),('depth_diameter_ratio',0.15,'1')]:
                p=property_record(value,unit,'derived' if key=='depth_diameter_ratio' else 'measured',{'product_id':'USGS Meteor Crater Sample Collection site summary','url':s['evidence_url']},method='180m / 1200m from published approximate dimensions' if key=='depth_diameter_ratio' else 'Published USGS approximate crater dimension, not measured from this crop')
                p['caveat']='Approximate literature dimensions; measurement date, uncertainty and exact rim definition not supplied.'
                entry['feature_measurements'][key]=p
        entry['resource_indicators']=[]
        if s['id'] in ('phoenix','shackleton-rim','barrow-observatory'):
            entry['resource_indicators']=[{'resource':'water_ice','evidence_status':'confirmed_regionally' if s['id']!='shackleton-rim' else 'hypothesis','source_url':s['evidence_url'],'scope':'Regional evidence only; footprint abundance and accessibility unknown.'}]
        entry['completeness']={'terrain_available':entry['terrain'] is not None,'known_conditions':sum(p['value'] is not None for p in entry['conditions'].values()),'total_conditions':len(entry['conditions'])}
        preserve_handoff(entry, previous.get(s['id']))
        out.append(entry)
    if failures:
        raise RuntimeError('Build failed; production preserved: ' + json.dumps(failures))
    if not out:
        raise ValueError('Unknown site ID')
    if args.site:
        previous.update({s['id']: s for s in out})
        out = list(previous.values())
    catalog = make_catalog(out, public)
    dump(public/'sites.json', catalog)
    return catalog


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--site', choices=[s['id'] for s in records()])
    args = parser.parse_args(argv)
    # Partial builds are reviewable snapshots; registration is the publication step.
    destination = CACHE/'pending'/args.site if args.site else PUBLIC
    from .validate import validate
    try:
        with publication(destination, seed=PUBLIC) as stage:
            catalog = build_records(args, stage)
            validate(stage)
    except Exception as exc:
        dump(ROOT/'data/catalog-run-report.json', {'operation': 'build', 'failures': [str(exc)], 'published': False})
        raise
    dump(ROOT/'data/catalog-run-report.json', {'operation': 'stage-site' if args.site else 'build',
        'failures': [], 'published': not bool(args.site), 'sites': len(catalog['sites'])})
    print('Staged site for registration' if args.site else 'Published validated catalog', flush=True)


if __name__ == '__main__': main()
