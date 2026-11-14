"""Offline window reader for the accuracy pipeline; this module computes no scores."""
import json
from pathlib import Path
import hashlib

import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.warp import transform_bounds, transform
from jsonschema import Draft202012Validator

from .scan import ROOT,INDEX,sha


class WindowStore:
    """An immutable-index run: verify each cached region once, close on context exit."""
    def __init__(self,index=INDEX,root=ROOT):
        self.root=Path(root).resolve(); self.index=Path(index)
        self.manifest=json.loads((self.index/'manifest.json').read_text(encoding='utf-8'))
        path=self.index/'windows.jsonl'
        if sha(path)!=self.manifest['index_sha256']: raise ValueError('Location index checksum mismatch')
        if sha(self.index/'sources.json')!=self.manifest['sources_sha256']:
            raise ValueError('Location source receipts checksum mismatch')
        self.sources=json.loads((self.index/'sources.json').read_text(encoding='utf-8'))
        self.records=[json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]
        self.by_id={r['id']:r for r in self.records}
        if len(self.by_id)!=len(self.records) or len(self.records)!=self.manifest['window_count']:
            raise ValueError('Duplicate IDs or window-count mismatch')
        validator=Draft202012Validator(json.loads((ROOT/'data/earth_index.schema.json').read_text()))
        for row in self.records:
            validator.validate(row)
            w,s,e,n=row['bbox']
            if not (-180<=w<=row['longitude']<=e<=180 and -90<=s<=row['latitude']<=n<=90 and w<e and s<n):
                raise ValueError('Invalid window bounding box or centre')
            if row['source_receipt']!=row['region_id'] or row['source_receipt'] not in self.sources['region_receipts']:
                raise ValueError('Missing region receipt')
            if not np.isclose(sum(row['land_cover']['fractions'].values()),1):
                raise ValueError('Land-cover fractions do not sum to one')
        self._open={}

    def read(self,window_id):
        row=self.by_id[window_id]; t=row['terrain_window']
        path=(self.root/t['region_dem']).resolve()
        if not path.is_relative_to(self.root/'data/raw/location-scan/regions'):
            raise ValueError('Regional DEM path escapes location cache')
        source=self.sources['region_receipts'][row['source_receipt']]
        if path not in self._open:
            if sha(path)!=source['sources']['dem']['sha256']: raise ValueError('Regional DEM checksum mismatch')
            self._open[path]=rasterio.open(path)
        dataset=self._open[path]
        win=Window(t['column'],t['row'],t['columns'],t['rows'])
        z=dataset.read(1,window=win).astype('<f4')
        if z.shape!=(t['rows'],t['columns']) or not np.isfinite(z).all(): raise ValueError('Window contains missing or truncated elevation')
        if hashlib.sha256(z.tobytes()).hexdigest()!=t['elevation_sha256']: raise ValueError('Window checksum mismatch')
        affine=dataset.window_transform(win)
        if not np.allclose(list(affine)[:6],t['affine'],rtol=0,atol=1e-6): raise ValueError('Window affine mismatch')
        if dataset.crs!=rasterio.crs.CRS.from_string(t['crs']): raise ValueError('Window CRS mismatch')
        if affine.a!=t['spacing_m'] or affine.e!=-t['spacing_m'] or affine.b or affine.d:
            raise ValueError('Window grid orientation mismatch')
        bbox=transform_bounds(dataset.crs,'EPSG:4326',*dataset.window_bounds(win),densify_pts=21)
        if not np.allclose(bbox,row['bbox'],rtol=0,atol=1e-7): raise ValueError('Window geographic bounds mismatch')
        x,y=affine*(t['columns']/2,t['rows']/2)
        lon,lat=transform(dataset.crs,'EPSG:4326',[x],[y])
        if not np.allclose([lon[0],lat[0]],[row['longitude'],row['latitude']],rtol=0,atol=1e-7):
            raise ValueError('Window geographic centre mismatch')
        return row,z,affine,source

    def __enter__(self): return self

    def __exit__(self,*args):
        for src in self._open.values(): src.close()


def main():
    with WindowStore() as store:
        for row in store.records: store.read(row['id'])
        print(f'PASS: {len(store.records)} indexed windows; schemas, IDs, cache hashes, finite elevations and coordinate transforms')


if __name__=='__main__': main()
