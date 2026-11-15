"""Evaluate accessible alternatives without replacing reviewed catalog measurements.

Run python -m scripts.catalog.assess_sources [--offline]. Cached responses are
checksummed; reports separate processed alternatives from product discovery.
"""
import argparse
from datetime import date, datetime, timezone
import hashlib
import json
import math
from pathlib import Path

import requests

from .build import CACHE, PUBLIC, ROOT, dump, sha

EPQS = 'https://epqs.nationalmap.gov/v1/json'
ERA5 = 'https://archive-api.open-meteo.com/v1/archive'
STAC = 'https://stac.astrogeology.usgs.gov/api/search'


def fetch(url, params, offline):
    key = hashlib.sha256(json.dumps([url, params], sort_keys=True).encode()).hexdigest()
    folder = CACHE/'source-assessment'
    path, receipt_path = folder/f'{key}.json', folder/f'{key}.receipt.json'
    if not path.exists():
        if offline:
            raise FileNotFoundError(f'No cached response for {url}: {key}')
        response = requests.get(url, params=params, timeout=(15, 60))
        response.raise_for_status()
        data = response.json()
        dump(path, data)
        dump(receipt_path, {'request_url': response.url, 'parameters': params,
            'retrieved_utc': datetime.now(timezone.utc).isoformat(), 'sha256': sha(path)})
    receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
    if sha(path) != receipt['sha256']:
        raise ValueError('Source-assessment cache checksum mismatch')
    return json.loads(path.read_text(encoding='utf-8')), receipt


def weather_summary(data):
    units = data['daily_units']
    if units['temperature_2m_mean'] != '\u00b0C' or units['wind_speed_10m_mean'] != 'm/s':
        raise ValueError('Unexpected ERA5 units')
    times = data['daily']['time']
    expected = (date(2025, 1, 1)-date(2024, 1, 1)).days
    if len(times) != expected or len(set(times)) != expected or times != sorted(times):
        raise ValueError('ERA5 response does not cover one complete, unique 2024 daily axis')
    if times[0] != '2024-01-01' or times[-1] != '2024-12-31':
        raise ValueError('Unexpected ERA5 time coverage')
    out = {}
    for key, unit in [('temperature_2m_mean', 'degC'), ('wind_speed_10m_mean', 'm/s')]:
        values = data['daily'][key]
        if len(values) != len(times):
            raise ValueError('ERA5 dates and values have different lengths')
        valid = [float(v) for v in values if v is not None and math.isfinite(v)]
        out[key] = {'value': sum(valid)/len(valid) if valid else None, 'unit': unit,
            'status': 'modeled' if valid else 'unknown', 'sample_count': len(valid),
            'reason': None if valid else 'No finite daily observations in response',
            'method': 'Arithmetic mean of available daily mean values; missing days excluded.'}
    return out


def assess(site, offline):
    if site['body'] == 'earth':
        data, receipt = fetch(ERA5, dict(latitude=site['latitude'], longitude=site['longitude'],
            start_date='2024-01-01', end_date='2024-12-31',
            daily='temperature_2m_mean,wind_speed_10m_mean', models='era5',
            wind_speed_unit='ms', timezone='GMT', elevation='nan'), offline)
        result = {'site_id': site['id'], 'era5': {
            'status': 'processed_alternative_not_promoted', 'source': receipt,
            'product_id': 'ERA5 via Open-Meteo historical API', 'time_coverage': '2024-01-01/2024-12-31 UTC',
            'native_resolution_degrees': 0.25,
            'returned_grid_point': {k: data[k] for k in ('latitude', 'longitude', 'elevation')},
            'conditions': weather_summary(data),
            'caveat': 'Pinned ERA5 model; elevation downscaling disabled. Finer regional support than POWER meteorology does not demonstrate local accuracy. No skin-temperature or albedo substitution.',
            'license_url': 'https://open-meteo.com/en/terms',
            'attribution': 'Open-Meteo; Copernicus Climate Change Service / ECMWF ERA5.'}}
        if site['region'].endswith(', US'):
            data, receipt = fetch(EPQS, dict(x=site['longitude'], y=site['latitude'],
                wkid=4326, units='Meters', includeDate=True), offline)
            value = float(data['value'])
            valid = math.isfinite(value) and value != -1000000
            result['usgs_elevation_point'] = {'status': 'derived' if valid else 'unknown',
                'value': value if valid else None, 'unit': 'm', 'source': receipt,
                'reason': None if valid else 'EPQS returned nodata',
                'resolution_m': data.get('resolution'), 'raster_id': data.get('rasterId'),
                'acquisition_date': data.get('attributes', {}).get('AcquisitionDate'),
                'method': 'USGS EPQS interpolated 3DEP elevation at the catalog centre.',
                'caveat': 'One point, not a terrain pack or validation. 3DEP generally uses NAVD88 (regional exceptions); Copernicus uses EGM2008. Datum harmonization and matched bare-earth/surface definitions are required before error statistics.'}
        return result
    data, receipt = fetch(STAC, dict(collections='mro_hirise_socet_dtms',
        bbox=','.join(str(v) for v in site['bbox']), limit=20), offline)
    products = []
    for feature in sorted(data['features'], key=lambda f: f['id']):
        properties = feature['properties']
        products.append({'id': feature['id'], 'bbox': feature['bbox'],
            'gsd_m': properties.get('gsd'), 'license': properties.get('license'),
            'assets': {k: a['href'] for k, a in feature['assets'].items()
                       if k in ('dtm', 'dtm_label', 'fom')},
            'metadata_datetime': properties.get('datetime'),
            'time_caveat': 'STAC timestamps require checking against the source PDS labels; not adopted as acquisition dates.'})
    return {'site_id': site['id'], 'hirise': {'status': 'discovery_only', 'source': receipt,
        'number_matched': data.get('numberMatched'), 'products': products,
        'truncated': data['numberMatched'] > len(products) if isinstance(data.get('numberMatched'), int)
                     else any(link['rel'] == 'next' for link in data.get('links', [])),
        'caveat': 'Bounding-box intersection does not guarantee full study-footprint coverage or valid pixels. No raster is ingested by this search. Inspect DTM, Figure of Merit, PDS dates and scale/offset before promotion.'}}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--body', choices=['earth','mars'])
    parser.add_argument('--output', type=Path, default=ROOT/'data/source-assessment.json')
    args = parser.parse_args(argv)
    catalog = json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    results = []
    for site in catalog['sites']:
        if site['body'] == 'moon' or args.body and site['body'] != args.body:
            continue
        print('Assessing', site['id'], flush=True)
        try:
            results.append(assess(site, args.offline))
        except (requests.RequestException, ValueError, KeyError, OSError) as exc:
            results.append({'site_id': site['id'], 'status': 'failed', 'reason': str(exc)})
    dump(args.output, {'method_version': '1.0.0',
        'scope': 'Alternative-data assessment; does not change catalog conditions or similarity.',
        'sites': results})
    failures = sum(s.get('status') == 'failed' for s in results)
    print(f'{len(results)} sites assessed; {failures} failures')
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
