"""Shared build/registration metadata; do not duplicate site-specific handoffs."""
from copy import deepcopy
from .pairings import attach_handoff
from .scoring import compare
from .measurements import literature_measurements

FEATURES = {
    'haughton': ['crater_diameter', 'rim_geometry', 'ground_ice_depth'],
    'qaidam': ['yardang_height', 'yardang_width', 'yardang_orientation', 'surface_material_fractions'],
}


def preserve_registered_scans(rebuilt, previous):
    """Curated rebuilds retain registered scan packs from the staged public tree."""
    ids={s['id'] for s in rebuilt}
    return rebuilt + [s for s in previous.values()
                      if s.get('catalog_origin')=='regional_scan' and s['id'] not in ids]


def preserve_handoff(record, previous=None):
    # Only explicitly curated metadata survives; never reuse stale terrain/weather stats.
    previous = previous or {}
    measurements = deepcopy(previous.get('feature_measurements', {}))
    for key, value in record.get('feature_measurements', {}).items():
        if value.get('value') is not None or key not in measurements:
            measurements[key] = value
    for key in FEATURES.get(record['id'], []):
        measurements.setdefault(key, {'value': None, 'status': 'unknown',
            'reason': 'Requires feature delineation, finer terrain or field measurements; not inferred from this regional DSM.'})
    record['feature_measurements'] = measurements
    record['feature_measurements'].update(literature_measurements(record['id']))
    if record['id'] == 'kilbourne-hole-v1' and measurements.get('crater_diameter', {}).get('value') is None:
        measurements['crater_diameter'] = {'value': None, 'status': 'unknown',
            'reason': 'Irregular maar: published short and long dimensions are recorded separately; no single equivalent diameter or depth/diameter definition adopted.'}
    return record


def make_catalog(sites, public=None):
    byid = {s['id']: s for s in sites}
    pairs = []
    for site in sites:
        for target_id in site['matches']:
            target = byid[target_id]
            pairs.append({'earth_id': site['id'], 'planetary_id': target_id,
                **compare(site['comparison_features'], target['comparison_features']),
                'geology_comparison': {
                    'same_substrate_label': site['substrate'] == target['substrate'],
                    'same_morphology_label': site['morphology'] == target['morphology'],
                    'score': None, 'reason': 'Categorical interpretations are not calibrated geological distances; not folded into terrain score.'}})
    catalog = attach_handoff({'schema_version': '1.0.0',
        'coordinate_convention': 'east-positive longitude [-180,180], body-specific latitude; Earth WGS84, Moon/Mars planetocentric',
        'sites': sites, 'pairings': pairs})
    from pathlib import Path
    from .accuracy import attach_accuracy
    public = public or Path(__file__).resolve().parents[2]/'web/public'
    from .matching import attach_matching
    samples = {}
    return attach_matching(attach_accuracy(catalog, public, samples), public, sample_cache=samples)
