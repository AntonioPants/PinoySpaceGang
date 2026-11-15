"""Range-read a verified 0.5-degree Diviner GCP cell (96 local-time bins)."""
import hashlib
import math
import re
import numpy as np
import requests

BASE='https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/'

def band_for(latitude):
    if not math.isfinite(latitude) or not -90 <= latitude <= 90:
        raise ValueError('Invalid lunar latitude')
    lat0 = min(80, math.floor(latitude/10)*10)
    return (f'{lat0:02d}n{lat0+10:02d}n' if lat0 >= 0 else
            f'{abs(lat0):02d}s{abs(lat0+10):02d}s'), lat0

def thermal_bins(site, cache, offline=False, retained=None):
    band, lat0 = band_for(site['latitude'])
    stem=f'global_cumul_avg_cyl_{band}_002'
    x=math.floor(((site['longitude']+180)%360)/0.5)
    y=min(19,math.floor((site['latitude']-lat0)/0.5))
    record=1+(x*20+y)*96
    start,end=record*113,(record+96)*113-1
    path=cache/f"{site['id']}-diviner.tab"
    if not path.exists() and retained is not None and retained.exists():
        path = retained
    if not path.exists():
        if offline: return {}
        # Verify the product layout before computing byte offsets for a new cell.
        label=cache/(stem+'.lbl')
        if not label.exists():
            response=requests.get(BASE+stem+'.lbl',timeout=60)
            response.raise_for_status(); label.write_bytes(response.content)
        text=label.read_text(encoding='ascii')
        for key,expected in [('RECORD_BYTES',113),('COLUMNS',11),('MINIMUM_LATITUDE',lat0),('MAXIMUM_LATITUDE',lat0+10)]:
            found=re.search(r'\b'+key+r'\s*=\s*(-?[\d.]+)',text)
            if not found or float(found.group(1))!=expected:
                raise ValueError('Unexpected Diviner product label: '+key)
        with requests.get(BASE+stem+'.tab',headers={'Range':f'bytes={start}-{end}'},stream=True,timeout=60) as r:
            if r.status_code!=206 or not r.headers.get('Content-Range','').startswith(f'bytes {start}-{end}/'):
                raise ValueError('Diviner server did not honor bounded range request')
            raw=r.raw.read(end-start+2)
        if len(raw)!=end-start+1: raise ValueError('Diviner byte count mismatch')
        path.write_bytes(raw)
    raw=path.read_bytes()
    rows=np.array([[float(v) for v in line.split(',')] for line in raw.decode('ascii').splitlines() if line.strip()])
    if rows.shape!=(96,11): raise ValueError('Diviner table shape mismatch')
    if not np.allclose(rows[:,0],-180+(x+0.5)*0.5) or not np.allclose(rows[:,1],lat0+(y+0.5)*0.5):
        raise ValueError('Diviner coordinates do not match requested bin')
    values=rows[:,10]; values=values[values>0]
    if not values.size: return {}
    result={}
    for stat,value in [('min',values.min()),('max',values.max())]:
        result['bolometric_temperature_'+stat]={
            'value':float(value),'unit':'K','status':'derived',
            'source':{'product_id':'LRO-L-DLRE-5-GCP-V1.0/'+stem,'url':BASE+stem+'.tab','label_url':BASE+stem+'.lbl','sha256':hashlib.sha256(raw).hexdigest(),'byte_range':[start,end]},
            'native_resolution_m':None,'analysis_resolution_m':None,
            'time_coverage':'2009-07-05/2015-04-01',
            'method':f'{stat} of positive bolometric brightness temperature in available 0.25-hour local-time bins of one 0.5-degree geographic cell.',
            'caveat':'Regional cumulative bin, not footprint extrema or current surface temperature; missing/negative sensor values excluded. Polar longitude bins have strongly anisotropic support.',
            'reason':None,'sample_count':int(values.size),'bin_center':[float(rows[0,0]),float(rows[0,1])],
        }
    return result
