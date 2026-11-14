"""Verify data provenance, resampling, height encoding and glTF geometry agreement."""
import hashlib
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image
from pyproj import Transformer
import rasterio
from rasterio.warp import reproject, Resampling

PACK = Path(__file__).resolve().parents[2] / "web/public/terrain/kilbourne-hole-v1"
m = json.loads((PACK / "manifest.json").read_text())
checksums = json.loads((PACK / "checksums.json").read_text())
for name, record in checksums.items():
    data = (PACK / name).read_bytes()
    assert len(data) == record["bytes"], name
    assert hashlib.sha256(data).hexdigest() == record["sha256"], name

rows, cols = m["grid"]["rows"], m["grid"]["columns"]
heights = np.fromfile(PACK / "elevation.f32", dtype="<f4").reshape(rows, cols)
assert np.isfinite(heights).all()
with rasterio.open(PACK / "elevation-utm.tif") as dst:
    np.testing.assert_array_equal(heights, dst.read(1))
    assert dst.crs.to_epsg() == 32613
    assert dst.tags()["AREA_OR_POINT"] == "Point"
    np.testing.assert_allclose(dst.xy(0, 0), [m["grid"]["northwest_sample_easting_m"], m["grid"]["northwest_sample_northing_m"]], atol=1e-8, rtol=0)
    recreated = np.full_like(heights, np.nan)
    with rasterio.open(PACK / "source-window-wgs84.tif") as src:
        reproject(rasterio.band(src, 1), recreated, src_transform=src.transform,
                  src_crs=src.crs, dst_transform=dst.transform, dst_crs=dst.crs,
                  dst_nodata=np.nan, resampling=Resampling.bilinear)
    np.testing.assert_allclose(recreated, heights, rtol=0, atol=0.001)

png = np.array(Image.open(PACK / "heightmap-16bit.png"), dtype=np.float64)
assert png.shape == heights.shape
span = m["heightmap"]["max_m"] - m["heightmap"]["min_m"]
decoded = m["heightmap"]["min_m"] + png / 65535 * span
quantization_error = float(np.max(np.abs(decoded - heights)))
assert quantization_error <= span / 65535 / 2 + 0.0001

glb = (PACK / "terrain.glb").read_bytes()
assert struct.unpack_from("<III", glb) == (0x46546C67, 2, len(glb))
json_size, json_type = struct.unpack_from("<II", glb, 12)
assert json_type == 0x4E4F534A
doc = json.loads(glb[20:20 + json_size])
bin_size, bin_type = struct.unpack_from("<II", glb, 20 + json_size)
assert bin_type == 0x004E4942
binary = glb[28 + json_size:]
assert len(binary) == bin_size

def accessor(index, dtype, width):
    a = doc["accessors"][index]
    view = doc["bufferViews"][a["bufferView"]]
    return np.frombuffer(binary, dtype=dtype, count=a["count"] * width, offset=view["byteOffset"]).reshape(-1, width)

positions = accessor(0, "<f4", 3)
normals = accessor(1, "<f4", 3)
indices = accessor(2, "<u4", 1).reshape(-1, 3)
assert len(positions) == rows * cols and len(indices) == (rows - 1) * (cols - 1) * 2
assert indices.max() < len(positions)
np.testing.assert_array_equal(positions[:, 1], heights.ravel() - m["local_frame"]["vertical_offset_m"])
np.testing.assert_array_equal(positions[:, 0].reshape(rows, cols)[0], np.arange(cols) * 30)
np.testing.assert_array_equal(positions[:, 2].reshape(rows, cols)[:, 0], np.arange(rows) * 30)
triangles = positions[indices]
crosses = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
assert (crosses[:, 1] > 0).all(), "Flipped or degenerate triangles"
np.testing.assert_allclose(np.linalg.norm(normals, axis=1), 1, atol=1e-6)
assert (normals[:, 1] > 0).all()

geo = json.loads((PACK / "location.geojson").read_text())
ring = geo["features"][0]["geometry"]["coordinates"][0]
to_utm = Transformer.from_crs(4326, 32613, always_xy=True)
corners = np.array([to_utm.transform(*p) for p in ring[:4]])
west, north = m["grid"]["northwest_sample_easting_m"], m["grid"]["northwest_sample_northing_m"]
width, depth = m["grid"]["width_m"], m["grid"]["depth_m"]
np.testing.assert_allclose(corners, [[west, north], [west, north-depth], [west+width, north-depth], [west+width, north]], rtol=0, atol=1e-5)
print(f"PASS: {len(checksums)} checksums; source reprojection; raster/binary/GLB agreement; mesh orientation; map registration.")
print(f"PNG encoding error: {quantization_error:.6f} m (encoding only, NOT source accuracy).")
