"""Catalog growth preserves real, distinct study areas and fails publication closed."""
import json

import pytest

from scripts.catalog import build, expand_global
from scripts.catalog.global_sites import IDS


def test_fifty_earth_sites_have_distinct_assets_and_nonoverlapping_additions():
    catalog = json.loads((build.PUBLIC/'sites.json').read_text(encoding='utf-8'))
    earth = [s for s in catalog['sites'] if s['body'] == 'earth' and s.get('catalog_origin') != 'regional_scan']
    assert len(earth) == 50
    assert len({s['id'] for s in earth}) == 50
    assert len({s['terrain']['manifest_url'] for s in earth}) == 50
    hashes = []
    for site in earth:
        path = build.PUBLIC / site['terrain']['manifest_url'].lstrip('/')
        manifest = json.loads(path.read_text(encoding='utf-8'))
        hashes.append(build.sha(path.parent/manifest['grid']['sample_file']))
        if site['id'] not in IDS:
            continue
        west, south, east, north = site['bbox']
        for other in earth:
            if other['id'] == site['id']:
                continue
            ow, os, oe, on = other['bbox']
            assert east <= ow or oe <= west or north <= os or on <= south, (site['id'], other['id'])
    assert len(set(hashes)) == 50, 'No duplicated height grids disguised as new locations'


def test_failed_batch_continues_independent_sites_but_never_publishes(tmp_path, monkeypatch):
    attempts, publications = [], []
    monkeypatch.setattr(expand_global, 'IDS', ('first', 'blocked', 'last'))
    monkeypatch.setattr(build, 'ROOT', tmp_path)

    def stage(args):
        attempts.append(args[1])
        if args[1] == 'blocked':
            raise ConnectionError('source unavailable')

    monkeypatch.setattr(build, 'main', stage)
    monkeypatch.setattr(expand_global, 'register', publications.append)
    with pytest.raises(RuntimeError, match='not published'):
        expand_global.main(['--publish'])
    assert attempts == ['first', 'blocked', 'last']
    assert publications == []
    report = json.loads((tmp_path/'data/catalog-expansion-report.json').read_text())
    assert report['staged'] == ['first', 'last']
    assert report['failures'] == [{'site': 'blocked', 'error': 'source unavailable'}]
    assert report['published'] is False


def test_staging_only_does_not_publish(tmp_path, monkeypatch):
    publications = []
    monkeypatch.setattr(expand_global, 'IDS', ('one',))
    monkeypatch.setattr(build, 'ROOT', tmp_path)
    monkeypatch.setattr(build, 'main', lambda args: None)
    monkeypatch.setattr(expand_global, 'register', publications.append)
    expand_global.main([])
    assert publications == []
    report = json.loads((tmp_path/'data/catalog-expansion-report.json').read_text())
    assert report['published'] is False and report['staged'] == ['one']
