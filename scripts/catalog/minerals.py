"""Mineral and iron-oxide abundance over each Moon and Mars study area, for the debrief's mineral map.

Sources (open, measured from orbit; nothing here is modelled or interpolated beyond resampling):

* Moon: SELENE/Kaguya Multiband Imager mineral maps, Lemelin et al. (May 2016 release, USGS
  Astrogeology). 512 pixels/degree (about 59 m), 50N to 50S only. FeO is weight percent; olivine,
  clinopyroxene, orthopyroxene and plagioclase are fractions of the four-mineral total and are
  published here as percent. Each study area is read as a byte-range window: the 37 GB files are
  never downloaded.
* Mars: MGS Thermal Emission Spectrometer mineral maps, Bandfield (2002), served by Arizona State
  University at 4 pixels/degree (about 15 km at the equator). A study area is smaller than one
  pixel, so each mineral is one regional value, not a map of the site.

Earth sites have no comparable product ingested and get no file.

    python -m scripts.catalog.minerals            # writes web/public/minerals/
"""
import argparse
import datetime
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT/'web/public'
OUT = PUBLIC/'minerals'

MOON_BASE = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_MI_mineral_maps/'
MOON_PAGE = 'https://astrogeology.usgs.gov/search/map/lunar-kaguya-multiband-imager-mosaics'
MOON_RADIUS_M = 1_737_400.0
MOON_LATITUDE_LIMIT = 50.0
#          key,              file stem,              name,                         unit,  scale
MOON_LAYERS = [
    ('feo', 'FeOWeightPercent', 'Iron oxide (FeO)', 'wt%', 1.0),
    ('olivine', 'OlivinePercent', 'Olivine', '%', 100.0),
    ('clinopyroxene', 'ClinopyroxenePercent', 'Clinopyroxene', '%', 100.0),
    ('orthopyroxene', 'OrthopyroxenePercent', 'Orthopyroxene', '%', 100.0),
    ('plagioclase', 'PlagioclasePercent', 'Plagioclase', '%', 100.0),
]
MOON_GRID = 33

MARS_WMS = ('http://ms-mars.mars.asu.edu/{layer}?SERVICE=WMS&REQUEST=GetMap&FORMAT=image/vicar&WIDTH=1440&HEIGHT=720'
            '&SRS=JMARS:4&BBOX=0,-90,360,90&STYLES=&VERSION=1.1.1&LAYERS={layer}')
MARS_PAGE = 'https://www.mars.asu.edu/data/'
MARS_PIXELS_PER_DEGREE = 4
MARS_RADIUS_M = 3_396_190.0
MARS_LAYERS = [
    ('hematite', 'TES_Hematite_numeric', 'Hematite (iron oxide)'),
    ('olivine', 'TES_Olivine_numeric', 'Olivine'),
    ('clinopyroxene', 'TES_Clinopyroxene_numeric', 'High-calcium pyroxene'),
    ('orthopyroxene', 'TES_Orthopyroxene_numeric', 'Low-calcium pyroxene'),
    ('plagioclase', 'TES_Plagioclase_numeric', 'Plagioclase'),
    ('silicates', 'TES_Glass_Clay_numeric', 'Sheet silicates and high-silica glass'),
    ('quartz', 'TES_Quartz_numeric', 'Quartz'),
]
#: Bandfield (2002): concentrations below about 0.10 are at or under the method's detection limit.
MARS_DETECTION_LIMIT_PERCENT = 10.0


def footprint_m(site):
    """Width and depth of the study area's terrain pack, metres."""
    t = site['terrain']
    return (t['columns']-1)*t['spacing_m'], (t['rows']-1)*t['spacing_m']


def window_degrees(latitude, longitude, width_m, depth_m, radius_m):
    """West, south, east, north of a width x depth footprint centred on the site, on a sphere."""
    half_lat = math.degrees(depth_m/2/radius_m)
    half_lon = math.degrees(width_m/2/(radius_m*math.cos(math.radians(latitude))))
    return longitude-half_lon, latitude-half_lat, longitude+half_lon, latitude+half_lat


def summarise(values):
    """Layer statistics over finite samples; None when there are none."""
    finite = values[np.isfinite(values)]
    if not finite.size:
        return None
    return {'min': round(float(finite.min()), 2), 'max': round(float(finite.max()), 2), 'mean': round(float(finite.mean()), 2)}


def layer_record(key, name, unit, grid):
    """One published layer: north-first rows, values rounded to 0.01, missing samples as null."""
    stats = summarise(grid)
    if stats is None:
        return None
    return {'key': key, 'name': name, 'unit': unit, **stats,
            'values': [None if not math.isfinite(v) else round(float(v), 2) for v in grid.ravel()]}


def parse_vicar(raw):
    """A single-band VICAR image as a float array, rows north-first. Raises on an unexpected layout."""
    head = raw[:64].decode('ascii', 'replace')
    if not head.startswith('LBLSIZE='):
        raise ValueError('Not a VICAR file')
    size = int(head[8:].split()[0])
    label = raw[:size].decode('ascii', 'replace')

    def field(name):
        at = label.find(name+'=')
        if at < 0:
            raise ValueError('VICAR label lacks '+name)
        return label[at+len(name)+1:].split()[0].strip("'")
    lines, samples = int(field('NL')), int(field('NS'))
    if field('FORMAT') != 'REAL' or field('ORG') != 'BSQ' or int(field('NB')) != 1:
        raise ValueError('Unexpected VICAR layout')
    order = '<' if field('REALFMT') == 'RIEEE' else '>'
    data = np.frombuffer(raw, dtype=order+'f4', count=lines*samples, offset=size)
    return data.reshape(lines, samples).astype(float)


def mars_value(grid, latitude, longitude):
    """The TES pixel containing a point. The grid spans 0-360 E, 90 N to 90 S; None where there is no data."""
    rows, columns = grid.shape
    row = min(rows-1, max(0, int((90-latitude)/180*rows)))
    column = int((longitude % 360)/360*columns) % columns
    value = grid[row, column]
    # the maps carry 0 (and occasionally negatives) where no surface spectrum was fitted: polar caps, dust
    return float(value) if math.isfinite(value) else None


#: Where the Multiband Imager has no usable observation the product holds one filler composition
#: (olivine 0.1, clinopyroxene 0.7, orthopyroxene 0.2, plagioclase 0) in every layer, with optical
#: maturity 0 and no fit criterion. Those pixels are gaps, not rock.
MOON_FILLER = {'olivine': .1, 'clinopyroxene': .7, 'orthopyroxene': .2, 'plagioclase': 0.0}


def filler_mask(native):
    """True where a native-resolution pixel is the product's gap filler rather than a measurement."""
    return np.logical_and.reduce([np.isclose(native[key], value, atol=1e-4) for key, value in MOON_FILLER.items()])


def average_to(grid, shape):
    """Area-average onto `shape`, ignoring missing samples; a cell with no samples stays missing."""
    rows, columns = grid.shape
    r = np.minimum(shape[0]-1, (np.arange(rows)*shape[0]/rows).astype(int))
    c = np.minimum(shape[1]-1, (np.arange(columns)*shape[1]/columns).astype(int))
    cell = (r[:, None]*shape[1]+c[None, :]).ravel()
    values = grid.ravel()
    ok = np.isfinite(values)
    total = np.bincount(cell[ok], weights=values[ok], minlength=shape[0]*shape[1])
    count = np.bincount(cell[ok], minlength=shape[0]*shape[1])
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(count > 0, total/count, np.nan).reshape(shape)


def moon_record(site, read_window, retrieved):
    """`read_window(stem, bounds)` returns one Kaguya layer at native resolution, north-first."""
    if abs(site['latitude']) >= MOON_LATITUDE_LIMIT:
        return None
    width, depth = footprint_m(site)
    bounds = window_degrees(site['latitude'], site['longitude'], width, depth, MOON_RADIUS_M)
    if bounds[1] < -MOON_LATITUDE_LIMIT or bounds[3] > MOON_LATITUDE_LIMIT:
        return None
    native = {key: np.asarray(read_window(stem, bounds), dtype=float) for key, stem, *_ in MOON_LAYERS}
    gap = filler_mask(native)
    measured = 1-float(gap.mean())
    layers = []
    for key, _, name, unit, scale in MOON_LAYERS:
        values = native[key].copy()
        values[gap] = np.nan
        record = layer_record(key, name, unit, average_to(values, (MOON_GRID, MOON_GRID))*scale)
        if record:
            layers.append(record)
    if not layers:
        return None
    return {
        'schema_version': 1, 'id': site['id'], 'body': 'moon', 'kind': 'map',
        'grid': {'rows': MOON_GRID, 'columns': MOON_GRID, 'order': 'north-first, west-first'},
        'extent_m': {'width': width, 'depth': depth},
        'bounds_deg': {'west': bounds[0], 'south': bounds[1], 'east': bounds[2], 'north': bounds[3]},
        'measured_share': round(measured, 3),
        'source': {
            'dataset': 'SELENE/Kaguya Multiband Imager mineral maps', 'citation': 'Lemelin et al., May 2016 release (JAXA / Univ. of Hawaii / USGS)',
            'page': MOON_PAGE, 'files': [f'{MOON_BASE}Lunar_Kaguya_MIMap_MineralDeconv_{stem}_50N50S.tif' for _, stem, *_ in MOON_LAYERS],
            'native_resolution_m': 59.2, 'retrieved': retrieved,
        },
        'layers': layers,
        'caveats': [
            'Area-averaged from about 59 m pixels onto a 33 x 33 grid over the study area.',
            'Where the instrument has no usable observation the map is left blank; nothing is filled in.',
            'Olivine, pyroxene and plagioclase are shares of those four minerals only; they are not a full rock analysis.',
            'Remote sensing of the top surface. No drilling, depth, grade or mineability information.',
        ],
    }


def mars_record(site, grids, retrieved):
    width, depth = footprint_m(site)
    layers = []
    for key, layer, name in MARS_LAYERS:
        value = mars_value(grids[layer], site['latitude'], site['longitude'])
        if value is None:
            continue
        percent = round(max(0.0, value)*100, 2)
        layers.append({'key': key, 'name': name, 'unit': '%', 'min': percent, 'max': percent, 'mean': percent, 'values': [percent],
                       'below_detection': percent < MARS_DETECTION_LIMIT_PERCENT})
    if not layers or all(l['mean'] == 0 for l in layers):
        return None
    pixel_km = 2*math.pi*MARS_RADIUS_M/360/MARS_PIXELS_PER_DEGREE/1000
    return {
        'schema_version': 1, 'id': site['id'], 'body': 'mars', 'kind': 'regional',
        'grid': {'rows': 1, 'columns': 1, 'order': 'north-first, west-first'},
        'extent_m': {'width': width, 'depth': depth},
        'source': {
            'dataset': 'MGS Thermal Emission Spectrometer mineral maps', 'citation': 'Bandfield (2002), Global mineral distributions on Mars, JGR',
            'page': MARS_PAGE, 'files': [MARS_WMS.format(layer=layer) for _, layer, _ in MARS_LAYERS],
            'native_resolution_m': round(pixel_km*1000), 'retrieved': retrieved,
        },
        'layers': layers,
        'caveats': [
            f'One TES pixel is about {pixel_km:.0f} km across at the equator, larger than the study area: each figure is a regional value, not a map of the site.',
            f'Values under about {MARS_DETECTION_LIMIT_PERCENT:.0f}% are at or below the method\'s detection limit (Bandfield 2002).',
            'Thermal-infrared remote sensing of the top surface, dust included. No depth, grade or mineability information.',
        ],
    }


def kaguya_reader():
    import rasterio
    from rasterio.windows import from_bounds
    env = rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR')
    env.__enter__()

    def read(stem, bounds):
        with rasterio.open(f'/vsicurl/{MOON_BASE}Lunar_Kaguya_MIMap_MineralDeconv_{stem}_50N50S.tif') as source:
            grid = source.read(1, window=from_bounds(*bounds, source.transform), masked=True)
        return np.ma.filled(grid.astype(float), np.nan)
    return read


def main(argv=None):
    import requests
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--output', type=Path, default=OUT)
    parser.add_argument('--only', nargs='*', help='site ids to (re)ingest; others are left as they are')
    args = parser.parse_args(argv)
    catalog = json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    targets = [s for s in catalog['sites'] if s['role'] == 'planetary_target' and s.get('terrain') and (not args.only or s['id'] in args.only)]
    retrieved = datetime.date.today().isoformat()
    args.output.mkdir(parents=True, exist_ok=True)
    read, grids = None, None
    index_path = args.output/'index.json'
    index = json.loads(index_path.read_text(encoding='utf-8')) if index_path.exists() and args.only else {'schema_version': 1, 'sites': {}, 'unavailable': {}}
    for site in targets:
        record, reason = None, ''
        if site['body'] == 'moon':
            if abs(site['latitude']) >= MOON_LATITUDE_LIMIT:
                reason = 'The Kaguya mineral maps cover 50°N to 50°S only; this site is nearer a pole.'
            else:
                read = read or kaguya_reader()
                record = moon_record(site, read, retrieved)
        elif site['body'] == 'mars':
            if grids is None:
                grids = {}
                for _, layer, _ in MARS_LAYERS:
                    response = requests.get(MARS_WMS.format(layer=layer), timeout=180)
                    response.raise_for_status()
                    grids[layer] = parse_vicar(response.content)
            record = mars_record(site, grids, retrieved)
            reason = '' if record else 'The TES mineral maps have no fitted surface spectrum at this site (dust cover, ice or high latitude).'
        index['sites'].pop(site['id'], None); index['unavailable'].pop(site['id'], None)
        if record:
            (args.output/f"{site['id']}.json").write_text(json.dumps(record, separators=(',', ':'))+'\n', encoding='utf-8')
            index['sites'][site['id']] = record['kind']
            print(f"{site['id']}: {record['kind']}, " + ', '.join(f"{l['name']} {l['mean']}{l['unit']}" for l in record['layers']))
        else:
            index['unavailable'][site['id']] = reason or 'No mineral value was retrieved for this site.'
            print(f"{site['id']}: unavailable. {index['unavailable'][site['id']]}")
    index['sites'] = dict(sorted(index['sites'].items())); index['unavailable'] = dict(sorted(index['unavailable'].items()))
    index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
