"""Register successfully built --site records without re-downloading the existing catalog.

Run after building each site: python -m scripts.catalog.register --site haughton --site qaidam
"""
import argparse
import json
import shutil

import numpy as np

from .build import CACHE, PUBLIC, ROOT, dump, sha
from .scoring import compare


def register(site_ids):
    catalog_path = PUBLIC / 'sites.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    by_id = {site['id']: site for site in catalog['sites']}
    for site_id in site_ids:
        if not site_id or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in site_id):
            raise ValueError('Invalid site ID')
        record = json.loads((CACHE / f'{site_id}-record.json').read_text(encoding='utf-8'))
        if record['id'] != site_id or not record.get('terrain') or not record.get('bbox'):
            raise ValueError(f'{site_id}: only a successfully built terrain record can be enabled')
        manifest_path = PUBLIC / record['terrain']['manifest_url'].lstrip('/')
        if sha(manifest_path) != record['terrain']['manifest_sha256']:
            raise ValueError(f'{site_id}: stale build manifest')
        samples = np.fromfile(manifest_path.parent / 'elevation.f32', dtype='<f4')
        if samples.size != record['terrain']['rows'] * record['terrain']['columns'] or not np.isfinite(samples).all():
            raise ValueError(f'{site_id}: invalid terrain samples')
        if sha(manifest_path.parent / 'elevation.f32') != record['terrain']['elevation_sha256']:
            raise ValueError(f'{site_id}: stale elevation receipt')
        # Preserve native samples and receipt for independent reprocessing of these new packs.
        native = CACHE / f'{site_id}-source.tif'
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        if sha(native) != manifest['source']['subset_sha256']:
            raise ValueError(f'{site_id}: source-window hash mismatch')
        shutil.copy2(native, manifest_path.parent / 'source-window.tif')
        shutil.copy2(CACHE / f'{site_id}-source.json', manifest_path.parent / 'source-receipt.json')
        manifest['source']['subset_file'] = 'source-window.tif'
        manifest['source']['receipt_file'] = 'source-receipt.json'
        if site_id == 'haughton':
            record['pairing_notes'] = {'shackleton-rim': {
                'matches': ['Impact-generated terrain and local relief offer a proposed operations/terrain comparison.'],
                'differences': ['This crop is Haughton floor context; the target crop is a Shackleton rim neighbourhood.', 'Earth atmosphere, seasonal water, weathering and illumination differ from lunar polar conditions.', 'Neither this crop nor its descriptor score establishes whole-crater similarity or local ice resources.'],
                'status': 'proposed_unvalidated',
            }}
        elif site_id == 'qaidam':
            record['pairing_notes'] = {}
            record['pairing_status'] = 'deferred_pending_yardang_target_footprint'
        dump(manifest_path, manifest)
        record['terrain']['manifest_sha256'] = sha(manifest_path)
        dump(manifest_path.parent / 'checksums.json', {
            p.name: sha(p) for p in manifest_path.parent.iterdir() if p.is_file() and p.name != 'checksums.json'
        })
        dump(CACHE / f'{site_id}-record.json', record)
        for key in ({'haughton': ['crater_diameter', 'rim_geometry', 'ground_ice_depth'], 'qaidam': ['yardang_height', 'yardang_width', 'yardang_orientation', 'surface_material_fractions']}.get(site_id, [])):
            record['feature_measurements'][key] = {'value': None, 'status': 'unknown', 'reason': 'Requires feature delineation, finer terrain or field measurements; not inferred from this regional DSM.'}
        dump(CACHE / f'{site_id}-record.json', record)
        by_id[site_id] = record
    # Validate old manifest hashes before migrating known CRLF receipts to committed LF bytes.
    # A different mismatch remains an error; binary elevation hashes are never rewritten.
    import hashlib
    for record in by_id.values():
        terrain = record.get('terrain')
        if not terrain:
            continue
        path = PUBLIC / terrain['manifest_url'].lstrip('/')
        actual = sha(path)
        if actual != terrain['manifest_sha256']:
            crlf_hash = hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')).hexdigest()
            if crlf_hash != terrain['manifest_sha256']:
                raise ValueError(f'{record["id"]}: unexplained manifest checksum mismatch')
            terrain['manifest_sha256'] = actual
        checksums_path = path.parent / 'checksums.json'
        checksums = json.loads(checksums_path.read_text(encoding='utf-8'))
        recorded = checksums.get('manifest.json')
        if isinstance(recorded, dict):
            recorded.update(sha256=actual, bytes=path.stat().st_size)
        else:
            checksums['manifest.json'] = actual
        dump(checksums_path, checksums)
        if sha(path.parent / 'elevation.f32') != terrain['elevation_sha256']:
            raise ValueError(f'{record["id"]}: elevation checksum mismatch')
    catalog['sites'] = list(by_id.values())
    for record in catalog['sites']:
        if record['id'] not in site_ids:
            continue
        catalog['pairings'] = [p for p in catalog['pairings'] if p['earth_id'] != record['id']]
        for target_id in record['matches']:
            target = by_id[target_id]
            catalog['pairings'].append({
                'earth_id': record['id'], 'planetary_id': target_id,
                **compare(record['comparison_features'], target['comparison_features']),
                'explanation': record.get('pairing_notes', {}).get(target_id),
                'geology_comparison': {'same_substrate_label': record['substrate'] == target['substrate'], 'same_morphology_label': record['morphology'] == target['morphology'], 'score': None, 'reason': 'Categorical labels are not a validated geological similarity metric.'},
            })
    dump(catalog_path, catalog)
    dump(ROOT / 'data/catalog-run-report.json', {'operation': 'register-site-records', 'registered_sites': site_ids, 'failures': [], 'sites': len(by_id), 'terrain_available': sum(s.get('terrain') is not None for s in by_id.values())})
    print(f'Registered {", ".join(site_ids)}; {len(catalog["sites"])} total sites')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', action='append', required=True)
    register(parser.parse_args().site)
