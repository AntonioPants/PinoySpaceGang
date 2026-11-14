"""Validate catalog schema, provenance, rasters and deterministic comparisons offline."""
import json
import math
from pathlib import Path
import numpy as np
import jsonschema
import rasterio
from .build import PUBLIC, ROOT, sha
from .scoring import compare

def validate_exploratory_site(site, byid):
    """Allow an unpaired scan only with explicit, traceable inference metadata."""
    from .analog_score import FAMILIES
    assert site['catalog_origin']=='regional_scan'
    assert site['body']=='earth' and site['role']=='earth_analog'
    assert site['morphology']=='unknown' and site['substrate']=='unknown'
    assert site['matches']==[], 'Scanned windows cannot gain literature tier through registration'
    p=site['scan_provenance']
    assert p['window_id']==site['id'] and p['evidence_status']=='exploratory_terrain_only'
    seeds=[byid[sid] for sid in p['seed_site_ids']]
    assert seeds and all(s['body']=='earth' and s.get('catalog_origin')!='regional_scan' for s in seeds)
    expected=sorted({s['morphology'] for s in seeds if s['morphology'] in FAMILIES})
    assert site['inferred_landforms']==expected, 'Borrowed labels must match documented region seeds'
    assert set(p['source_urls'])=={s['evidence_url'] for s in seeds}
    assert site['classification']['status']=='unknown'


def validate(public=PUBLIC):
    catalog=json.loads((public/'sites.json').read_text(encoding='utf-8'))
    schema=json.loads((ROOT/'data/sites.schema.json').read_text(encoding='utf-8'))
    jsonschema.Draft202012Validator(schema).validate(catalog)
    ids=[s['id'] for s in catalog['sites']]
    assert len(ids)==len(set(ids))
    for s in catalog['sites']:
        assert -180<=s['longitude']<=180 and -90<=s['latitude']<=90
        assert s['evidence_url'].startswith('https://')
        for p in [*s['conditions'].values(),*s['comparison_features'].values(),*s.get('feature_measurements',{}).values()]:
            if p['value'] is None: assert p['reason']
            else:
                assert math.isfinite(p['value']) and p['source'] and p['method'] and p['unit']
            if p['status'] in ('unknown','not_applicable'): assert p['value'] is None
        if not s['terrain']: continue
        t=s['terrain']; path=public/t['manifest_url'].lstrip('/')
        assert path.resolve().is_relative_to((public/'terrain').resolve())
        assert sha(path)==t['manifest_sha256']
        assert sha(path.parent/'elevation.f32')==t['elevation_sha256']
        m=json.loads(path.read_text(encoding='utf-8'))
        assert m['id']==s['id'] and m['body'].lower()==s['body'] and m['schema_version']==1
        assert m['grid']['order'] in ('north-first, west-first', 'row-major; north to south, west to east')
        assert m['grid']['spacing_m']==t['spacing_m']
        assert m['grid']['dtype']=='float32' and m['grid']['byte_order']=='little-endian'
        receipts=json.loads((path.parent/'checksums.json').read_text(encoding='utf-8'))
        assert set(receipts) == {p.name for p in path.parent.iterdir() if p.is_file() and p.name != 'checksums.json'}, f'{s["id"]}: incomplete asset inventory'
        for filename, receipt in receipts.items():
            asset=path.parent/filename
            assert asset.resolve().is_relative_to(path.parent.resolve())
            expected=receipt['sha256'] if isinstance(receipt,dict) else receipt
            assert sha(asset)==expected, f'{s["id"]}: checksum mismatch for {filename}'
            if isinstance(receipt,dict) and 'bytes' in receipt:
                assert asset.stat().st_size==receipt['bytes']
        for key in ('subset_file','receipt_file'):
            if m['source'].get(key):
                assert m['source'][key] in receipts, f'{s["id"]}: missing source receipt entry'
        if m['source'].get('subset_file'):
            assert sha(path.parent/m['source']['subset_file'])==m['source']['subset_sha256']
            source_receipt=json.loads((path.parent/m['source']['receipt_file']).read_text(encoding='utf-8'))
            assert source_receipt['sha256']==m['source']['subset_sha256']
            assert source_receipt['url']==m['source']['url']
        z=np.fromfile(path.parent/'elevation.f32',dtype='<f4')
        assert z.size==t['rows']*t['columns'] and np.isfinite(z).all()
        assert m['grid']['rows']==t['rows'] and m['grid']['columns']==t['columns']
        assert t['row_order']=='north_to_south' and t['column_order']=='west_to_east'
        assert math.isfinite(t['spacing_m']) and t['spacing_m']>0 and t['rows']>=2 and t['columns']>=2
        tif=path.parent/('elevation-utm.tif' if s['id']=='kilbourne-hole-v1' else 'elevation.tif')
        with rasterio.open(tif) as raster:
            assert (raster.height,raster.width)==(t['rows'],t['columns'])
            assert raster.crs and raster.transform.a==t['spacing_m'] and raster.transform.e==-t['spacing_m']
            assert raster.transform.b==0 and raster.transform.d==0
            np.testing.assert_array_equal(raster.read(1).ravel(),z)
        west,south,east,north=s['bbox']
        assert west<east and south<north
        assert west<=s['longitude']<=east and south<=s['latitude']<=north
    byid={s['id']:s for s in catalog['sites']}
    for site in catalog['sites']:
        if site['body'] == 'earth' and site['terrain']:
            if site.get('catalog_origin')=='regional_scan':
                validate_exploratory_site(site, byid)
                pack=public/site['terrain']['manifest_url'].lstrip('/')
                receipt=json.loads((pack.parent/'source-receipt.json').read_text(encoding='utf-8'))
                assert receipt['registration_provenance']==site['scan_provenance']
                assert receipt['window']['elevation_sha256']==site['terrain']['elevation_sha256']
            else:
                assert site['matches'], f"{site['id']}: enabled Earth site needs a proposed pairing"
            assert set(site['matches']) == {p['planetary_id'] for p in catalog['pairings'] if p['earth_id'] == site['id']}
    for pair in catalog['pairings']:
        assert pair['explanation']['status'] == 'proposed_unvalidated'
        expected=compare(byid[pair['earth_id']]['comparison_features'],byid[pair['planetary_id']]['comparison_features'])
        assert all(pair[k]==v for k,v in expected.items())
    from copy import deepcopy
    from .accuracy import attach_accuracy
    samples={}
    audited=attach_accuracy(deepcopy(catalog),public,samples)
    for actual,expected in zip(catalog['pairings'],audited['pairings']):
        assert actual.get('accuracy_check')==expected['accuracy_check'], 'Pairing accuracy audit missing or stale; refresh catalog metadata'
    from .matching import attach_matching
    expected_matching=attach_matching(audited,public,sample_cache=samples)['analog_matching']
    assert catalog.get('analog_matching')==expected_matching, 'Analog matching missing or stale; refresh catalog metadata'
    print(f"PASS: {len(ids)} sites, {len(catalog['pairings'])} reproducible pairings; schemas, units, bounds, assets, hashes and missing values")

if __name__=='__main__': validate()
