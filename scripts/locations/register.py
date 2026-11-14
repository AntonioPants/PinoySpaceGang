"""Stage/publish one frozen scan shortlist through the catalog's publication transaction.

python -m scripts.locations.register stage
python -m scripts.locations.register publish

Uses the accuracy owner's existing scoring functions unchanged. No new pairing,
reviewed landform, environmental measurement or similarity rule is invented here.
"""
import argparse
import json
from pathlib import Path
import shutil

import numpy as np

from .scan import ROOT, INDEX, dump, sha
from .store import WindowStore
from .materialize import stage_window
from scripts.catalog.build import PUBLIC, CACHE, descriptors, property_record
from scripts.catalog.metadata import make_catalog
from scripts.catalog.publication import publication
from scripts.catalog.validate import validate
from scripts.catalog import analog_score

PENDING = CACHE / 'pending-scan'


def selected_windows(report):
    """Deduplicate packs across targets, preserving all score receipts."""
    selected = {}
    for target, group in sorted(report['targets'].items()):
        for row in group['shortlist']:
            sid = row['id']
            if not sid.startswith('scan-') or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in sid):
                raise ValueError('Invalid scanned window ID')
            if row['evidence_status'] != 'exploratory_terrain_only':
                raise ValueError('Scan shortlist must remain exploratory')
            item = selected.setdefault(sid, {'inferred_landforms': row['inferred_landforms'], 'targets': {}})
            if item['inferred_landforms'] != row['inferred_landforms']:
                raise ValueError('Inconsistent inferred labels across targets')
            if target in item['targets']:
                raise ValueError('Duplicate target/window shortlist entry')
            item['targets'][target] = row
    return dict(sorted(selected.items()))


def record_from_window(row, z, affine, receipt, selection, pack, index_hash, shortlist_hash):
    sid = row['id']
    region = receipt['region']
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
    source = {'product_id': 'COP-DEM-GLO-30', 'url': manifest['source']['url']}
    provenance = {
        'method_version': '1.0.0', 'window_id': sid, 'region_id': row['region_id'],
        'seed_site_ids': region['seed_site_ids'], 'source_urls': sorted(set(region['sources'])),
        'index_sha256': index_hash, 'shortlist_sha256': shortlist_hash,
        'evidence_status': 'exploratory_terrain_only',
        'inference_method': 'Region seed labels supplied by scan_matches; unreviewed at this window. The live scorer discounts inferred labels and excludes crater inference.',
        'shortlisted_for': sorted(selection['targets']),
    }
    entry = {
        'id': sid, 'name': row['name'], 'body': 'earth', 'role': 'earth_analog',
        'catalog_origin': 'regional_scan', 'longitude': row['longitude'], 'latitude': row['latitude'],
        'region': region['country'], 'bbox': row['bbox'],
        'description': 'Exploratory terrain window in ' + region['name'] + '. Landform candidates are borrowed from regional seed sites; local geology is unreviewed.',
        'morphology': 'unknown', 'substrate': 'unknown',
        'inferred_landforms': selection['inferred_landforms'], 'scan_provenance': provenance,
        'evidence_url': region['source_url'], 'matches': [],
        'study_status': 'research_area_not_landing_approval',
        'footprint_method': '161x161 north-first pixel-centre samples at 30m; 4800m sample span, 4830m pixel footprint. WGS84 UTM; EGM2008 elevations. No nodata filling.',
        'terrain': {'manifest_url': f'/terrain/{sid}/manifest.json',
                    'manifest_sha256': sha(pack / 'manifest.json'), 'elevation_sha256': sha(pack / 'elevation.f32'),
                    'rows': 161, 'columns': 161, 'spacing_m': 30, 'row_order': 'north_to_south',
                    'column_order': 'west_to_east', 'source_url': source['url'], 'native_resolution_m_approx': 30},
        'classification': {'morphology': 'unknown', 'substrate': 'unknown', 'status': 'unknown',
                           'source_url': region['source_url'], 'atmosphere': 'terrestrial',
                           'annual_air_temperature': None},
        'conditions': {}, 'simulation_defaults': {}, 'feature_measurements': {},
        'identifiers': ['exploratory_scan'], 'resource_indicators': [],
        'resources': {'value': None, 'status': 'unknown', 'reason': 'No site-specific resource product ingested.'},
        'land_cover_filter': row['land_cover'], 'limitations': manifest['limitations'],
    }
    dy, dx = np.gradient(z.astype('float64'), 30)
    slopes = np.degrees(np.arctan(np.hypot(dx, dy)))
    for key, value, unit in [('elevation_min', z.min(), 'm'), ('elevation_mean', z.mean(), 'm'),
                             ('elevation_max', z.max(), 'm'), ('slope_mean', slopes.mean(), 'deg'),
                             ('slope_p50', np.percentile(slopes, 50), 'deg'),
                             ('slope_p95', np.percentile(slopes, 95), 'deg'), ('slope_max', slopes.max(), 'deg')]:
        p = property_record(float(value), unit, 'derived', source, 30,
                            'Full-window elevation summary or finite-difference gradient on the 30m metric grid.',
                            coverage=manifest['source']['coverage'])
        p['analysis_resolution_m'] = 30
        entry['conditions'][key] = p
    for key, unit in [('wind_speed_10m', 'm/s'), ('air_temperature_2m', 'degC'), ('surface_temperature', 'K'),
                      ('albedo', '1'), ('friction', '1'), ('cohesion', 'Pa'), ('bulk_density', 'kg/m3')]:
        entry['conditions'][key] = property_record(None, unit, reason='No product ingested for this scan window; not inherited from regional seed sites or land-cover labels.')
    entry['comparison_features'] = descriptors(z, affine, source, 30)
    for p in entry['comparison_features'].values():
        p['time_coverage'] = manifest['source']['coverage']
    slope = entry['conditions']['slope_p95']['value']
    entry['classification']['slope_p95_class'] = 'level' if slope < 5 else 'gentle' if slope < 15 else 'steep' if slope < 30 else 'very_steep'
    rough = entry['comparison_features']['roughness_rms']['value']
    entry['classification']['roughness_3km'] = 'low' if rough < 10 else 'moderate' if rough < 50 else 'high'
    entry['completeness'] = {'terrain_available': True, 'known_conditions': 7, 'total_conditions': 14}
    source_receipt = json.loads((pack / 'source-receipt.json').read_text(encoding='utf-8'))
    source_receipt['registration_provenance'] = provenance
    dump(pack / 'source-receipt.json', source_receipt)
    dump(pack / 'checksums.json', {p.name: sha(p) for p in pack.iterdir() if p.name != 'checksums.json'})
    return entry


def verify_shortlist_scores(catalog, selected, public):
    """Reproduce all imported scores with the live owner code, including pruned rows."""
    from scripts.catalog import terrain_features as tf
    byid = {s['id']: s for s in catalog['sites']}
    scales = analog_score.load_scales()
    grids, features = {}, {}
    def windows(site, resolution):
        key = (site['id'], resolution)
        if key not in features:
            if site['id'] not in grids:
                grids[site['id']] = tf.pack_grid(site, public)[:2]
            features[key] = analog_score.window_features(*grids[site['id']], resolution)
        return features[key]
    for sid, item in selected.items():
        for tid, expected in item['targets'].items():
            earth, target = byid[sid], byid[tid]
            resolution = analog_score.resolution_for(target['terrain']['spacing_m'])
            actual = analog_score.pair_score(earth, target, windows(earth, resolution), windows(target, resolution), scales[resolution])
            for source_key, output_key in [('terrain_percent', 'terrain_similarity_percent'), ('analog_score_percent', 'analog_score_percent')]:
                if actual[source_key] is None or round(actual[source_key], 4) != expected[output_key]:
                    raise ValueError(f'{sid}/{tid}: shortlist score changed; rerun scan_matches before registration')
            if actual['valid_comparisons'] != 25:
                raise ValueError(f'{sid}/{tid}: incomplete stability windows')


def stage(shortlist=INDEX / 'matches.json', public=PUBLIC, pending=PENDING):
    report = json.loads(shortlist.read_text(encoding='utf-8'))
    selected = selected_windows(report)
    if not selected:
        raise ValueError('No shortlisted windows to register')
    baseline = json.loads((public / 'sites.json').read_text(encoding='utf-8'))
    baseline_hash = sha(public / 'sites.json')
    scales_hash = sha(analog_score.SCALES_PATH)
    with WindowStore() as store:
        if report['index_sha256'] != store.manifest['index_sha256']:
            raise ValueError('Shortlist references a different location index')
        with publication(pending, seed=public) as staged:
            byid = {s['id']: s for s in baseline['sites']}
            for sid, item in selected.items():
                if sid in byid and byid[sid].get('catalog_origin') != 'regional_scan':
                    raise ValueError('Refusing to overwrite a curated site')
                row, z, affine, source = store.read(sid)
                built = stage_window(sid, store=store)
                pack = staged / 'terrain' / sid
                shutil.copytree(built / 'terrain' / sid, pack, dirs_exist_ok=True)
                byid[sid] = record_from_window(row, z, affine, source, item, pack,
                                             report['index_sha256'], sha(shortlist))
            catalog = make_catalog(list(byid.values()), staged)
            dump(staged / 'sites.json', catalog)
            verify_shortlist_scores(catalog, selected, staged)
            validate(staged)
            if sha(analog_score.SCALES_PATH) != scales_hash:
                raise ValueError('Frozen scales changed during staging')
            existing = {(r['earth_id'], r['planetary_id']): r for r in baseline['analog_matching']['comparisons']}
            for row in catalog['analog_matching']['comparisons']:
                before = existing.get((row['earth_id'], row['planetary_id']))
                if before:
                    for field in ('analog_score_percent', 'terrain_similarity_percent'):
                        if row[field] != before[field]:
                            raise ValueError('Existing pair score changed during registration')
            receipt = {'method_version': '1.0.0', 'baseline_catalog_sha256': baseline_hash,
                       'scales_sha256': scales_hash, 'shortlist_sha256': sha(shortlist),
                       'index_sha256': report['index_sha256'], 'registered_ids': list(selected),
                       'selected': selected, 'status': 'validated_staging',
                       'staged_catalog_sha256': sha(staged / 'sites.json')}
            dump(staged / 'scan-registration.json', receipt)
    print(f'Staged {len(selected)} unique windows; all shortlisted scores reproduce; not published.')


def publish(public=PUBLIC, pending=PENDING):
    receipt = json.loads((pending / 'scan-registration.json').read_text(encoding='utf-8'))
    if sha(public / 'sites.json') != receipt['baseline_catalog_sha256']:
        raise ValueError('Production catalog changed after staging; restage to preserve changes')
    if sha(analog_score.SCALES_PATH) != receipt['scales_sha256']:
        raise ValueError('Frozen scales changed after staging')
    if sha(pending / 'sites.json') != receipt['staged_catalog_sha256']:
        raise ValueError('Staged catalog changed after validation')
    validate(pending)
    staged_catalog = json.loads((pending / 'sites.json').read_text(encoding='utf-8'))
    staged_sites = {s['id']: s for s in staged_catalog['sites']}
    # Seed from current public so unrelated assets are retained. Only selected packs
    # and their catalog entries are installed, then the existing matcher regenerates.
    with publication(public) as target:
        if sha(target / 'sites.json') != receipt['baseline_catalog_sha256']:
            raise ValueError('Production catalog changed before publication')
        sites = {s['id']: s for s in json.loads((target / 'sites.json').read_text(encoding='utf-8'))['sites']}
        for sid in receipt['registered_ids']:
            shutil.copytree(pending / 'terrain' / sid, target / 'terrain' / sid, dirs_exist_ok=True)
            sites[sid] = staged_sites[sid]
        catalog = make_catalog(list(sites.values()), target)
        dump(target / 'sites.json', catalog)
        validate(target)
        dump(target / 'scan-registration.json', dict(receipt, status='published'))
    dump(INDEX / 'registration.json', dict(receipt, status='published'))
    print(f'Published {len(receipt["registered_ids"])} exploratory terrain packs. No literature pairings added.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['stage', 'publish'])
    parser.add_argument('--shortlist', type=Path, default=INDEX / 'matches.json')
    args = parser.parse_args()
    stage(args.shortlist) if args.action == 'stage' else publish()
