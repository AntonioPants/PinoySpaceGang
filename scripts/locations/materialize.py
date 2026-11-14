"""Stage a real terrain pack by window ID without scoring or publishing a site.

The accuracy/catalog owner reviews handoff.json before using existing publication
tools. No matches, geological labels, environmental values or scores are inferred.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import rasterio

from .store import WindowStore
from .scan import RAW, DEM_LICENSE, WC_LICENSE, sha, dump
from scripts.catalog.publication import publication


def validate_pack(pack):
    """Check the binary/GeoTIFF loader contract without invoking any matcher."""
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
    grid = manifest['grid']
    receipts = json.loads((pack / 'checksums.json').read_text(encoding='utf-8'))
    if set(receipts) != {p.name for p in pack.iterdir() if p.name != 'checksums.json'}:
        raise ValueError('Incomplete pack inventory')
    for filename, expected in receipts.items():
        if sha(pack / filename) != expected:
            raise ValueError('Pack checksum mismatch: ' + filename)
    heights = np.fromfile(pack / grid['sample_file'], dtype='<f4')
    if heights.size != grid['rows'] * grid['columns'] or not np.isfinite(heights).all():
        raise ValueError('Invalid or missing pack elevation')
    with rasterio.open(pack / 'elevation.tif') as src:
        if (src.height, src.width) != (grid['rows'], grid['columns']):
            raise ValueError('Pack dimensions mismatch')
        if src.transform.a != grid['spacing_m'] or src.transform.e != -grid['spacing_m']:
            raise ValueError('Pack spacing/orientation mismatch')
        if src.crs != rasterio.crs.CRS.from_wkt(grid['crs_wkt']):
            raise ValueError('Pack CRS mismatch')
        np.testing.assert_array_equal(src.read(1).ravel(), heights)
        np.testing.assert_allclose(list(src.transform)[:6], grid['affine'], rtol=0, atol=1e-6)
    return manifest


def stage_window(window_id, *, store=None, destination=None):
    if store is None:
        with WindowStore() as opened:
            return stage_window(window_id, store=opened, destination=destination)
    row, z, affine, source = store.read(window_id)
    dem = source['sources']['dem']
    sid = row['id']
    destination = Path(destination) if destination else RAW / 'staged' / sid
    # The existing publication transaction is used only inside the ignored cache.
    # web/public and the production catalog are never touched by this command.
    with publication(destination) as stage:
        pack = stage / 'terrain' / sid
        pack.mkdir(parents=True, exist_ok=True)
        with rasterio.open(pack / 'elevation.tif', 'w', driver='GTiff', height=z.shape[0],
                           width=z.shape[1], count=1, dtype='float32', nodata=np.nan,
                           crs=row['terrain_window']['crs'], transform=affine,
                           compress='deflate') as dst:
            dst.write(z, 1)
        z.astype('<f4').tofile(pack / 'elevation.f32')
        dump(pack / 'source-receipt.json', {
            'url': dem['tiles'][0]['url'], 'sha256': sha(pack / 'elevation.tif'),
            'source_tiles': dem['tiles'], 'regional_dem_sha256': dem['sha256'],
            'region_id': row['region_id'], 'window': row['terrain_window'],
            'land_cover': row['land_cover'], 'worldcover_sources': source['sources']['mask'],
            'method': 'Bilinear Copernicus tile mosaic to local UTM at 30m; integer crop, no nodata filling.',
            'license_url': DEM_LICENSE, 'land_cover_license_url': WC_LICENSE,
        })
        manifest = {
            'schema_version': 1, 'id': sid, 'name': row['name'], 'body': 'earth',
            'grid': {
                'rows': z.shape[0], 'columns': z.shape[1], 'spacing_m': 30,
                'dtype': 'float32', 'byte_order': 'little-endian',
                'sample_file': 'elevation.f32', 'order': 'north-first, west-first',
                'crs_wkt': rasterio.crs.CRS.from_string(row['terrain_window']['crs']).to_wkt(),
                'affine': list(affine)[:6],
                'sample_coordinates': 'GeoTIFF pixel centres; sample endpoints span 4800m; pixel footprint spans 4830m.',
                'nodata': None, 'nodata_policy': 'Reject entire window if any elevation sample is missing.',
            },
            'local_frame': {'vertical_offset_m': float(np.floor(z.min()))},
            'source': {
                'url': dem['tiles'][0]['url'], 'source_tiles': dem['tiles'],
                'native_spacing_m_approx': 30, 'vertical_datum': 'EGM2008',
                'coverage': 'Copernicus primarily 2011-2015; local acquisition unknown',
                'receipt_file': 'source-receipt.json',
                'subset_file': 'elevation.tif', 'subset_sha256': sha(pack / 'elevation.tif'),
            },
            'attribution': 'produced using Copernicus WorldDEM-30, DLR e.V. 2010-2014 and Airbus Defence and Space GmbH 2014-2018, European Union and ESA',
            'license_url': DEM_LICENSE,
            'limitations': row['limitations'] + [
                'DSM may include vegetation and structures; not a guaranteed bare-earth surface.',
                'Native postings vary with latitude; 30m output does not create new detail.',
                'Exploratory window without reviewed geological classification or planetary pairing.',
            ],
        }
        dump(pack / 'manifest.json', manifest)
        dump(pack / 'checksums.json', {p.name: sha(p) for p in pack.iterdir() if p.name != 'checksums.json'})
        validate_pack(pack)
        dump(stage / 'handoff.json', {
            'schema_version': '1.0.0', 'location': row,
            'terrain': {'manifest_url': f'/terrain/{sid}/manifest.json',
                        'manifest_sha256': sha(pack / 'manifest.json'),
                        'elevation_sha256': sha(pack / 'elevation.f32')},
            'publication_status': 'staged_only',
            'catalog_registration_status': 'awaiting_review',
            'reason': 'Catalog registration requires reviewed morphology, provenance and pairing policy from the catalog/accuracy owner. No pairing or score invented by location scanning.',
        })
    print(f'Staged {sid} at {destination}; production catalog unchanged.')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--window', required=True)
    stage_window(parser.parse_args().window)
