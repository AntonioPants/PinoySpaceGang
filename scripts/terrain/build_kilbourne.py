"""Build the browser terrain pack from a checksum-pinned Copernicus GLO-30 tile.

Run from any directory: python scripts/terrain/build_kilbourne.py [--source TILE.tif]
Without --source the ~36 MB tile is downloaded into data/cache/terrain/.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import urllib.request

os.environ.setdefault("MPLCONFIGDIR", "/tmp/pinoy-terrain-matplotlib")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
import numpy as np
from PIL import Image
from pyproj import Transformer
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import Window, from_bounds

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web/public/terrain/kilbourne-hole-v1"
TILE = "Copernicus_DSM_COG_10_N31_00_W107_00_DEM"
URL = f"https://copernicus-dem-30m.s3.amazonaws.com/{TILE}/{TILE}.tif"
SHA = "cb4c83af5da2ef6e44c7a81d3eff743aad95ffa8c78dab65cbbe7e37031d03a8"
LICENSE_URL = "https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf"
NOTICE = ("produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus "
          "Defence and Space GmbH 2014-2018 provided under COPERNICUS by the "
          "European Union and ESA; all rights reserved")
N, STEP = 161, 30.0
LAT, LON = 31.972, -106.969  # Chosen crop centre, not a surveyed control point.
CRS = "EPSG:32613"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def write_glb(heights, base, gradient_south, gradient_east):
    rows, cols = np.indices(heights.shape)
    positions = np.stack([cols * STEP, heights - base, rows * STEP], axis=-1).astype("<f4").reshape(-1, 3)
    normals = np.stack([-gradient_east, np.ones_like(heights), -gradient_south], axis=-1)
    normals = (normals / np.linalg.norm(normals, axis=-1, keepdims=True)).astype("<f4").reshape(-1, 3)
    a = (rows[:-1, :-1] * N + cols[:-1, :-1]).ravel()
    b, c = a + 1, a + N
    indices = np.stack([a, c, b, b, c, c + 1], axis=1).astype("<u4").ravel()
    chunks = [positions.tobytes(), normals.tobytes(), indices.tobytes()]
    views, offset = [], 0
    for i, chunk in enumerate(chunks):
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(chunk), "target": 34963 if i == 2 else 34962})
        offset += len(chunk)
    doc = {
        "asset": {"version": "2.0", "generator": "PinoySpaceGang build_kilbourne.py", "copyright": NOTICE},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "Kilbourne Hole: metres, +X east, +Y up, +Z south"}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
        "materials": [{"name": "Neutral display material (not satellite imagery)", "pbrMetallicRoughness": {"baseColorFactor": [0.48, 0.39, 0.27, 1], "metallicFactor": 0, "roughnessFactor": 1}}],
        "buffers": [{"byteLength": offset}], "bufferViews": views,
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(positions), "type": "VEC3", "min": positions.min(axis=0).tolist(), "max": positions.max(axis=0).tolist()},
            {"bufferView": 1, "componentType": 5126, "count": len(normals), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5125, "count": len(indices), "type": "SCALAR"},
        ],
    }
    header = json.dumps(doc, ensure_ascii=True, separators=(",", ":")).encode()
    header += b" " * (-len(header) % 4)
    binary = b"".join(chunks)
    payload = struct.pack("<II", len(header), 0x4E4F534A) + header + struct.pack("<II", len(binary), 0x004E4942) + binary
    (OUT / "terrain.glb").write_bytes(struct.pack("<III", 0x46546C67, 2, 12 + len(payload)) + payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    source = args.source or ROOT / "data/cache/terrain" / f"{TILE}.tif"
    if not source.exists():
        if args.source:
            raise FileNotFoundError(source)
        source.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL, source)
    if digest(source) != SHA:
        raise ValueError("Source checksum changed. Review provenance before rebuilding.")
    OUT.mkdir(parents=True, exist_ok=True)
    if not (OUT / "COPERNICUS-LICENSE.pdf").exists():
        urllib.request.urlretrieve(LICENSE_URL, OUT / "COPERNICUS-LICENSE.pdf")
    project = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)
    unproject = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)
    east, north = project.transform(LON, LAT)
    extent = (N - 1) * STEP
    west, top = east - extent / 2, north + extent / 2
    transform = from_origin(west - STEP / 2, top + STEP / 2, STEP, STEP)
    heights = np.full((N, N), np.nan, dtype="float32")
    with rasterio.open(source) as src:
        reproject(source=rasterio.band(src, 1), destination=heights,
                  src_transform=src.transform, src_crs=src.crs, src_nodata=src.nodata,
                  dst_transform=transform, dst_crs=CRS, dst_nodata=np.nan,
                  resampling=Resampling.bilinear)
        # Preserve original samples around the AOI, with a two-pixel interpolation halo.
        bounds = transform_bounds(CRS, src.crs, west - STEP, top - extent - STEP, west + extent + STEP, top + STEP)
        win = from_bounds(*bounds, src.transform)
        x0, y0 = int(np.floor(win.col_off)) - 2, int(np.floor(win.row_off)) - 2
        x1, y1 = int(np.ceil(win.col_off + win.width)) + 2, int(np.ceil(win.row_off + win.height)) + 2
        window = Window(x0, y0, x1 - x0, y1 - y0)
        native = src.read(1, window=window)
        profile = src.profile.copy()
        profile.update(width=native.shape[1], height=native.shape[0], transform=src.window_transform(window))
        with rasterio.open(OUT / "source-window-wgs84.tif", "w", **profile) as dst:
            dst.write(native, 1)
            dst.update_tags(**src.tags())
    if not np.isfinite(heights).all():
        raise ValueError("Terrain contains missing/nonfinite samples; do not interpolate holes silently.")
    low, high = float(heights.min()), float(heights.max())
    base = float(np.floor(low))
    gradient_south, gradient_east = np.gradient(heights, STEP, STEP, edge_order=2)
    slope = np.degrees(np.arctan(np.hypot(gradient_south, gradient_east))).astype("float32")
    for name, values, units in [("elevation-utm.tif", heights, "metres, EGM2008 orthometric height"), ("slope-degrees.tif", slope, "degrees")]:
        with rasterio.open(OUT / name, "w", driver="GTiff", width=N, height=N, count=1, dtype="float32", crs=CRS,
                           transform=transform, compress="deflate", nodata=np.nan) as dst:
            dst.write(values, 1)
            dst.update_tags(AREA_OR_POINT="Point", units=units, attribution=NOTICE)
    heights.astype("<f4").tofile(OUT / "elevation.f32")
    encoded = np.round((heights - low) / (high - low) * 65535).astype("uint16")
    Image.fromarray(encoded).save(OUT / "heightmap-16bit.png")
    write_glb(heights, base, gradient_south, gradient_east)
    # Map footprint follows the outermost mesh vertices (not the half-cell raster boundary).
    ring = [unproject.transform(x, y) for x, y in [(west, top), (west, top - extent), (west + extent, top - extent), (west + extent, top), (west, top)]]
    footprint = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"id": "kilbourne-hole-v1", "name": "Kilbourne Hole terrain footprint", "boundary": "mesh vertices"}, "geometry": {"type": "Polygon", "coordinates": [ring]}},
        {"type": "Feature", "properties": {"name": "Selected terrain centre", "surveyed": False}, "geometry": {"type": "Point", "coordinates": [LON, LAT]}},
    ]}
    write_json(OUT / "location.geojson", footprint)
    metadata = {
        "schema_version": 1, "id": "kilbourne-hole-v1", "name": "Kilbourne Hole, New Mexico, USA", "body": "Earth",
        "status": "known planetary analog; first terrain prototype", "center_wgs84": {"latitude": LAT, "longitude": LON},
        "source": {"dataset": "Copernicus DEM GLO-30 Public", "mirror_release": "2021 (per AWS registry)", "tile": TILE, "url": URL, "sha256": SHA,
                   "retrieved_date": "2026-11-14", "acquisition_period": "Primarily 2011–2015; exact local acquisition and infill not established",
                   "nominal_spacing": "1 arc-second, approximately 30 metres; longitude spacing varies with latitude", "model_type": "DSM, not bare-earth DTM",
                   "vertical_datum": "EGM2008 orthometric heights, metres (EPSG:3855)", "horizontal_crs": "EPSG:4326",
                   "catalog": "https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM",
                   "mirror_documentation": "https://registry.opendata.aws/copernicus-dem/", "license_url": LICENSE_URL},
        "grid": {"rows": N, "columns": N, "spacing_m": STEP, "width_m": extent, "depth_m": extent, "order": "row-major; north to south, west to east",
                 "dtype": "float32", "byte_order": "little-endian", "sample_file": "elevation.f32", "projected_crs": CRS,
                 "northwest_sample_easting_m": west, "northwest_sample_northing_m": top, "geotiff_affine_gdal": list(transform.to_gdal()),
                 "resampling": "bilinear", "nodata_count": 0},
        "local_frame": {"x": "UTM grid east", "y": "up", "z": "UTM grid south", "units": "metres", "origin": "northwest sample at vertical_offset_m",
                        "vertical_offset_m": base, "vertical_exaggeration": 1, "formula": "x=column*30; y=elevation_EGM2008-vertical_offset_m; z=row*30",
                        "note": "Directions follow UTM grid north/east; not an exact geodetic ENU frame."},
        "heightmap": {"file": "heightmap-16bit.png", "bits": 16, "decode": "elevation_m = min_m + pixel/65535*(max_m-min_m)", "min_m": low, "max_m": high},
        "statistics": {"elevation_min_m": low, "elevation_max_m": high, "relief_m": high - low, "slope_max_deg": float(slope.max()), "slope_p95_deg": float(np.percentile(slope, 95))},
        "physics": {"collision_geometry": "terrain.glb or matching height samples", "friction_coefficient": None, "soil_cohesion_pa": None, "bulk_density_kg_m3": None,
                    "gravity_m_s2": None, "note": "Material parameters require independent measurements or explicitly labelled simulation settings; gravity is a scenario setting, not supplied by the DEM."},
        "analog": {"known_site": True, "new_discovery": False, "planetary_pair": None, "quantitative_similarity_score": None,
                   "basis": "NASA field-training and volcanic-process analog literature; no matched Mars or lunar DEM comparison has been performed",
                   "sources": ["https://science.nasa.gov/blogs/notes-from-the-field/2018/02/05/the-footsteps-of-apollo-astronauts/", "https://science.nasa.gov/blogs/notes-from-the-field/2018/01/24/kilbourne-and-aden-two-flavors-of-volcanism/", "https://www.blm.gov/visit/kilbourne-hole-volcanic-crater"]},
        "limitations": ["30 m data resolves broad landforms, not rocks, wheel-scale hazards, caves or overhangs.", "DSM may include vegetation and structures; quality/error masks were not acquired.", "Slopes are finite-difference estimates on the resampled grid; cliffs are smoothed.", "No measured soil mechanics, imagery texture, climate layers or planetary terrain are included.", "Display material is a neutral illustration, not a land-cover classification."],
        "attribution": NOTICE,
    }
    write_json(OUT / "manifest.json", metadata)
    fig, axes = plt.subplots(1, 2, figsize=(12, 6), constrained_layout=True)
    light = LightSource(azdeg=315, altdeg=45)
    shaded = light.shade(heights, cmap=plt.get_cmap("copper"), vert_exag=1, dx=STEP, dy=STEP)
    axes[0].imshow(shaded, extent=(0, extent / 1000, extent / 1000, 0))
    axes[0].set_title("Real elevation • shaded relief (not imagery)")
    im = axes[1].imshow(slope, extent=(0, extent / 1000, extent / 1000, 0), cmap="magma", vmin=0, vmax=40)
    fig.colorbar(im, ax=axes[1], label="Slope (degrees)", shrink=0.8)
    axes[1].set_title("Slope derived from the 30 m grid")
    for ax in axes:
        ax.set_xlabel("Grid east from NW corner (km)")
        ax.set_ylabel("Grid south from NW corner (km)")
    fig.suptitle("Kilbourne Hole • 4.8 × 4.8 km • north at top", fontsize=17)
    fig.savefig(OUT / "preview.png", dpi=140)
    plt.close(fig)
    (OUT / "ATTRIBUTION.txt").write_text(NOTICE + "\n\nLicense: " + LICENSE_URL + "\n\nNative source-window: © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved\n")
    files = {p.name: {"sha256": digest(p), "bytes": p.stat().st_size} for p in sorted(OUT.iterdir()) if p.is_file() and p.name != "checksums.json"}
    write_json(OUT / "checksums.json", files)
    print(json.dumps(metadata["statistics"], indent=2))
    print(f"Built {N*N:,} vertices, {(N-1)**2*2:,} triangles in {OUT}")


if __name__ == "__main__":
    main()
