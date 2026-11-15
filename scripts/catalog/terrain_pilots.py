"""Screen selected high-resolution product footprints; never silently promote them.

python -m scripts.catalog.terrain_pilots [--check]
The 4.5 km square includes all existing 4 km comparison-window shifts. Bounding
boxes are only a necessary coverage test; valid-pixel coverage needs raster QA.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT/'web/public/terrain-upgrade-status.json'


def screen(site, product):
    radius=1737400 if site['body']=='moon' else 3396190
    lat,lon=site['latitude'],site['longitude']
    dy=math.degrees(2250/radius)
    dx=math.degrees(2250/(radius*math.cos(math.radians(lat))))
    required=[lon-dx,lat-dy,lon+dx,lat+dy]
    box=product['bbox']
    covers=box[0]<=required[0] and box[1]<=required[1] and box[2]>=required[2] and box[3]>=required[3]
    reasons=[]
    if product.get('raster_coverage_failure'): reasons.append(product['raster_coverage_failure'])
    if not covers: reasons.append('Product bounding box does not cover the selected comparison footprint.')
    if not product.get('full_valid_pixel_coverage_verified'): reasons.append('Full valid-pixel coverage is unverified.')
    if not product.get('quality_reviewed'): reasons.append('Stereo quality and artifacts require review.')
    if not product.get('datum_scale_offset_reviewed'): reasons.append('Vertical datum and elevation scale/offset require review.')
    error=product.get('relative_vertical_error_m')
    if not isinstance(error,(int,float)) or not math.isfinite(error) or error<0: reasons.append('Product-specific vertical error is missing.')
    return {**product,'bbox_covers_comparison_window':covers,'required_bbox':required,
            'comparison_window_m':4500,'status':'requires_review' if reasons else 'eligible_for_staging',
            'reasons':reasons,'live_terrain_changed':False,
            'comparison_rule':'Area-average both surfaces to a common supported spacing; use at least the coarser native posting. Upsampling creates no evidence.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    path=ROOT/'data/terrain-upgrade-pilots.json'
    config=json.loads(path.read_text());catalog=json.loads((ROOT/'web/public/sites.json').read_text())
    sites={s['id']:s for s in catalog['sites']}
    result={'version':'1.0.0','config_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'scope':config['scope'],'pilots':[screen(sites[p['site_id']],p) for p in config['pilots']]}
    if args.check:
        if json.loads(OUTPUT.read_text())!=result:raise SystemExit('Terrain pilot report is stale.')
    else:OUTPUT.write_text(json.dumps(result,indent=2)+'\n')
    print('Terrain upgrade pilots:',[(p['site_id'],p['bbox_covers_comparison_window'],p['status']) for p in result['pilots']])


if __name__=='__main__':main()
