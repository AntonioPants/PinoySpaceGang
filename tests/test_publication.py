import json
import os
from types import SimpleNamespace

import pytest

from scripts.catalog.publication import publication
from scripts.catalog.metadata import preserve_handoff


def test_validation_failure_preserves_production(tmp_path):
    target = tmp_path / 'public'
    target.mkdir()
    (target / 'sites.json').write_text('original')
    with pytest.raises(ValueError, match='invalid'):
        with publication(target) as stage:
            (stage / 'sites.json').write_text('broken')
            raise ValueError('invalid catalog')
    assert (target / 'sites.json').read_text() == 'original'
    assert list(tmp_path.iterdir()) == [target]


def test_publish_rename_failure_rolls_back(tmp_path, monkeypatch):
    target = tmp_path / 'public'
    target.mkdir()
    (target / 'sites.json').write_text('original')
    replace = os.replace
    def fail_stage(source, destination):
        if source.name == 'public' and source.parent.name.startswith('.catalog-stage-'):
            raise PermissionError('simulated locked directory')
        return replace(source, destination)
    monkeypatch.setattr(os, 'replace', fail_stage)
    with pytest.raises(PermissionError):
        with publication(target) as stage:
            (stage / 'sites.json').write_text('new')
    assert (target / 'sites.json').read_text() == 'original'
    assert list(tmp_path.iterdir()) == [target]


def test_success_and_concurrent_writer_rejection(tmp_path):
    target = tmp_path / 'public'
    with publication(target) as stage:
        with pytest.raises(FileExistsError):
            with publication(target):
                pass
        (stage / 'sites.json').write_text('validated')
    assert (target / 'sites.json').read_text() == 'validated'
    assert list(tmp_path.iterdir()) == [target]


def test_handoff_preserves_curated_measurements_without_reusing_conditions():
    previous = {'feature_measurements': {'crater_diameter': {'value': 1200}},
                'conditions': {'old': True}}
    current = {'id': 'haughton', 'feature_measurements': {'crater_diameter': {'value': None}}}
    preserve_handoff(current, previous)
    assert current['feature_measurements']['crater_diameter']['value'] == 1200
    assert current['feature_measurements']['ground_ice_depth']['status'] == 'unknown'
    assert 'conditions' not in current


def test_build_failure_does_not_replace_catalog(tmp_path, monkeypatch):
    from scripts.catalog import build
    site = dict(id='test', name='Test', body='earth', morphology='crater',
                substrate='rock', evidence_url='https://example.org', matches=[])
    monkeypatch.setattr(build, 'records', lambda: [site])
    def fail(*args):
        raise OSError('source inaccessible')
    monkeypatch.setattr(build, 'terrain', fail)
    monkeypatch.setattr(build, 'environment', lambda *args: {})
    target = tmp_path / 'sites.json'
    target.write_text(json.dumps({'sites': []}))
    original = target.read_bytes()
    with pytest.raises(RuntimeError, match='source inaccessible'):
        build.build_records(SimpleNamespace(site=None, offline=True), tmp_path)
    assert target.read_bytes() == original


def test_build_and_registration_share_curated_metadata():
    from scripts.catalog.build import ROOT
    from scripts.catalog.metadata import make_catalog
    from scripts.catalog.measurements import literature_measurements
    catalog = json.loads((ROOT/'web/public/sites.json').read_text())
    for site in catalog['sites']:
        preserve_handoff(site)
    assert make_catalog(catalog['sites']) == catalog
    assert literature_measurements('amboy')['cone_height']['value'] == 76.2
    assert literature_measurements('kilbourne-hole-v1')['crater_long_dimension']['value'] > 3200


def test_all_asset_validation_detects_missing_inventory_and_modified_bytes(tmp_path):
    import shutil
    from scripts.catalog.build import ROOT, dump
    from scripts.catalog.validate import validate
    source = ROOT/'web/public'
    catalog = json.loads((source/'sites.json').read_text())
    site = next(s for s in catalog['sites'] if s['id'] == 'phoenix')
    catalog['sites'] = [site]
    catalog['pairings'] = []
    catalog['analog_matching']['comparisons'] = []
    folder = tmp_path/'terrain/phoenix'
    shutil.copytree(source/'terrain/phoenix',folder)
    from scripts.catalog.matching import attach_matching
    attach_matching(catalog,tmp_path)
    dump(tmp_path/'sites.json',catalog)
    validate(tmp_path)
    receipts = json.loads((folder/'checksums.json').read_text())
    missing = dict(receipts)
    missing.pop('elevation.tif')
    dump(folder/'checksums.json',missing)
    with pytest.raises(AssertionError, match='inventory'):
        validate(tmp_path)
    dump(folder/'checksums.json',receipts)
    with (folder/'elevation.tif').open('ab') as handle:
        handle.write(b'corrupt')
    with pytest.raises(AssertionError, match='checksum mismatch'):
        validate(tmp_path)
