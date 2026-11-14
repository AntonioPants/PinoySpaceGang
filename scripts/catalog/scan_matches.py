"""Score the scanned Earth windows against every planetary target and shortlist the best.

Usage: python -m scripts.catalog.scan_matches

Reads the location index (scripts.locations, data/earth_index) and the published
catalog, and writes data/earth_index/matches.json. Nothing in web/public changes:
a shortlisted window becomes selectable only after it is staged as a terrain pack
and registered in the catalog, where matching.py scores it with the same rules.

Scoring is the live analog score. A scanned window has no reviewed landform, so it
borrows the landforms of its region's seed catalog sites as `inferred_landforms`,
scored at analog_score.INFERRED_FACTOR of a reviewed label. Every shortlisted
window stays `exploratory_terrain_only`; this is candidate discovery, not validation.
"""
import json
import math
from pathlib import Path

from . import analog_score, terrain_features as tf
from .accuracy import OFFSETS
from .matching import MIN_EXPLORATORY_SCORE_PERCENT, TOP_K

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT/'web/public'
REGIONS = ROOT/'data/scan_regions.json'
OUTPUT = ROOT/'data/earth_index/matches.json'
VERSION = '1.0.0'
# Windows are 4.8 km wide on a 2.4 km stride, so neighbours overlap. A shortlist keeps
# windows whose centres are at least one window apart, and skips existing catalog footprints.
MIN_SEPARATION_KM = 4.8


def distance_km(a, b):
    """Great-circle distance between (longitude, latitude) points."""
    (lon1, lat1), (lon2, lat2) = ((math.radians(v) for v in p) for p in (a, b))
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 2*6371.0088*math.asin(math.sqrt(h))


def inferred_landforms(regions, sites_by_id):
    """{region_id: sorted reviewed landforms of the region's seed catalog sites}."""
    return {r['id']: sorted({sites_by_id[s]['morphology'] for s in r['seed_site_ids']
                             if s in sites_by_id and sites_by_id[s]['morphology'] in analog_score.FAMILIES})
            for r in regions}


def shortlist(scored, catalog_points, limit=TOP_K, cutoff=MIN_EXPLORATORY_SCORE_PERCENT):
    """Best-first, non-overlapping windows at or above the cutoff. Stable ID breaks ties."""
    chosen = []
    for row in sorted(scored, key=lambda r: (-r['analog_score_percent'], r['id'])):
        if row['analog_score_percent'] < cutoff or len(chosen) == limit:
            break
        point = (row['longitude'], row['latitude'])
        if any(distance_km(point, p) < MIN_SEPARATION_KM for p in catalog_points):
            continue
        if any(distance_km(point, (c['longitude'], c['latitude'])) < MIN_SEPARATION_KM for c in chosen):
            continue
        chosen.append(row)
    return chosen


def build(catalog, store, regions, scales, public=PUBLIC):
    sites = {s['id']: s for s in catalog['sites']}
    targets = sorted((s for s in catalog['sites'] if s['role'] == 'planetary_target' and s.get('terrain')), key=lambda s: s['id'])
    earth_points = [(s['longitude'], s['latitude']) for s in catalog['sites'] if s['role'] == 'earth_analog']
    inferred = inferred_landforms(regions, sites)
    resolutions = sorted({analog_score.resolution_for(t['terrain']['spacing_m']) for t in targets})
    grids = {}
    central = {}  # window id -> {resolution: features}
    for row in store.records:
        _, z, _, _ = store.read(row['id'])
        grids[row['id']] = z
        central[row['id']] = {r: tf.features(z, row['terrain_window']['spacing_m'], r) for r in resolutions}
    result = {}
    for target in targets:
        resolution = analog_score.resolution_for(target['terrain']['spacing_m'])
        target_grid = tf.pack_grid(target, public)[:2]
        target_windows = analog_score.window_features(*target_grid, resolution)
        scored = []
        for row in store.records:
            labels = inferred[row['region_id']]
            form = analog_score.landform(None, target['morphology'], labels)
            terrain = analog_score.terrain_percent(central[row['id']][resolution], target_windows[0], scales.get(resolution))
            score = analog_score.combine(terrain, form['match_percent'])
            if score is not None:
                scored.append({'id': row['id'], 'name': row['name'], 'region_id': row['region_id'],
                               'longitude': row['longitude'], 'latitude': row['latitude'],
                               'inferred_landforms': labels, 'landform': form,
                               'terrain_similarity_percent': terrain, 'analog_score_percent': score})
        picked = shortlist(scored, earth_points)
        for rank, row in enumerate(picked, 1):
            # Stability over the 25 shifted-window combinations, as for catalog pairs.
            spacing = store.by_id[row['id']]['terrain_window']['spacing_m']
            windows = [tf.features(grids[row['id']], spacing, resolution, offset) for offset in OFFSETS]
            shifted = [analog_score.terrain_percent(a, b, scales.get(resolution)) for a in windows for b in target_windows]
            complete = all(v is not None for v in shifted)
            low, high = (min(shifted), max(shifted)) if complete else (None, None)
            row.update(candidate_rank=rank, evidence_status='exploratory_terrain_only',
                       terrain_range_percent=[low, high],
                       window_sensitivity='insufficient_data' if not complete else
                           'sensitive' if high-low > analog_score.SENSITIVE_SPAN_PERCENT else 'limited_change')
            for key in ('terrain_similarity_percent', 'analog_score_percent'):
                row[key] = round(row[key], 4)
            row['terrain_range_percent'] = [round(v, 4) if v is not None else None for v in row['terrain_range_percent']]
        result[target['id']] = {'comparison_resolution_m': resolution, 'windows_scored': len(scored),
                                'windows_at_or_above_cutoff': sum(r['analog_score_percent'] >= MIN_EXPLORATORY_SCORE_PERCENT for r in scored),
                                'shortlist': picked}
    return {'method_version': VERSION, 'analog_score_version': analog_score.VERSION, 'descriptor_version': tf.VERSION,
            'index_sha256': store.manifest['index_sha256'],
            'scientifically_validated': False,
            'scope': 'Exploratory candidate discovery among scanned windows. Landforms are inferred from region seed sites and unreviewed. Not validated accuracy and not catalog entries.',
            'rules': {'min_score_percent': MIN_EXPLORATORY_SCORE_PERCENT, 'top_k': TOP_K,
                      'inferred_landform_factor': analog_score.INFERRED_FACTOR,
                      'min_separation_km': MIN_SEPARATION_KM,
                      'excluded': 'windows centred within min_separation_km of an existing catalog Earth site or a higher-ranked shortlisted window'},
            'window_count': len(store.records), 'targets': result}


def main():
    from scripts.locations.store import WindowStore
    catalog = json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    regions = json.loads(REGIONS.read_text(encoding='utf-8'))['regions']
    with WindowStore() as store:
        report = build(catalog, store, regions, analog_score.load_scales())
    OUTPUT.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    for tid, data in report['targets'].items():
        best = ', '.join(f"{r['region_id'].removesuffix('-region')} {r['analog_score_percent']:.0f}" for r in data['shortlist'][:5])
        print(f"{tid:16} {data['windows_at_or_above_cutoff']:4} windows >= cutoff, shortlisted {len(data['shortlist']):2} | {best}")


if __name__ == '__main__':
    main()
