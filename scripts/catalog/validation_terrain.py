"""Acquire reserved reference DEMs without registering them in the player catalog."""
import argparse
import json
import shutil

from .build import ROOT, PUBLIC, CACHE, terrain, dump, sha


def acquire(offline=False):
    config=json.loads((ROOT/'data/validation-sites.json').read_text())
    destination=PUBLIC/'validation-terrain'
    rows=[]
    for site in config['sites']:
        z,_,_,url,native,_=terrain(site,offline,destination)
        folder=destination/'terrain'/site['id']
        # Keep the exact reprojectable source, not only a claimed source hash.
        shutil.copy2(CACHE/f'{site["id"]}-source.tif',folder/'source-window.tif')
        shutil.copy2(CACHE/f'{site["id"]}-source.json',folder/'source-receipt.json')
        m=json.loads((folder/'manifest.json').read_text())
        m['source'].update(subset_file='source-window.tif',receipt_file='source-receipt.json')
        dump(folder/'manifest.json',m)
        dump(folder/'checksums.json',{p.name:sha(p) for p in folder.iterdir() if p.name!='checksums.json'})
        rows.append({**site,'terrain':{'manifest_url':f'/terrain/{site["id"]}/manifest.json',
            'rows':z.shape[0],'columns':z.shape[1],'spacing_m':m['grid']['spacing_m'],
            'manifest_sha256':sha(folder/'manifest.json'),'elevation_sha256':sha(folder/'elevation.f32'),
            'source_url':url,'native_resolution_m_approx':native}})
    dump(destination/'sites.json',{'sites':rows,'request_config_sha256':sha(ROOT/'data/validation-sites.json'),
        'purpose':'Reserved evaluation only; never a fitting or player-catalog input.'})
    print('Reserved measured packs:',[s['id'] for s in rows])


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--offline',action='store_true');args=p.parse_args()
    acquire(args.offline)
