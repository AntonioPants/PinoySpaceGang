"""Generate a per-location data-gap report from actual catalog/profile records."""
import json
from .build import ROOT, PUBLIC, dump, sha

PROFILE_IDS = {
    'kilbourne-hole-v1': 'kilbourne_hole', 'meteor-crater': 'meteor_crater',
    'amboy': 'amboy_crater', 'badwater': 'badwater_basin',
    'white-sands': 'white_sands', 'barrow-observatory': 'utqiagvik_beo',
}


def main():
    catalog = json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    profiles = ROOT/'data/environment'
    receipts = {s['id']: s for s in json.loads((profiles/'catalog.json').read_text())['sites']}
    rows = []
    lines = ['# Per-location data coverage', '',
        'Generated with `python -m scripts.catalog.coverage`. Values remain in `web/public/sites.json`; this is a coverage inventory, not a second science catalog.', '',
        '| Site | Known condition records | Unknown / inapplicable | Seasonal weather | Missing landform measurements |',
        '|---|---:|---|---|---|']
    for site in catalog['sites']:
        conditions = site['conditions']
        known = [k for k, v in conditions.items() if v['value'] is not None]
        unknown = [k for k, v in conditions.items() if v['status'] == 'unknown']
        inapplicable = [k for k, v in conditions.items() if v['status'] == 'not_applicable']
        features = [k for k, v in site.get('feature_measurements', {}).items() if v['value'] is None]
        seasonal = None
        pid = PROFILE_IDS.get(site['id'])
        if pid:
            receipt = receipts[pid]
            path = profiles/receipt['file']
            if sha(path) != receipt['sha256']:
                raise ValueError(f'{pid}: seasonal profile checksum mismatch')
            profile = json.loads(path.read_text(encoding='utf-8'))
            seasonal = {'file': path.relative_to(ROOT).as_posix(), 'sha256': receipt['sha256'],
                'baseline': profile['baseline'], 'sampling_coordinates': {
                    k: profile['site'][k] for k in ('longitude', 'latitude')},
                'caveat': 'Representative regional sampling point may differ from terrain centre. Not landing-pad weather.'}
        rows.append({'id': site['id'], 'known_conditions': known, 'unknown_conditions': unknown,
            'not_applicable_conditions': inapplicable, 'missing_feature_measurements': features,
            'seasonal_profile': seasonal,
            'seasonal_reason': None if seasonal else 'No separate seasonal profile ingested; inspect catalog conditions for available annual or thermal-bin context.'})
        season = f"{seasonal['baseline']['start_year']}-{seasonal['baseline']['end_year']} regional" if seasonal else 'not ingested'
        lines.append(f"| {site['id']} | {len(known)} | {len(unknown)} unknown; {len(inapplicable)} N/A | {season} | {', '.join(features) or 'No dedicated fields defined'} |")
    lines += ['', '## Interpretation and remaining work', '',
        f"- {sum(s['body']=='earth' and s['conditions'].get('air_temperature_2m',{}).get('value') is not None for s in catalog['sites'])} Earth records contain air-temperature context. Registered scan windows without weather ingestion retain explicit unknowns. Only six have separate 2015-2024 seasonal weather profiles; annual means do not provide seasonal wind vectors.",
        '- All four lunar areas have Diviner cumulative bolometric-temperature bins (2009-2015). These are not instantaneous ground temperatures or footprint extrema. Lunar atmospheric wind and air temperature are physically inapplicable and hidden in the Moon comparison display.',
        '- Mars weather/albedo remain unknown in this catalog. Earth weather must not be silently applied to Mars.',
        '- Friction, cohesion and bulk density remain unknown for every site. Soil-survey context, basalt labels and DEM roughness do not establish contact mechanics. Vehicle/contact defaults belong in explicit simulation settings.',
        '- Unknown does not necessarily mean access blocked: landform boundaries, dune migration, active-layer depth and strength require a suitable scientific method and spatially matched measurements. Obtain those before replacing nulls.',
        '- Earthdata authenticated products and RCM access remain separate acquisition work; see DATA_SOURCES_AND_GAPS.md for provider-specific steps. No new radar or MODIS ingestion is claimed.',
        '- Amboy cone dimensions and Kilbourne short/long dimensions are approximate literature values. They are separate from crop statistics and are not included in similarity scoring.',
        '- Earth sites without a seasonal profile in the table still need one if seasonal scenarios are required. The four new US sites have 2024 annual context, not ten-year seasonal baselines. Do not replace an existing ten-year baseline with a short demonstration fetch.',
        '- Empty feature lists mean no feature-specific extraction is defined, not that the site is scientifically complete. Pairings and engineering scores remain unvalidated.', '']
    dump(ROOT/'data/catalog-coverage.json', {'schema_version': '1.0.0', 'sites': rows})
    (ROOT/'docs/DATA_COVERAGE.md').write_text('\n'.join(lines), encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
