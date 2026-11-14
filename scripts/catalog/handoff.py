"""Generate the Earth location handoff from the production catalog, offline."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    catalog = json.loads((ROOT / 'web/public/sites.json').read_text(encoding='utf-8'))
    by_id = {site['id']: site for site in catalog['sites']}
    lines = [
        '# Earth location handoff', '',
        'Generated from `web/public/sites.json` with `python -m scripts.catalog.handoff`.', '',
        f"{sum(s['body'] == 'earth' and s.get('terrain') is not None for s in catalog['sites'])} Earth locations have production terrain packs, including Haughton and Qaidam.",
        'These are selected study windows; they do not cover entire craters or basins.', '',
        'Pairings below are proposed engineering comparisons, not validated geological',
        'equivalence, landing safety, or mission suitability. The numerical terrain scores',
        'are reproducible descriptors, not independently validated similarity assessments.', '',
        'Shared terrain contract: elevation in metres; little-endian float32, row-major,',
        'north-first and west-first. Earth coordinates are WGS84 longitude/latitude;',
        'bbox order is west, south, east, north. CRS and vertical datum are in each manifest.',
        'Physics conversion flips rows once to south-first. Missing or nonfinite samples',
        'are rejected by the viewer; failed packs remain disabled, without synthetic fill.',
        'Earth grids contain 161 x 161 samples at 30 m output spacing (4.8 km between',
        'outer sample centres). Copernicus native sampling is approximately 1 arc-second,',
        'varying with latitude; resampling does not improve source detail. These are DSMs,',
        'not guaranteed bare-earth surfaces or rock-scale collision geometry.', '',
        'Use `python -m scripts.catalog.validate` and `node scripts/catalog/check-consumers.mjs`',
        'to verify assets and provenance before handoff. See [integration guide](SITE_CATALOG.md).', '',
    ]
    for site in catalog['sites']:
        if site['body'] != 'earth':
            continue
        terrain = site['terrain']
        lines += [f"## {site['name']} (`{site['id']}`)", '',
                  f"Centre (longitude, latitude): {site['longitude']}, {site['latitude']}.",
                  f"Study bbox: `{site['bbox']}`. {site['footprint_method']}", '']
        if terrain:
            manifest_path = 'web/public' + terrain['manifest_url']
            manifest = json.loads((ROOT / manifest_path).read_text(encoding='utf-8'))
            license_url = manifest.get('license_url') or manifest['source'].get('license_url')
            if license_url and license_url.startswith('/'):
                license_url = '../web/public' + license_url
            lines += [f"Terrain: [manifest](../{manifest_path}); "
                      f"[elevation](../{Path(manifest_path).parent.as_posix()}/elevation.f32).",
                      f"Source: [Copernicus GLO-30 tile]({terrain['source_url']}); "
                      f"[licence]({license_url}). Manifest and elevation SHA-256 checksums are in the catalog.", '']
        else:
            lines += ['Unavailable: no production terrain pack.', '']
        lines += [f"Interpretation: {site['description']} [Evidence]({site['evidence_url']}).", '']
        for pair in catalog['pairings']:
            if pair['earth_id'] != site['id']:
                continue
            target = by_id[pair['planetary_id']]
            lines += [f"Proposed pairing: **{target['name']}** (`{target['id']}`). "
                      f"Target context and limitations: {target['description']} "
                      f"[Target evidence]({target['evidence_url']}).", '']
        if not site['matches']:
            lines += ['Proposed pairing: deferred pending selection of an appropriate planetary study footprint; no match score is claimed.', '']
        for target_id, notes in site.get('pairing_notes', {}).items():
            lines += [f"Pair-specific explanation ({target_id}):", 'Matches: ' + ' '.join(notes['matches']), 'Differences: ' + ' '.join(notes['differences']), '']
        lines += ['Limitations: ' + ' '.join(site['limitations']), '',
                  'Unknown feature measurements: ' + ', '.join(
                      key for key, value in site.get('feature_measurements', {}).items()
                      if value.get('value') is None) + '.', '',
                  'Friction, cohesion and bulk density are not inferred from substrate. '
                  'Environmental values retain their modeled/observed status, resolution and '
                  'time coverage in the catalog; annual wind magnitudes are not wind vectors.', '']
    (ROOT / 'docs/LOCATION_HANDOFF.md').write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
