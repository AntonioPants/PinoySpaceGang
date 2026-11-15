"""Retrieve missing Earth POWER/lunar Diviner context; stage first, publish explicitly.

No terrain rebuild, ranking fit, fabricated Mars weather, or literature-tier promotion.
Run without flags to retrieve; --offline reuses receipts; --publish installs the reviewed stage.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import shutil
from .build import PUBLIC, ROOT, CACHE, environment, dump, sha
from .metadata import make_catalog
from .publication import publication
from .validate import validate

STAGE=ROOT/'data/staged/environment-refresh.json'

def retrieve(offline=False):
    original=sha(PUBLIC/'sites.json')
    catalog=json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    sites=[s for s in catalog['sites'] if
           (s['body']=='earth' and s['conditions']['wind_speed_10m']['value'] is None) or
           (s['body']=='moon' and s['conditions'].get('bolometric_temperature_min',{}).get('value') is None)]
    results=[]; failures=[]
    def fetch(site):
        conditions=environment(site,offline)
        if not any(v['value'] is not None for v in conditions.values()):
            raise ValueError('No valid cached/downloaded environmental observations')
        return {'id':site['id'],'conditions':conditions}
    # Download shared lunar labels serially to avoid racing cache writes.
    for group in ([s for s in sites if s['body']=='moon'],[s for s in sites if s['body']=='earth']):
        with ThreadPoolExecutor(max_workers=1 if group and group[0]['body']=='moon' else 3) as pool:
            work={pool.submit(fetch,s):s for s in group}
            for future in as_completed(work):
                site=work[future]
                try:
                    results.append(future.result()); print('Retrieved',site['id'],flush=True)
                except Exception as exc:
                    failures.append({'id':site['id'],'reason':str(exc),'required_action':'Retry source retrieval; cached successful products are retained. No values were substituted.'})
                    print('Unavailable',site['id'],str(exc)[:160],flush=True)
    report={'schema_version':'1.0.0','base_catalog_sha256':original,'updated':sorted(results,key=lambda r:r['id']),
            'failures':sorted(failures,key=lambda r:r['id']),'published':False}
    dump(STAGE,report)
    print(f'{len(results)} staged; {len(failures)} source failures; production unchanged')

def publish():
    report=json.loads(STAGE.read_text(encoding='utf-8'))
    if sha(PUBLIC/'sites.json')!=report['base_catalog_sha256']:
        raise ValueError('Catalog changed during retrieval; rerun --offline before publishing')
    updates={r['id']:r['conditions'] for r in report['updated']}
    with publication(PUBLIC) as public:
        catalog=json.loads((public/'sites.json').read_text(encoding='utf-8'))
        for site in catalog['sites']:
            if site['id'] not in updates: continue
            site['conditions'].update(updates[site['id']])
            t=site['conditions']['air_temperature_2m']['value']
            site['classification']['annual_air_temperature']=None if t is None else 'freezing_mean' if t<0 else 'cool_mean' if t<15 else 'warm_mean'
            site['completeness'].update(known_conditions=sum(p['value'] is not None for p in site['conditions'].values()),total_conditions=len(site['conditions']))
            pack=public/site['terrain']['manifest_url'].lstrip('/'); pack=pack.parent
            source=CACHE/(site['id']+('-power-v2.json' if site['body']=='earth' else '-diviner.tab'))
            shutil.copyfile(source,pack/('power-daily-2024.json' if site['body']=='earth' else 'diviner-cell.tab'))
            dump(pack/'checksums.json',{p.name:sha(p) for p in pack.iterdir() if p.is_file() and p.name!='checksums.json'})
        dump(public/'sites.json',make_catalog(catalog['sites'],public))
        validate(public)
        if sha(PUBLIC/'sites.json')!=report['base_catalog_sha256']:
            raise ValueError('Concurrent catalog update; refusing overwrite')
    report['published']=True;report['published_catalog_sha256']=sha(PUBLIC/'sites.json')
    dump(ROOT/'data/environment-refresh-report.json',{k:v for k,v in report.items() if k!='updated'}|{'updated_sites':sorted(updates)})

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--offline',action='store_true');parser.add_argument('--publish',action='store_true')
    args=parser.parse_args()
    publish() if args.publish else retrieve(args.offline)

if __name__=='__main__':main()
