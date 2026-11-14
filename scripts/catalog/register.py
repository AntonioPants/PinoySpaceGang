"""Publish validated pending packs built with: python -m scripts.catalog.build --site ID."""
import argparse
import json
import shutil

from .build import CACHE, PUBLIC, ROOT, dump
from .metadata import make_catalog, preserve_handoff
from .publication import publication
from .validate import validate


def register(site_ids, public=PUBLIC, cache=CACHE):
    if not site_ids or len(site_ids) != len(set(site_ids)):
        raise ValueError('Supply unique site IDs')
    with publication(public) as stage:
        catalog = json.loads((stage/'sites.json').read_text(encoding='utf-8'))
        by_id = {s['id']: s for s in catalog['sites']}
        for sid in site_ids:
            if not sid or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in sid):
                raise ValueError('Invalid site ID')
            pending = cache/'pending'/sid
            validate(pending)
            snapshot = json.loads((pending/'sites.json').read_text(encoding='utf-8'))
            record = next((s for s in snapshot['sites'] if s['id'] == sid), None)
            if not record or not record.get('terrain'):
                raise ValueError(f'{sid}: no successfully staged terrain; run build --site first')
            preserve_handoff(record, by_id.get(sid))
            shutil.copytree(pending/'terrain'/sid, stage/'terrain'/sid, dirs_exist_ok=True)
            by_id[sid] = record
        dump(stage/'sites.json', make_catalog(list(by_id.values())))
        validate(stage)
    dump(ROOT/'data/catalog-run-report.json', {'operation': 'register', 'registered_sites': site_ids,
        'published': True, 'failures': [], 'sites': len(by_id)})
    print(f'Published {", ".join(site_ids)} after validation')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', action='append', required=True)
    register(parser.parse_args().site)
