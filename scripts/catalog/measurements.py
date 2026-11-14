"""Reviewed literature dimensions; not footprint statistics or contact mechanics.

Sources checked 2026-11-14. Unit conversions preserve the source's approximate
nature; decimal places below are conversion artifacts, not measurement accuracy.
"""

NASA_KILBOURNE = 'https://science.nasa.gov/blogs/notes-from-the-field/2018/01/24/kilbourne-and-aden-two-flavors-of-volcanism/'
BLM_AMBOY = 'https://www.blm.gov/visit/amboy-crater-national-natural-landmark'


def literature_measurements(site_id):
    rows = {
        'kilbourne-hole-v1': [
            ('crater_short_dimension', 1.5 * 1609.344, 'NASA Kilbourne and Aden field report', NASA_KILBOURNE, 'Approximate 1.5 mile dimension converted with 1609.344 m/mile'),
            ('crater_long_dimension', 2 * 1609.344, 'NASA Kilbourne and Aden field report', NASA_KILBOURNE, 'Approximate 2 mile dimension converted with 1609.344 m/mile'),
        ],
        'amboy': [
            ('cone_height', 250 * 0.3048, 'BLM Amboy Crater National Natural Landmark', BLM_AMBOY, 'Approximate 250 ft height converted with 0.3048 m/ft'),
            ('cone_diameter', 1500 * 0.3048, 'BLM Amboy Crater National Natural Landmark', BLM_AMBOY, 'Approximate 1500 ft diameter converted with 0.3048 m/ft'),
        ],
    }
    return {key: {
        'value': value, 'unit': 'm', 'status': 'derived',
        'source': {'product_id': product, 'url': url},
        'native_resolution_m': None, 'analysis_resolution_m': None,
        'time_coverage': None, 'method': method,
        'caveat': 'Approximate published landform dimension, not a measurement from the analysis grid. Survey date, uncertainty and exact boundary definition are unspecified.',
        'reason': None,
    } for key, value, product, url, method in rows.get(site_id, [])}
