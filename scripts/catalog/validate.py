"""Validate catalog schema, provenance, rasters and deterministic comparisons offline."""
import json
import math
from pathlib import Path
import numpy as np
import jsonschema
from .build import PUBLIC, ROOT, sha
from .scoring import compare

def validate():
    catalog=json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    schema=json.loads((ROOT/'data/sites.schema.json').read_text(encoding='utf-8'))
    jsonschema.Draft202012Validator(schema).validate(catalog)
    ids=[s['id'] for s in catalog['sites']]
    assert len(ids)==len(set(ids))
    for s in catalog['sites']:
        assert -180<=s['longitude']<=180 and -90<=s['latitude']<=90
        assert s['evidence_url'].startswith('https://')
        for p in [*s['conditions'].values(),*s['comparison_features'].values()]:
            if p['value'] is None: assert p['reason']
            else:
                assert math.isfinite(p['value']) and p['source'] and p['method']
            if p['status'] in ('unknown','not_applicable'): assert p['value'] is None
        if not s['terrain']: continue
        t=s['terrain']; path=PUBLIC/t['manifest_url'].lstrip('/')
        assert sha(path)==t['manifest_sha256']
        assert sha(path.parent/'elevation.f32')==t['elevation_sha256']
        m=json.loads(path.read_text(encoding='utf-8'))
        z=np.fromfile(path.parent/'elevation.f32',dtype='<f4')
        assert z.size==t['rows']*t['columns'] and np.isfinite(z).all()
        assert m['grid']['rows']==t['rows'] and m['grid']['columns']==t['columns']
        west,south,east,north=s['bbox']
        assert west<east and south<north
        assert west<=s['longitude']<=east and south<=s['latitude']<=north
    byid={s['id']:s for s in catalog['sites']}
    for site in catalog['sites']:
        if site['body'] == 'earth' and site['terrain']:
            assert site['matches'], f"{site['id']}: enabled Earth site needs a proposed pairing"
            assert set(site['matches']) == {p['planetary_id'] for p in catalog['pairings'] if p['earth_id'] == site['id']}
    for pair in catalog['pairings']:
        assert pair['explanation']['status'] == 'proposed_unvalidated'
        expected=compare(byid[pair['earth_id']]['comparison_features'],byid[pair['planetary_id']]['comparison_features'])
        assert all(pair[k]==v for k,v in expected.items())
    print(f"PASS: {len(ids)} sites, {len(catalog['pairings'])} reproducible pairings; schemas, units, bounds, assets, hashes and missing values")

if __name__=='__main__': validate()
