"""Analog score: landform-family agreement plus resolution-matched terrain similarity.

Usage: python -m scripts.catalog.analog_score --fit   (refreeze data/terrain-scales.json)

Chosen against scripts.catalog.benchmark: terrain shape alone ranks the catalog's
literature-informed analogs no better than chance, because analogs are proposed by
landform process. Half of the score is therefore the agreement of the interpreted
landform families, and half is the multi-feature terrain similarity from
terrain_features at the planetary grid's own resolution.

The landform term is a weighted component, never a filter: a site with an unknown
or different landform still receives its terrain half. Labels are catalog
interpretations and the benchmark labels were themselves proposed by landform, so
agreement with them is partly circular. This is an engineering index, not accuracy.
"""
import argparse
import json
from pathlib import Path

import numpy as np

from . import terrain_features as tf
from .accuracy import OFFSETS

VERSION = '1.0.0'
ROOT = Path(__file__).resolve().parents[2]
SCALES_PATH = ROOT/'data/terrain-scales.json'
LANDFORM_WEIGHT = 0.5
RELATED_AFFINITY = 0.5
# A landform inferred from the scan region's seed sites is unreviewed, so it earns less
# than a reviewed catalog label. A related family then cannot pass a 70% cutoff.
INFERRED_FACTOR = 0.75
# A crater is a single feature, not an areal surface: ground tens of kilometres from a seed
# crater is not a crater, so that label is never inferred for neighbouring windows.
NOT_INFERABLE_FAMILIES = frozenset({'crater'})
# Mean scaled difference at which terrain similarity falls to 1/e (about 37%).
DISTANCE_SCALE = 2.0
SENSITIVE_SPAN_PERCENT = 10.0

FAMILIES = {
    'volcanic_plain': 'volcanic', 'lava_field': 'volcanic',
    'crater': 'crater', 'impact_crater': 'crater',
    'dune_field': 'aeolian',
    'delta': 'sedimentary', 'playa': 'sedimentary', 'badlands': 'sedimentary', 'canyon': 'sedimentary',
    'rocky_desert': 'desert',
    'polygonal_ground': 'periglacial',
    'massif': 'massif',
}
# Families that share surface-forming context; scored at RELATED_AFFINITY.
RELATED = {
    frozenset(('crater', 'volcanic')): 'Volcanic craters and maars occur within volcanic fields.',
    frozenset(('sedimentary', 'desert')): 'Rocky deserts commonly expose eroded sedimentary surfaces.',
    frozenset(('massif', 'crater')): 'Lunar massifs are impact-basin rim remnants.',
}


def _relation(a, b):
    if a is None or b is None:
        return 'unknown', 0.0
    if a == b:
        return 'same_family', 1.0
    if frozenset((a, b)) in RELATED:
        return 'related_family', RELATED_AFFINITY
    return 'different_family', 0.0


def landform(earth_morphology, planetary_morphology, inferred_landforms=()):
    """Landform agreement. `inferred_landforms` are unreviewed labels borrowed from nearby
    seed sites; they are used only when the site has no reviewed label of its own."""
    a, b = FAMILIES.get(earth_morphology), FAMILIES.get(planetary_morphology)
    relation, affinity = _relation(a, b)
    result = {'earth_family': a, 'planetary_family': b, 'relation': relation,
              'match_percent': 100*affinity, 'status': 'interpretation_only'}
    if a is None and b is not None and inferred_landforms:
        families = sorted({FAMILIES[m] for m in inferred_landforms if m in FAMILIES} - NOT_INFERABLE_FAMILIES)
        options = [(_relation(f, b)[1], f) for f in families]
        if options:
            best, family = max(options, key=lambda o: (o[0], o[1] == b, o[1]))
            result.update(earth_family=family, relation=_relation(family, b)[0],
                          match_percent=100*INFERRED_FACTOR*best, status='inferred_from_scan_region_unreviewed')
    return result


def resolution_for(planetary_spacing_m):
    """Compare at the planetary pack spacing; Earth grids are area-averaged up to it."""
    return tf.common_resolution(planetary_spacing_m)


def load_scales(path=SCALES_PATH):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    return {float(k): v for k, v in data['scales_by_resolution_m'].items()}


def terrain_percent(a, b, scales):
    """exp(-mean scaled difference / DISTANCE_SCALE) over every frozen-scale feature."""
    if a is None or b is None or not scales or any(a.get(k) is None or b.get(k) is None for k in scales):
        return None
    distance = float(np.mean([abs(a[k]-b[k])/s for k, s in scales.items()]))
    return 100*float(np.exp(-distance/DISTANCE_SCALE))


def combine(terrain, landform_match_percent):
    return None if terrain is None else (1-LANDFORM_WEIGHT)*terrain + LANDFORM_WEIGHT*landform_match_percent


def window_features(z, spacing, resolution):
    """Feature vectors for the five shifted windows; None where a window is unsupported."""
    return [tf.features(z, spacing, resolution, offset) for offset in OFFSETS]


def pair_score(earth, planet, earth_windows, planet_windows, scales):
    """Central score plus the range over the 25 shifted-window combinations."""
    form = landform(earth.get('morphology'), planet['morphology'], earth.get('inferred_landforms') or ())
    central = terrain_percent(earth_windows[0], planet_windows[0], scales)
    shifted = [terrain_percent(a, b, scales) for a in earth_windows for b in planet_windows]
    complete = central is not None and all(v is not None for v in shifted)
    low, high = (min(shifted), max(shifted)) if complete else (None, None)
    return {'terrain_percent': central, 'landform': form,
            'analog_score_percent': combine(central, form['match_percent']),
            'terrain_range_percent': [low, high], 'valid_comparisons': sum(v is not None for v in shifted),
            'window_sensitivity': 'insufficient_data' if not complete else
                'sensitive' if high-low > SENSITIVE_SPAN_PERCENT else 'limited_change'}


def fit(catalog, public):
    """Robust per-feature spread across the Earth catalog, frozen so later sites do not move scores."""
    earth = sorted((s for s in catalog['sites'] if s['role'] == 'earth_analog' and s.get('terrain')), key=lambda s: s['id'])
    spacings = sorted({resolution_for(s['terrain']['spacing_m']) for s in catalog['sites']
                       if s['role'] == 'planetary_target' and s.get('terrain')})
    grids = {s['id']: tf.pack_grid(s, public)[:2] for s in earth}
    scales = {}
    for resolution in spacings:
        vectors = [tf.features(*grids[s['id']], resolution) for s in earth]
        scales[str(resolution)] = {k: round(v, 9) for k, v in sorted(tf.robust_scales([v for v in vectors if v]).items())}
    return {'method_version': VERSION, 'descriptor_version': tf.VERSION,
            'status': 'frozen_engineering_reference_spread',
            'method': 'max(1.4826 x MAD, IQR/1.349) of each terrain feature across the fitted Earth sites, per comparison resolution.',
            'fitted_earth_site_ids': [s['id'] for s in earth], 'scales_by_resolution_m': scales}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--fit', action='store_true', help=f'refreeze {SCALES_PATH.relative_to(ROOT)} from the published catalog')
    args = parser.parse_args(argv)
    if not args.fit:
        parser.error('nothing to do; pass --fit')
    public = ROOT/'web/public'
    result = fit(json.loads((public/'sites.json').read_text(encoding='utf-8')), public)
    SCALES_PATH.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(f'Froze scales for {len(result["fitted_earth_site_ids"])} Earth sites at {list(result["scales_by_resolution_m"])} m')


if __name__ == '__main__':
    main()
