"""Fixed-scale engineering comparisons; no population-dependent normalization."""
import math
VERSION = '1.0.0'
FEATURES = {'slope_mean': (0.4, 15.0), 'roughness_rms': (0.4, 150.0), 'relief': (0.2, 1000.0)}

def compare(a, b):
    parts = []
    for key, (weight, scale) in FEATURES.items():
        x, y = a.get(key), b.get(key)
        if x is None or y is None:
            continue
        if x['value'] is None or y['value'] is None or x['analysis_resolution_m'] != y['analysis_resolution_m'] or x['unit'] != y['unit']:
            continue
        if x['status'] != 'derived' or y['status'] != 'derived':
            continue
        if not math.isfinite(x['value']) or not math.isfinite(y['value']):
            continue
        distance = min(abs(x['value'] - y['value']) / scale, 1.0)
        parts.append({'feature': key, 'weight': weight, 'fixed_scale': scale, 'distance': distance, 'contribution': weight * (1-distance)})
    coverage = sum(p['weight'] for p in parts)
    enough = len(parts) == 3 and coverage >= 0.99
    return {'method_version': VERSION, 'terrain_score': round(sum(p['contribution'] for p in parts),6) if enough else None,
            'coverage': round(coverage,6), 'features': parts,
            'environment_score': None, 'combined_score': None,
            'reason': 'Environment lacks compatible observations; combined score withheld.' if enough else 'Requires all three scale-matched terrain features.',
            'interpretation': 'Engineering terrain descriptor comparison; excludes geological equivalence and landing safety.'}
