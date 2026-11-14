#!/usr/bin/env python3
"""Fetch pinned-period NASA POWER data and build offline simulation profiles.

Usage: python scripts/environment/build_profiles.py [--start-year 2015 --end-year 2024]
Raw responses are cached under ignored data/raw/environment. No NASA key required.
"""
from __future__ import annotations
import argparse
import calendar
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request
import numpy as np
try:
    from .soil import fetch_soil
except ImportError:  # Direct script invocation
    from soil import fetch_soil

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'data/raw/environment'
OUT = ROOT / 'data/environment'
PARAMS = ['WS10M', 'WD10M', 'T2M', 'RH2M', 'PS', 'PRECTOTCORR']
UNITS = {'WS10M': 'm/s', 'WD10M': 'Degrees', 'T2M': 'C', 'RH2M': '%', 'PS': 'kPa', 'PRECTOTCORR': 'mm/hour'}
FIELDS = ['wind_speed_m_s', 'wind_from_deg', 'air_temperature_k', 'relative_humidity_pct', 'pressure_pa', 'precipitation_mm_h']
FIELD_UNITS = dict(zip(FIELDS, ['m/s', 'degree', 'K', '%', 'Pa', 'mm/h']))
FIELD_UNITS.update(air_density_kg_m3='kg/m3', wind_east_m_s='m/s', wind_north_m_s='m/s')
SEASONS = {'DJF': [12, 1, 2], 'MAM': [3, 4, 5], 'JJA': [6, 7, 8], 'SON': [9, 10, 11]}


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')


def fetch(url):
    """Cache exact response bytes by request hash; never cache API error bodies."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json.gz')
    if path.exists():
        raw = gzip.decompress(path.read_bytes())
    else:
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=120) as response:
                    raw = response.read()
                parsed = json.loads(raw)
                if 'parameter' not in parsed.get('properties', {}):
                    raise ValueError(f'Missing POWER data in {url}')
                path.write_bytes(gzip.compress(raw, mtime=0))
                break
            except urllib.error.HTTPError as error:
                if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                    raise RuntimeError(f'POWER HTTP {error.code}: {error.read().decode()[:500]}') from error
                time.sleep(2 ** attempt)
            except (TimeoutError, urllib.error.URLError):
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
    return json.loads(raw), {'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'cache_file': str(path.relative_to(ROOT))}


def request_url(site, start, end, temporal):
    parameters = PARAMS if temporal == 'hourly' else ['ALLSKY_SRF_ALB', 'ALLSKY_SFC_SW_DWN']
    query = dict(parameters=','.join(parameters), community='RE', longitude=site['longitude'], latitude=site['latitude'], start=start, end=end, format='JSON')
    if temporal == 'hourly':
        query['time-standard'] = 'UTC'
    return f'https://power.larc.nasa.gov/api/temporal/{temporal}/point?' + urllib.parse.urlencode(query)


def valid(value, fill):
    return isinstance(value, (float, int)) and math.isfinite(value) and value != fill


def density(temp_k, pressure_pa, rh):
    """Ideal moist air, Tetens saturation over water. Approximation, not observation."""
    if any(x is None for x in [temp_k, pressure_pa, rh]):
        return None
    tc = temp_k - 273.15
    vapor = rh / 100 * 610.78 * math.exp(17.2694 * tc / (tc + 237.3))
    return (pressure_pa - vapor) / (287.05 * temp_k) + vapor / (461.5 * temp_k)


def parse_hourly(payload, year):
    for parameter, unit in UNITS.items():
        actual = payload['parameters'][parameter]['units']
        if actual != unit:
            raise ValueError(f'Unexpected units for {parameter}: {actual!r}, expected {unit!r}')
    if payload['header']['time_standard'] != 'UTC':
        raise ValueError('Hourly data must be UTC')
    series = payload['properties']['parameter']
    fill = payload['header']['fill_value']
    keys = sorted(set().union(*(v.keys() for v in series.values())))
    result = []
    for key in keys:
        date = datetime.strptime(key, '%Y%m%d%H')
        if date.year != year:
            raise ValueError('Unexpected year in response')
        row = {'timestamp_utc': date.isoformat() + 'Z', 'month': date.month, 'hour_utc': date.hour}
        for parameter, field in zip(PARAMS, FIELDS):
            value = series[parameter].get(key)
            row[field] = float(value) if valid(value, fill) else None
        if row['air_temperature_k'] is not None:
            row['air_temperature_k'] += 273.15
        if row['pressure_pa'] is not None:
            row['pressure_pa'] *= 1000
        for field, lo, hi in [('wind_speed_m_s', 0, 200), ('wind_from_deg', 0, 360), ('air_temperature_k', 150, 350), ('relative_humidity_pct', 0, 100), ('pressure_pa', 1000, 120000), ('precipitation_mm_h', 0, 1000)]:
            value = row[field]
            if value is not None and not lo <= value <= hi:
                raise ValueError(f'Out of bounds {field}: {value}')
        speed, direction = row['wind_speed_m_s'], row['wind_from_deg']
        row['wind_east_m_s'] = -speed * math.sin(math.radians(direction)) if speed is not None and direction is not None else None
        row['wind_north_m_s'] = -speed * math.cos(math.radians(direction)) if speed is not None and direction is not None else None
        row['air_density_kg_m3'] = density(row['air_temperature_k'], row['pressure_pa'], row['relative_humidity_pct'])
        result.append(row)
    return result


def stats(values, expected, units):
    a = np.asarray([v for v in values if v is not None], dtype=float)
    result = {'units': units, 'valid_count': len(a), 'expected_count': expected, 'coverage_fraction': len(a) / expected if expected else 0}
    if not len(a):
        return dict(result, mean=None, min=None, max=None, p05=None, p50=None, p95=None, stddev=None)
    return dict(result, mean=float(a.mean()), min=float(a.min()), max=float(a.max()), p05=float(np.percentile(a, 5)), p50=float(np.percentile(a, 50)), p95=float(np.percentile(a, 95)), stddev=float(a.std()))


def sample(row):
    return {k: v for k, v in row.items() if k not in ('month', 'hour_utc')}


def summarize(rows, expected, longitude):
    metrics = {field: stats([r[field] for r in rows], expected, unit) for field, unit in FIELD_UNITS.items() if field != 'wind_from_deg'}
    # Averaging directions arithmetically fails at north (359 and 1 degrees).
    east, north = metrics['wind_east_m_s']['mean'], metrics['wind_north_m_s']['mean']
    mean_direction = math.degrees(math.atan2(-east, -north)) % 360 if east is not None and north is not None and math.hypot(east, north) > 1e-8 else None
    complete = [r for r in rows if all(r[k] is not None for k in FIELDS)]
    scenarios = {'typical': None, 'high_wind': None}
    if complete:
        fields = ['wind_speed_m_s', 'air_temperature_k', 'pressure_pa', 'relative_humidity_pct']
        a = np.asarray([[r[k] for k in fields] for r in complete])
        median = np.median(a, axis=0)
        spread = np.maximum(a.std(axis=0), 1e-6)
        typical = complete[int(np.argmin(np.sum(((a - median) / spread) ** 2, axis=1)))]
        p95 = float(np.percentile(a[:, 0], 95))
        adverse = min(complete, key=lambda r: abs(r['wind_speed_m_s'] - p95))
        scenarios = {'typical': sample(typical), 'high_wind': sample(adverse)}
    diurnal = []
    for hour in range(24):
        subset = [r for r in rows if int((r['hour_utc'] + longitude / 15) % 24) == hour]
        def mean(field):
            values = [r[field] for r in subset if r[field] is not None]
            return float(np.mean(values)) if values else None
        diurnal.append({'local_mean_solar_hour': hour, 'record_count': len(subset), 'air_temperature_k': mean('air_temperature_k'), 'wind_speed_m_s': mean('wind_speed_m_s')})
    return {'statistics': metrics, 'vector_mean_wind_from_deg': mean_direction, 'scenarios': scenarios, 'diurnal': diurnal}


def radiation_summary(payload, months, years):
    p = payload['properties']['parameter']
    if payload['parameters']['ALLSKY_SRF_ALB']['units'] != 'dimensionless' or payload['parameters']['ALLSKY_SFC_SW_DWN']['units'] != 'kW-hr/m^2/day':
        raise ValueError('Unexpected POWER radiation units')
    fill = payload['header']['fill_value']
    result = {}
    for parameter, field, unit, factor in [('ALLSKY_SRF_ALB', 'albedo', '1', 1), ('ALLSKY_SFC_SW_DWN', 'solar_daily_mean_w_m2', 'W/m2', 1000 / 24)]:
        values = [p[parameter].get(f'{year}{month:02d}') for year in years for month in months]
        values = [v * factor if valid(v, fill) else None for v in values]
        if parameter == 'ALLSKY_SRF_ALB' and any(v is not None and not 0 <= v <= 1 for v in values):
            raise ValueError('Albedo outside [0,1]')
        result[field] = stats(values, len(months) * len(years), unit)
    return result


def build_site(site, years):
    records, sources = [], []
    for year in years:
        payload, provenance = fetch(request_url(site, f'{year}0101', f'{year}1231', 'hourly'))
        records.extend(parse_hourly(payload, year))
        sources.append(dict(provenance, kind='hourly_meteorology', header=payload['header'], units=payload['parameters']))
        print(f'{site["id"]}: {year} hourly complete', flush=True)
    radiation, provenance = fetch(request_url(site, years[0], years[-1], 'monthly'))
    sources.append(dict(provenance, kind='monthly_radiation', header=radiation['header'], units=radiation['parameters']))
    groups = {str(month): [month] for month in range(1, 13)} | SEASONS
    summaries = {}
    for key, months in groups.items():
        subset = [r for r in records if r['month'] in months]
        expected = sum(calendar.monthrange(y, m)[1] * 24 for y in years for m in months)
        summaries[key] = dict(summarize(subset, expected, site['longitude']), radiation=radiation_summary(radiation, months, years))
    soil_survey = fetch_soil(site, CACHE)
    print(f'{site["id"]}: soil {soil_survey["status"]}', flush=True)
    profile = {
        'schema_version': '1.0.0', 'site': site, 'generated_at': datetime.now(timezone.utc).isoformat(),
        'baseline': {'start_year': years[0], 'end_year': years[-1], 'description': 'Ten-year seasonal baseline (default), not a 30-year climate normal', 'hourly_time_standard': 'UTC', 'diurnal_time_standard': 'approximate local mean solar time, floor(UTC hour + longitude/15)', 'radiation_aggregation': 'equal-weight monthly means across selected months/years; not instantaneous or day-weighted seasonal energy'},
        'spatial_support': {'meteorology': 'Regional source grid (MERRA-2 nominal 0.5 latitude x 0.625 longitude degrees; inspect source headers for changes), not crater/pad wind', 'radiation': 'CERES SYN1deg regional 1-degree product; not a local material albedo measurement', 'point': 'representative request coordinate; no site-wide or landing-pad survey'},
        'evidence': {'weather': 'modelled', 'albedo': 'satellite-derived regional product', 'air_density': 'derived: ideal moist air with Tetens saturation over water; approximate in extreme cold', 'surface_materials': 'literature context'},
        'months': {str(m): summaries[str(m)] for m in range(1, 13)}, 'seasons': {k: summaries[k] for k in SEASONS},
        'soil': {'status': 'survey_available' if soil_survey['status'] == 'available' else 'literature_context_only', 'survey': soil_survey, 'surface_materials': site['surface_materials'], 'texture_fractions': None, 'bulk_density_kg_m3': None, 'cohesion_pa': None, 'friction_angle_deg': None, 'bearing_capacity_pa': None, 'soil_moisture_m3_m3': None, 'snow_depth_m': None, 'active_layer_depth_m': None},
        'unavailable': ['local_gusts', 'turbulence', 'pad_scale_obstacles', 'contact_friction', 'ground_bearing_strength', 'surface_temperature', 'thermal_conductivity', 'specific_heat', 'local_surface_albedo', 'dust_erosion_threshold'],
        'limitations': ['High-wind scenario is a real modelled hour near the 95th percentile of hourly speeds, NOT a gust or certified design extreme.', 'Each scenario preserves joint weather values from one hour; monthly radiation is separate context, never attached as instantaneous scenario flux.', 'Regional albedo can mix bright dunes/salt/snow with surrounding land; use site-resolved data for detailed heating.', 'Missing ground properties are null. Do not silently substitute soil type for measured contact physics.', 'No universal safe-landing threshold is supplied. Vehicle and equipment parameters are required.'],
        'sources': sources,
    }
    dump(OUT / f'{site["id"]}.json', profile)
    return {'id': site['id'], 'name': site['name'], 'file': f'{site["id"]}.json', 'sha256': hashlib.sha256((OUT / f'{site["id"]}.json').read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start-year', type=int, default=2015)
    parser.add_argument('--end-year', type=int, default=2024)
    parser.add_argument('--site', help='Build one site; full catalog is updated only for all-site builds')
    args = parser.parse_args()
    if not 2001 <= args.start_year <= args.end_year < datetime.now().year:
        parser.error('Choose complete years since 2001')
    sites = json.loads((OUT / 'sites.json').read_text())['sites']
    if args.site:
        sites = [s for s in sites if s['id'] == args.site]
        if not sites:
            parser.error('Unknown site')
    years = list(range(args.start_year, args.end_year + 1))
    results = []
    # NASA requests are limited to three concurrent sites; years per site are sequential.
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(build_site, s, years) for s in sites]
        for future in as_completed(futures):
            results.append(future.result())
    if not args.site:
        dump(OUT / 'catalog.json', {'schema_version': '1.0.0', 'baseline': [args.start_year, args.end_year], 'sites': sorted(results, key=lambda x: x['id'])})
    print('All requested profiles built.', flush=True)

if __name__ == '__main__':
    main()
