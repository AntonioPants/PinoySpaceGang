"""Reproducibility and window-sensitivity audit, not ground-truth accuracy."""
import hashlib
import json
from pathlib import Path

import numpy as np
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling
from scipy.ndimage import uniform_filter

from .scoring import compare, FEATURES

VERSION = '1.0.0'
OFFSETS = [(0, 0), (-250, 0), (250, 0), (0, -250), (0, 250)]


def sample_features(z, spacing, offset=(0, 0)):
    """Same 4 km support and 1 km cells as catalog v1, with optional metre shift."""
    width, height = z.shape[1]*spacing, z.shape[0]*spacing
    left = (width-4000)/2 + offset[0]
    top = (height-4000)/2 - offset[1]
    if min(left, top) < 0 or left+4000 > width or top+4000 > height:
        return {}
    out = np.full((4, 4), np.nan, dtype='float32')
    # Local metric coordinates only: no Earth-to-planet CRS transformation.
    reproject(z, out, src_transform=from_origin(0, 0, spacing, spacing),
              dst_transform=from_origin(left, -top, 1000, 1000),
              src_crs='EPSG:3857', dst_crs='EPSG:3857',
              src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.average)
    if not np.isfinite(out).all():
        return {}
    values = out.astype('float64')
    dy, dx = np.gradient(values, 1000)
    rms = np.sqrt(np.maximum(0, uniform_filter(values**2, 3)-uniform_filter(values, 3)**2))[1:-1, 1:-1]
    numbers = {'slope_mean': (float(np.degrees(np.arctan(np.hypot(dx,dy))).mean()), 'deg'),
               'roughness_rms': (float(rms.mean()), 'm'), 'relief': (float(np.ptp(out)), 'm')}
    return {key: {'value': value, 'unit': unit, 'status': 'derived', 'analysis_resolution_m': 1000}
            for key, (value, unit) in numbers.items()}


def site_samples(site, public):
    terrain = site.get('terrain')
    if not terrain:
        return None
    path = public / terrain['manifest_url'].lstrip('/')
    if not path.resolve().is_relative_to((public/'terrain').resolve()):
        raise ValueError('Terrain path escapes public terrain directory')
    raw = (path.parent/'elevation.f32').read_bytes()
    if hashlib.sha256(raw).hexdigest() != terrain['elevation_sha256']:
        raise ValueError(f'{site["id"]}: elevation checksum mismatch')
    z = np.frombuffer(raw, dtype='<f4').reshape(terrain['rows'], terrain['columns'])
    native = terrain.get('native_resolution_m_approx')
    spacing = terrain['spacing_m']
    if (not np.isfinite(z).all() or terrain['row_order'] != 'north_to_south'
            or terrain['column_order'] != 'west_to_east' or not np.isfinite(spacing) or spacing <= 0):
        raise ValueError(f'{site["id"]}: invalid grid convention or samples')
    if native is None or not np.isfinite(native) or native <= 0 or max(native, spacing) > 1000:
        return None
    samples = [sample_features(z, spacing, offset) for offset in OFFSETS]
    return {'samples': samples, 'source_url': terrain['source_url'],
            'elevation_sha256': terrain['elevation_sha256'],
            'native_posting_m_approx': native, 'pack_spacing_m': spacing,
            'footprint_bbox': site['bbox']}


def audit_pair(earth, planet, a, b):
    base_a, base_b = (a['samples'][0] if a else {}), (b['samples'][0] if b else {})
    result = compare(base_a, base_b)
    differences = []
    for key, (weight, scale) in FEATURES.items():
        x, y = base_a.get(key), base_b.get(key)
        differences.append({'feature': key, 'earth_value': x['value'] if x else None,
            'planetary_value': y['value'] if y else None, 'unit': x['unit'] if x else None,
            'absolute_difference': abs(x['value']-y['value']) if x and y else None,
            'weight': weight, 'fixed_difference_scale': scale})
    scores = [compare(x,y)['terrain_score'] for x in (a['samples'] if a else [])
              for y in (b['samples'] if b else [])]
    scores = [score for score in scores if score is not None]
    complete = len(scores) == 25
    span = round(max(scores)-min(scores),6) if complete else None
    reproduced = result['terrain_score'] is not None and all(
        base.get(key, {}).get('value') is not None
        and site.get('comparison_features', {}).get(key, {}).get('value') is not None
        and np.isclose(base[key]['value'], site['comparison_features'][key]['value'], rtol=1e-6, atol=1e-6)
        for site, base in [(earth,base_a),(planet,base_b)] for key in FEATURES)
    environment = []
    for key in ('wind_speed_10m','air_temperature_2m','surface_temperature','albedo','friction','cohesion','bulk_density'):
        x, y = earth['conditions'].get(key,{}), planet['conditions'].get(key,{})
        status = 'not_applicable' if 'not_applicable' in (x.get('status'),y.get('status')) else 'insufficient_compatible_evidence'
        environment.append({'property': key, 'earth_status': x.get('status','unknown'),
            'planetary_status': y.get('status','unknown'), 'comparison_status': status,
            'reason': 'No equivalent atmospheric quantity on an airless body.' if status=='not_applicable' else
            'No validated matched product definition, spatial support and time coverage; no numerical environmental score.'})
    return {'method_version': VERSION, 'status': 'reproduced_regional_comparison' if reproduced else 'insufficient_or_inconsistent_data',
        'validated_accuracy_percent': None,
        'accuracy_reason': 'No independent ground-truth matched-landform benchmark or site-specific DEM error model. Similarity is not accuracy.',
        'recomputed_terrain_score': result['terrain_score'], 'coverage': result['coverage'],
        'catalog_features_reproduced': bool(reproduced), 'feature_differences': differences,
        'analysis': {'window_m': 4000, 'cell_size_m': 1000, 'roughness_support_m': 3000,
            'cell_count': 16, 'roughness_interior_window_count': 4,
            'caveat': 'Very small regional sample; roughness includes slope. Equal grid spacing does not equal native resolving power. Absolute elevation is not compared across different vertical datums.'},
        'window_sensitivity': {'offsets_east_north_m': [list(o) for o in OFFSETS], 'valid_comparisons': len(scores),
            'score_min': min(scores) if complete else None, 'score_max': max(scores) if complete else None,
            'score_span': span, 'assessment': 'insufficient_data' if span is None else 'sensitive' if span>0.10 else 'limited_change',
            'reason': '25 independent combinations of five window positions. A span over 0.10 flags sensitivity by an engineering rule; this is not a confidence interval or an accuracy estimate.'},
        'geology': {'earth_morphology': earth['morphology'], 'planetary_morphology': planet['morphology'],
            'earth_substrate': earth['substrate'], 'planetary_substrate': planet['substrate'],
            'assessment': 'interpretation_only', 'reason': 'Use the pair-specific matches and differences. Matching category names do not establish matching origin, grain size or mechanics.'},
        'environment_checks': environment,
        'sources': {'earth': {k:v for k,v in a.items() if k!='samples'} if a else None,
                    'planetary': {k:v for k,v in b.items() if k!='samples'} if b else None}}


def attach_accuracy(catalog, public):
    public = Path(public)
    byid = {s['id']:s for s in catalog['sites']}
    used = {p[k] for p in catalog['pairings'] for k in ('earth_id','planetary_id')}
    samples = {sid:site_samples(byid[sid],public) for sid in sorted(used)}
    for pair in catalog['pairings']:
        a,b=pair['earth_id'],pair['planetary_id']
        pair['accuracy_check'] = audit_pair(byid[a],byid[b],samples[a],samples[b])
    return catalog


def main():
    from .build import PUBLIC, ROOT
    catalog = json.loads((PUBLIC/'sites.json').read_text(encoding='utf-8'))
    attach_accuracy(catalog,PUBLIC)
    lines = ['# Earth–planetary pairing audit', '',
        'Rebuild with `python -m scripts.catalog.refresh_metadata`, then `python -m scripts.catalog.accuracy`.', '',
        'Scores below are regional terrain similarity on a 0–1 scale, **not accuracy percentages**. There is no independent ground-truth validation. See PAIRING_ACCURACY.md for the method and limitations.', '',
        '| Earth analog | Target | Recomputed score | Shifted-window range | Features reproduce |',
        '|---|---|---:|---|---|']
    for pair in catalog['pairings']:
        a=pair['accuracy_check']; s=a['window_sensitivity']
        lines.append(f"| {pair['earth_id']} | {pair['planetary_id']} | {a['recomputed_terrain_score']} | {s['score_min']}–{s['score_max']} | {a['catalog_features_reproduced']} |")
    for pair in catalog['pairings']:
        lines += ['', f"## {pair['earth_id']} → {pair['planetary_id']}", '',
                  'Matches: '+' '.join(pair['explanation']['matches']), '',
                  'Differences: '+' '.join(pair['explanation']['differences']), '',
                  'Evidence: '+'; '.join(pair['explanation']['sources'])]
    (ROOT/'docs/PAIRING_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8',newline='\n')
    print(f"Audited {len(catalog['pairings'])} proposed pairings; independent accuracy remains unknown.")


if __name__=='__main__':
    main()
