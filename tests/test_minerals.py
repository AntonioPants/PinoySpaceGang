import json
import math

import numpy as np
import pytest

from scripts.catalog import minerals

CATALOG = json.loads((minerals.PUBLIC/'sites.json').read_text(encoding='utf-8'))
SITES = {s['id']: s for s in CATALOG['sites']}


def vicar(grid):
    label = (f"LBLSIZE=200 FORMAT='REAL' TYPE='IMAGE' ORG='BSQ' NL={grid.shape[0]} NS={grid.shape[1]} NB=1 "
             "REALFMT='RIEEE' HOST='PC'").ljust(200).encode('ascii')
    return label+grid.astype('<f4').tobytes()


def test_vicar_images_parse_north_first_and_reject_other_layouts():
    grid = np.arange(12, dtype=float).reshape(3, 4)
    assert np.array_equal(minerals.parse_vicar(vicar(grid)), grid)
    with pytest.raises(ValueError):
        minerals.parse_vicar(b'<html>not a map</html>'.ljust(300))
    with pytest.raises(ValueError):
        minerals.parse_vicar(vicar(grid).replace(b"FORMAT='REAL'", b"FORMAT='BYTE'"))


def test_a_mars_point_reads_the_tes_pixel_that_contains_it():
    grid = np.zeros((720, 1440))
    grid[0, 0] = .5
    grid[359, 1439] = .25
    grid[719, 720] = .125
    assert minerals.mars_value(grid, 89.9, 0.1) == .5
    assert minerals.mars_value(grid, 0.1, -0.1) == .25        # west longitudes wrap to 0-360 E
    assert minerals.mars_value(grid, -90, 180.1) == .125
    grid[10, 10] = np.nan
    assert minerals.mars_value(grid, 90-10.5/4, 10.5/4) is None


def test_the_window_is_the_terrain_pack_footprint_on_the_sphere():
    site = SITES['marius-hills']
    width, depth = minerals.footprint_m(site)
    assert (width, depth) == (4800.0, 4800.0)
    west, south, east, north = minerals.window_degrees(site['latitude'], site['longitude'], width, depth, minerals.MOON_RADIUS_M)
    assert math.radians(north-south)*minerals.MOON_RADIUS_M == pytest.approx(4800)
    assert math.radians(east-west)*minerals.MOON_RADIUS_M*math.cos(math.radians(site['latitude'])) == pytest.approx(4800)
    assert (west+east)/2 == pytest.approx(site['longitude']) and (south+north)/2 == pytest.approx(site['latitude'])


def test_moon_records_scale_to_percent_and_blank_the_instrument_gaps_and_skip_polar_sites():
    real = {'FeOWeightPercent': 8.0, 'OlivinePercent': .04, 'ClinopyroxenePercent': .12, 'OrthopyroxenePercent': .10, 'PlagioclasePercent': .74}
    filler = {'FeOWeightPercent': 21.9377, 'OlivinePercent': .1, 'ClinopyroxenePercent': .7, 'OrthopyroxenePercent': .2, 'PlagioclasePercent': 0.0}

    def read(stem, bounds):
        grid = np.full((81, 82), real[stem])
        grid[:, 70:] = filler[stem]          # an unobserved strip along the east edge, as in the source
        return grid
    record = minerals.moon_record(SITES['apollo-16-descartes'], read, '2026-01-01')
    layers = {layer['key']: layer for layer in record['layers']}
    assert record['kind'] == 'map' and record['grid'] == {'rows': 33, 'columns': 33, 'order': 'north-first, west-first'}
    assert record['measured_share'] == pytest.approx(70/82, abs=1e-3)
    # the filler never reaches the published values: every statistic is the measured rock
    assert (layers['feo']['min'], layers['feo']['max'], layers['feo']['unit']) == (8.0, 8.0, 'wt%')
    assert (layers['olivine']['mean'], layers['olivine']['max'], layers['olivine']['unit']) == (4.0, 4.0, '%')
    assert layers['plagioclase']['min'] == 74.0
    row = layers['olivine']['values'][:33]
    assert row[0] == 4.0 and row[-1] is None and None in row and len(layers['olivine']['values']) == 33*33
    assert record['source']['page'].startswith('https://') and len(record['source']['files']) == 5
    assert minerals.moon_record(SITES['shackleton-rim'], read, '2026-01-01') is None   # poleward of 50 degrees


def test_averaging_ignores_gaps_and_keeps_empty_cells_empty():
    grid = np.array([[1., 3., np.nan, np.nan], [1., 3., np.nan, np.nan]])
    out = minerals.average_to(grid, (1, 2))
    assert out[0, 0] == 2.0 and math.isnan(out[0, 1])
    grid[0, 2] = 5.0
    assert minerals.average_to(grid, (1, 2))[0, 1] == 5.0


def test_mars_records_are_one_regional_value_and_flag_the_detection_limit():
    grids = {layer: np.zeros((720, 1440)) for _, layer, _ in minerals.MARS_LAYERS}
    site = SITES['meridiani-planum']
    assert minerals.mars_record(site, grids, '2026-01-01') is None       # nothing fitted there
    grids['TES_Hematite_numeric'][:] = .13
    grids['TES_Olivine_numeric'][:] = .04
    record = minerals.mars_record(site, grids, '2026-01-01')
    layers = {layer['key']: layer for layer in record['layers']}
    assert record['kind'] == 'regional' and record['grid']['rows'] == 1
    assert layers['hematite']['values'] == [13.0] and layers['hematite']['below_detection'] is False
    assert layers['olivine']['mean'] == 4.0 and layers['olivine']['below_detection'] is True
    assert 'regional value' in record['caveats'][0]


def test_published_minerals_match_the_catalog_and_their_own_statistics():
    index = json.loads((minerals.OUT/'index.json').read_text(encoding='utf-8'))
    targets = {s['id'] for s in CATALOG['sites'] if s['role'] == 'planetary_target' and s.get('terrain')}
    assert set(index['sites']) | set(index['unavailable']) == targets
    assert not set(index['sites']) & set(index['unavailable'])
    for site_id, kind in index['sites'].items():
        record = json.loads((minerals.OUT/f'{site_id}.json').read_text(encoding='utf-8'))
        site = SITES[site_id]
        assert record['id'] == site_id and record['kind'] == kind and record['body'] == site['body']
        assert kind == ('map' if site['body'] == 'moon' else 'regional')
        if site['body'] == 'moon':
            assert abs(site['latitude']) < minerals.MOON_LATITUDE_LIMIT
            # Reject an incomplete re-ingest: old maps included the instrument's
            # fixed filler composition and had no measured coverage field.
            assert 0 < record['measured_share'] <= 1
            assert any('left blank' in note for note in record['caveats'])
        for layer in record['layers']:
            values = [v for v in layer['values'] if v is not None]
            assert len(layer['values']) == record['grid']['rows']*record['grid']['columns'] and values
            assert layer['min'] == pytest.approx(min(values)) and layer['max'] == pytest.approx(max(values))
            assert 0 <= layer['min'] <= layer['mean'] <= layer['max'] <= (110 if layer['unit'] == 'wt%' else 100)
        assert record['source']['page'].startswith('https://') and record['source']['citation']
    for site_id in index['unavailable']:
        assert not (minerals.OUT/f'{site_id}.json').exists()
