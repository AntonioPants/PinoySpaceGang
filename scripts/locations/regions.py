"""Create the initial editable region configuration from the existing 50 sites.

Run once to seed data/scan_regions.json. Later additions only edit that JSON.
Nearby seed buffers merge only when both region dimensions remain <=200 km.
"""
import json
from pathlib import Path
from pyproj import Geod

ROOT=Path(__file__).resolve().parents[2]
GEOD=Geod(ellps='WGS84')
TARGET_TYPES={'arsia-flank':'shield_flank','marius-hills':'volcanic_plain',
              'shackleton-rim':'crater_rim','bagnold':'dune_field',
              'jezero':'layered_deltaic','lucus-planum':'layered_deltaic','phoenix':'polar_ice'}


def dimensions(bbox):
    w,s,e,n=bbox
    # Both north and south edges are checked, important at high latitudes.
    width=max(GEOD.inv(w,lat,e,lat)[2] for lat in (s,(s+n)/2,n))
    height=GEOD.inv((w+e)/2,s,(w+e)/2,n)[2]
    return width,height


def initial_regions(sites,active_count=30):
    regions=[]
    for site in sorted(sites,key=lambda s:s['id']):
        lon,lat=site['longitude'],site['latitude']
        w=GEOD.fwd(lon,lat,270,20000)[0]; e=GEOD.fwd(lon,lat,90,20000)[0]
        s=GEOD.fwd(lon,lat,180,20000)[1]; n=GEOD.fwd(lon,lat,0,20000)[1]
        regions.append({'id':site['id']+'-region','name':site['name']+' region',
            'bbox':[round(v,6) for v in (w,s,e,n)],'seed_site_ids':[site['id']],
            'country':site['region'].rsplit(', ',1)[-1],
            'anchor':[lon,lat], 'target_types':sorted({TARGET_TYPES[t] for t in site['matches'] if t in TARGET_TYPES}),
            'reason':'20 km cardinal buffer around a sourced catalog study area; candidate discovery only, not geological equivalence.',
            'source_url':site['evidence_url'],'sources':[site['evidence_url']]})
    # Merge overlapping or close buffers, limiting wasted area as well as dimensions.
    while True:
        options=[]
        for i,a in enumerate(regions):
            for j in range(i+1,len(regions)):
                b=regions[j]
                if a['country']!=b['country']: continue
                box=[min(a['bbox'][0],b['bbox'][0]),min(a['bbox'][1],b['bbox'][1]),
                     max(a['bbox'][2],b['bbox'][2]),max(a['bbox'][3],b['bbox'][3])]
                width,height=dimensions(box)
                old=sum(x*y for x,y in [dimensions(a['bbox']),dimensions(b['bbox'])])
                if max(width,height)<=200000 and width*height<=1.6*old:
                    options.append((width*height/old,i,j,box))
        if not options: break
        _,i,j,box=min(options)
        a,b=regions[i],regions.pop(j)
        a['bbox']=box
        a['name']+=' / '+b['name']
        a['seed_site_ids']+=b['seed_site_ids']
        a['sources']=sorted(set(a['sources']+b['sources']))
        a['target_types']=sorted(set(a['target_types']+b['target_types']))
    # Start with geographical diversity, then remaining IDs. Keep all 50 seeds documented.
    countries=set(); enabled=[]
    for r in regions:
        if r['country'] not in countries:
            countries.add(r['country']); enabled.append(r['id'])
    enabled+=(r['id'] for r in regions if r['id'] not in enabled)
    active=set(enabled[:active_count])
    for r in regions:
        r['enabled']=r['id'] in active
        r['deferred_reason']=None if r['enabled'] else 'Outside the initial 30-region download batch; set enabled=true to include later.'
    return {'schema_version':'1.0.0','defaults':{'stride_m':2400,'window_samples':161,'spacing_m':30,
        'max_download_gb':20,'min_allowed_fraction':0.80,'max_excluded_fraction':0.05,'max_nodata_fraction':0.01},
        'scope':'Targeted regional search only. All existing seed sites are represented; active batch starts with 30 regions.',
        'regions':regions}


if __name__=='__main__':
    c=json.loads((ROOT/'web/public/sites.json').read_text(encoding='utf-8'))
    result=initial_regions([s for s in c['sites'] if s['body']=='earth'])
    (ROOT/'data/scan_regions.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(f'{len(result["regions"])} regions; {sum(r["enabled"] for r in result["regions"])} enabled; all 50 seeds included')
