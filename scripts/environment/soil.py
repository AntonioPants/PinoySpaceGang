"""Supplementary USDA SSURGO point lookup; map-unit components are not pad samples."""
import gzip
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request

ENDPOINT = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest'

def query_for(site):
    # Coordinates originate from our numeric site registry, never user-supplied SQL.
    lon, lat = float(site['longitude']), float(site['latitude'])
    return f"""SELECT mu.mukey, mu.muname, l.areasymbol, l.areaname, co.cokey, co.compname, co.compkind,
co.comppct_r, co.taxorder, hz.hzname, hz.hzdept_r, hz.hzdepb_r,
hz.sandtotal_r, hz.silttotal_r, hz.claytotal_r, hz.dbthirdbar_r
FROM mapunit mu INNER JOIN legend l ON l.lkey = mu.lkey INNER JOIN component co ON co.mukey = mu.mukey
LEFT JOIN chorizon hz ON hz.cokey = co.cokey AND hz.hzdept_r < 30
WHERE mu.mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT({lon} {lat})'))
ORDER BY co.comppct_r DESC, co.cokey, hz.hzdept_r"""

def fetch_soil(site, cache):
    query = query_for(site)
    request = json.dumps({'query': query, 'format': 'JSON+COLUMNNAME'}).encode()
    cache = Path(cache)
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / ('ssurgo-' + hashlib.sha256(request).hexdigest() + '.json.gz')
    source = {'url': ENDPOINT, 'query': query, 'provider': 'USDA NRCS SSURGO (supplementary source)', 'spatial_support': 'map unit intersecting request point; component percentages apply to the map unit, not a mapped pad', 'depth_selection': 'horizons with upper depth <30 cm; each reported value applies to its full horizon', 'property_units': {'sand_pct': '%', 'silt_pct': '%', 'clay_pct': '%', 'bulk_density_kg_m3': 'kg/m3, converted from dbthirdbar_r g/cm3', 'top_cm': 'cm', 'bottom_cm': 'cm'}}
    try:
        if path.exists():
            raw = gzip.decompress(path.read_bytes())
        else:
            req = urllib.request.Request(ENDPOINT, data=request, headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as response:
                raw = response.read()
            json.loads(raw)
            path.write_bytes(gzip.compress(raw, mtime=0))
        source['sha256'] = hashlib.sha256(raw).hexdigest()
        table = json.loads(raw).get('Table', [])
        rows = [dict(zip(table[0], row)) for row in table[1:]] if table else []
        def number(row, key, scale=1):
            value = row.get(key)
            return float(value) * scale if value not in (None, '') else None
        components = []
        for r in rows:
            components.append({'survey_area_symbol': r['areasymbol'], 'survey_area_name': r['areaname'], 'map_unit_key': r['mukey'], 'map_unit_name': r['muname'], 'component_key': r['cokey'], 'component_name': r['compname'], 'component_kind': r['compkind'], 'map_unit_component_pct': number(r, 'comppct_r'), 'taxonomic_order': r['taxorder'], 'horizon_name': r['hzname'], 'top_cm': number(r, 'hzdept_r'), 'bottom_cm': number(r, 'hzdepb_r'), 'sand_pct': number(r, 'sandtotal_r'), 'silt_pct': number(r, 'silttotal_r'), 'clay_pct': number(r, 'claytotal_r'), 'bulk_density_kg_m3': number(r, 'dbthirdbar_r', 1000)})
        return {'status': 'available' if rows else 'no_coverage', 'evidence': 'survey map-unit estimates; not a local engineering measurement', 'source': source, 'horizons': components}
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return {'status': 'unavailable', 'error': str(exc), 'source': source, 'horizons': []}
