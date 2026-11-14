#!/usr/bin/env python3
"""Clip a DEM and emit a compact, provenance-rich terrain profile.

Rasterio uses GDAL under the hood, so formats are limited to the drivers in the
local GDAL build. GeoTIFF and most detached/attached PDS .IMG products are
supported by standard Rasterio wheels. A PDS label referenced by an .IMG file
must be present beside it when the product uses detached labels.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import rasterio
from affine import Affine
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.errors import RasterioError
from rasterio.transform import array_bounds
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds
from scipy.ndimage import distance_transform_edt, uniform_filter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = PROJECT_ROOT / "data" / "catalog_manifest.json"
SITE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
BODY_RADII_M = {"earth": 6_371_008.8, "moon": 1_737_400.0, "mars": 3_389_500.0}
RESAMPLING = {
    "nearest": Resampling.nearest,
    "bilinear": Resampling.bilinear,
    "cubic": Resampling.cubic,
    "average": Resampling.average,
}


class ProfileError(RuntimeError):
    """An actionable input or extraction error."""


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clip and downsample a DEM into a terrain-profile JSON document.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--site", required=True, help="Site id from the manifest or a new snake_case id.")
    parser.add_argument(
        "--type", choices=("earth_analog", "planetary_site"), dest="site_type",
        help="Required for sites not defined in the manifest.",
    )
    parser.add_argument("--name", help="Display name; defaults to the manifest name or title-cased site id.")
    parser.add_argument("--body", choices=tuple(BODY_RADII_M), help="Planetary body for distance calculations.")
    parser.add_argument("--input", required=True, type=Path, help="Input GeoTIFF, PDS IMG, or other GDAL raster.")
    parser.add_argument("--band", type=int, default=1, help="One-based elevation band index.")
    parser.add_argument(
        "--bbox", nargs=4, type=float, metavar=("MIN_X", "MIN_Y", "MAX_X", "MAX_Y"),
        help="Clip bounds; defaults to the selected manifest site's bbox.",
    )
    parser.add_argument(
        "--bbox-crs", default=None,
        help="CRS of --bbox: 'auto' (body lon/lat), 'native', or a Rasterio CRS string.",
    )
    parser.add_argument("--source-crs", help="Override a missing source CRS without modifying the input.")
    parser.add_argument(
        "--pixel-size-m", nargs=2, type=float, metavar=("DX", "DY"),
        help="Override physical output-cell size; required for unreferenced rasters.",
    )
    size = parser.add_mutually_exclusive_group()
    size.add_argument("--max-size", type=int, default=128, help="Maximum output width or height.")
    size.add_argument("--width", type=int, help="Exact output width; height preserves source pixel aspect.")
    parser.add_argument("--height", type=int, help="Exact output height; may be combined with --width.")
    parser.add_argument("--resampling", choices=tuple(RESAMPLING), default="average")
    parser.add_argument("--roughness-window", type=int, default=5, help="Odd local RMS window size in cells.")
    parser.add_argument(
        "--vertical-scale", type=float,
        help="Elevation multiplier; defaults to the raster band's GDAL scale metadata or 1.",
    )
    parser.add_argument(
        "--vertical-offset", type=float,
        help="Elevation offset in metres; defaults to the raster band's GDAL offset metadata or 0.",
    )
    parser.add_argument("--dataset-id", help="Dataset key from catalog_manifest.json.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, help="Output path; otherwise selected from site type.")
    parser.add_argument("--precision", type=int, default=3, help="Decimal places retained in output grids.")
    parser.add_argument("--skip-checksum", action="store_true", help="Skip SHA-256 for very large inputs.")
    parser.add_argument("--overwrite", action="store_true", help="Replace an existing output profile.")
    return parser.parse_args(argv)


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            manifest = json.load(handle)
    except FileNotFoundError as exc:
        raise ProfileError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ProfileError(f"Manifest is not valid JSON: {path}: {exc}") from exc
    if not isinstance(manifest.get("sites"), dict) or not isinstance(manifest.get("datasets"), dict):
        raise ProfileError(f"Manifest lacks object-valued 'sites' or 'datasets': {path}")
    return manifest


def validate_args(args: argparse.Namespace, site: dict[str, Any] | None) -> None:
    if not SITE_ID_PATTERN.fullmatch(args.site):
        raise ProfileError("--site must be lower snake_case (for example, haughton_crater).")
    if not args.input.is_file():
        raise ProfileError(f"Input raster does not exist or is not a file: {args.input}")
    if args.band < 1:
        raise ProfileError("--band must be at least 1.")
    if args.roughness_window < 3 or args.roughness_window % 2 == 0:
        raise ProfileError("--roughness-window must be an odd integer of at least 3.")
    if not 0 <= args.precision <= 9:
        raise ProfileError("--precision must be between 0 and 9.")
    if args.max_size is not None and args.max_size < 2:
        raise ProfileError("--max-size must be at least 2.")
    if args.width is not None and args.width < 2:
        raise ProfileError("--width must be at least 2.")
    if args.height is not None and args.height < 2:
        raise ProfileError("--height must be at least 2.")
    if args.pixel_size_m and any(value <= 0 for value in args.pixel_size_m):
        raise ProfileError("--pixel-size-m values must be positive.")
    bbox = args.bbox or (site or {}).get("bbox")
    if not bbox:
        raise ProfileError("A bbox is required via --bbox or a matching manifest site.")
    if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
        raise ProfileError("bbox must satisfy min_x < max_x and min_y < max_y.")
    if site is None and args.site_type is None:
        raise ProfileError("--type is required when --site is not in the manifest.")


def body_geographic_crs(body: str) -> CRS:
    if body == "earth":
        return CRS.from_epsg(4326)
    radius = BODY_RADII_M[body]
    return CRS.from_string(f"+proj=longlat +R={radius} +no_defs +type=crs")


def clipping_bounds(
    bbox: Sequence[float], bbox_crs: str, source_crs: CRS | None, body: str
) -> tuple[float, float, float, float]:
    values = tuple(float(value) for value in bbox)
    if bbox_crs.lower() == "native":
        return values
    if source_crs is None:
        raise ProfileError("The source has no CRS. Use --source-crs or --bbox-crs native.")
    requested_crs = body_geographic_crs(body) if bbox_crs.lower() == "auto" else CRS.from_user_input(bbox_crs)
    if requested_crs == source_crs or (bbox_crs.lower() == "auto" and source_crs.is_geographic):
        return values
    try:
        return transform_bounds(requested_crs, source_crs, *values, densify_pts=21)
    except Exception as exc:
        raise ProfileError(
            "Could not transform bbox into the raster CRS. For planetary rasters, verify the "
            "product's body-specific CRS or provide bounds with --bbox-crs native."
        ) from exc


def intersect_bounds(
    requested: Sequence[float], available: rasterio.coords.BoundingBox
) -> tuple[float, float, float, float]:
    left = max(float(requested[0]), available.left)
    bottom = max(float(requested[1]), available.bottom)
    right = min(float(requested[2]), available.right)
    top = min(float(requested[3]), available.top)
    if left >= right or bottom >= top:
        raise ProfileError(
            f"Requested bbox does not intersect raster bounds {tuple(round(x, 8) for x in available)}."
        )
    return left, bottom, right, top


def output_shape(window: Window, args: argparse.Namespace) -> tuple[int, int]:
    source_width, source_height = float(window.width), float(window.height)
    if args.width is not None:
        width = args.width
        height = args.height or max(2, round(source_height * width / source_width))
    elif args.height is not None:
        height = args.height
        width = max(2, round(source_width * height / source_height))
    else:
        scale = min(1.0, args.max_size / max(source_width, source_height))
        width = max(2, round(source_width * scale))
        height = max(2, round(source_height * scale))
    return int(height), int(width)


def nearest_fill(data: np.ndarray, valid: np.ndarray) -> np.ndarray:
    if not np.any(valid):
        raise ProfileError("The clipped/resampled raster contains no valid elevation cells.")
    if np.all(valid):
        return data.copy()
    nearest_indices = distance_transform_edt(~valid, return_distances=False, return_indices=True)
    return data[tuple(nearest_indices)]


def linear_unit_factor(crs: CRS) -> float:
    try:
        _, factor = crs.linear_units_factor
        return float(factor)
    except (AttributeError, TypeError, ValueError):
        return 1.0


def cell_spacings(
    transform: Affine,
    crs: CRS | None,
    height: int,
    body: str,
    override: Sequence[float] | None,
) -> tuple[np.ndarray, float]:
    if override:
        return np.full(height, float(override[0]), dtype=np.float64), float(override[1])
    if crs is None:
        raise ProfileError("Cannot derive metre resolution without a CRS; provide --pixel-size-m DX DY.")
    if crs.is_geographic:
        metres_per_degree = math.pi * BODY_RADII_M[body] / 180.0
        row_indices = np.arange(height, dtype=np.float64) + 0.5
        latitudes = transform.f + transform.e * row_indices + transform.d * 0.5
        dx = abs(transform.a) * metres_per_degree * np.abs(np.cos(np.deg2rad(latitudes)))
        dy = abs(transform.e) * metres_per_degree
    else:
        factor = linear_unit_factor(crs)
        dx_value = math.hypot(transform.a, transform.d) * factor
        dy = math.hypot(transform.b, transform.e) * factor
        dx = np.full(height, dx_value, dtype=np.float64)
    if not np.all(np.isfinite(dx)) or np.any(dx <= 0) or not math.isfinite(dy) or dy <= 0:
        raise ProfileError("Derived cell spacing is invalid; provide --pixel-size-m DX DY explicitly.")
    return dx, float(dy)


def terrain_metrics(
    elevation: np.ndarray,
    valid: np.ndarray,
    dx_by_row: np.ndarray,
    dy: float,
    roughness_window: int,
) -> tuple[np.ndarray, np.ndarray]:
    filled = nearest_fill(elevation, valid)
    dz_dx = np.gradient(filled, axis=1) / dx_by_row[:, None]
    dz_dy = np.gradient(filled, axis=0) / dy
    slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))

    weights = valid.astype(np.float64)
    values = np.where(valid, elevation, 0.0)
    count = uniform_filter(weights, size=roughness_window, mode="constant", cval=0.0)
    total = uniform_filter(values, size=roughness_window, mode="constant", cval=0.0)
    total_sq = uniform_filter(values * values, size=roughness_window, mode="constant", cval=0.0)
    with np.errstate(divide="ignore", invalid="ignore"):
        mean = total / count
        variance = np.maximum(0.0, total_sq / count - mean * mean)
    roughness = np.sqrt(variance)
    slope[~valid] = np.nan
    roughness[~valid | (count == 0)] = np.nan
    return slope, roughness


def finite_stats(array: np.ndarray) -> dict[str, float]:
    finite = array[np.isfinite(array)]
    if finite.size == 0:
        raise ProfileError("A derived metric unexpectedly contains no finite values.")
    return {
        "min": float(np.min(finite)),
        "max": float(np.max(finite)),
        "mean": float(np.mean(finite)),
        "stddev": float(np.std(finite)),
    }


def rounded_grid(array: np.ndarray, precision: int) -> list[list[float | None]]:
    rounded = np.round(array, precision)
    return [[None if not np.isfinite(value) else float(value) for value in row] for row in rounded]


def rounded_stats(stats: dict[str, float], precision: int) -> dict[str, float]:
    return {key: round(value, precision) for key, value in stats.items()}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def crs_metadata(crs: CRS | None) -> dict[str, Any] | None:
    if crs is None:
        return None
    authority = crs.to_authority()
    return {
        "authority": f"{authority[0]}:{authority[1]}" if authority else None,
        "wkt": crs.to_wkt(),
        "is_geographic": bool(crs.is_geographic),
    }


def affine_values(transform: Affine) -> list[float]:
    return [float(transform.a), float(transform.b), float(transform.c),
            float(transform.d), float(transform.e), float(transform.f)]


def default_output(site_id: str, site_type: str) -> Path:
    directory = "earth_analogs" if site_type == "earth_analog" else "planetary_sites"
    return PROJECT_ROOT / "data" / "processed" / directory / f"{site_id}.json"


def extract(args: argparse.Namespace) -> tuple[dict[str, Any], Path]:
    manifest = load_manifest(args.manifest.resolve())
    manifest_site = manifest["sites"].get(args.site)
    validate_args(args, manifest_site)

    site_type = args.site_type or manifest_site["type"]
    body = args.body or (manifest_site or {}).get("body") or ("earth" if site_type == "earth_analog" else None)
    if body is None:
        raise ProfileError("--body is required for a new planetary site.")
    name = args.name or (manifest_site or {}).get("name") or args.site.replace("_", " ").title()
    bbox = tuple(args.bbox or manifest_site["bbox"])
    bbox_crs = args.bbox_crs or (manifest_site or {}).get("bbox_crs", "auto")
    dataset_id = args.dataset_id or (manifest_site or {}).get("default_dataset")
    dataset = manifest["datasets"].get(dataset_id) if dataset_id else None
    if dataset_id and dataset is None:
        raise ProfileError(f"Unknown --dataset-id '{dataset_id}' in {args.manifest}.")

    output = (args.output or default_output(args.site, site_type)).resolve()
    if output.exists() and not args.overwrite:
        raise ProfileError(f"Output already exists: {output}. Use --overwrite to replace it.")

    input_path = args.input.resolve()
    try:
        with rasterio.open(input_path) as source:
            if args.band > source.count:
                raise ProfileError(f"Band {args.band} requested, but the raster has {source.count} band(s).")
            source_crs = CRS.from_user_input(args.source_crs) if args.source_crs else source.crs
            if not math.isclose(source.transform.b, 0.0, abs_tol=1e-12) or not math.isclose(
                source.transform.d, 0.0, abs_tol=1e-12
            ):
                raise ProfileError("Rotated/sheared rasters are not supported; warp to a north-up DEM first.")

            native_request = clipping_bounds(bbox, bbox_crs, source_crs, body)
            clipped_bounds = intersect_bounds(native_request, source.bounds)
            window = from_bounds(*clipped_bounds, transform=source.transform)
            window = window.round_offsets().round_lengths().intersection(
                Window(0, 0, source.width, source.height)
            )
            if window.width < 1 or window.height < 1:
                raise ProfileError("The bbox intersection is smaller than one source pixel.")
            out_height, out_width = output_shape(window, args)
            output_transform = source.window_transform(window) @ Affine.scale(
                window.width / out_width, window.height / out_height
            )
            masked = source.read(
                args.band,
                window=window,
                out_shape=(out_height, out_width),
                resampling=RESAMPLING[args.resampling],
                masked=True,
            )
            band_scale = source.scales[args.band - 1] if source.scales else 1.0
            band_offset = source.offsets[args.band - 1] if source.offsets else 0.0
            vertical_scale = args.vertical_scale if args.vertical_scale is not None else (band_scale or 1.0)
            vertical_offset = args.vertical_offset if args.vertical_offset is not None else (band_offset or 0.0)
            elevation = np.asarray(masked.filled(np.nan), dtype=np.float64)
            elevation = elevation * vertical_scale + vertical_offset
            valid = ~np.ma.getmaskarray(masked) & np.isfinite(elevation)
            driver = source.driver
    except ProfileError:
        raise
    except RasterioError as exc:
        raise ProfileError(
            f"GDAL could not open/read {input_path}. For detached PDS products, keep the label beside the IMG: {exc}"
        ) from exc

    dx_by_row, dy = cell_spacings(output_transform, source_crs, out_height, body, args.pixel_size_m)
    slope, roughness = terrain_metrics(elevation, valid, dx_by_row, dy, args.roughness_window)
    output_bounds = array_bounds(out_height, out_width, output_transform)
    precision = args.precision
    document = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "site": {"id": args.site, "name": name, "type": site_type, "body": body},
        "source": {
            "input_file": os.path.relpath(input_path, PROJECT_ROOT).replace(os.sep, "/")
            if input_path.is_relative_to(PROJECT_ROOT) else str(input_path),
            "driver": driver,
            "band": args.band,
            "dataset_id": dataset_id,
            "dataset": dataset,
            "sha256": None if args.skip_checksum else sha256_file(input_path),
            "vertical_scale": float(vertical_scale),
            "vertical_offset": float(vertical_offset),
        },
        "spatial": {
            "crs": crs_metadata(source_crs),
            "transform": affine_values(output_transform),
            "requested_bbox": [float(value) for value in bbox],
            "requested_bbox_crs": bbox_crs,
            "output_bbox_native": [float(value) for value in output_bounds],
            "width": out_width,
            "height": out_height,
            "resolution_m": {
                "x": round(float(np.mean(dx_by_row)), precision),
                "y": round(dy, precision),
                "x_min": round(float(np.min(dx_by_row)), precision),
                "x_max": round(float(np.max(dx_by_row)), precision),
            },
        },
        "terrain": {
            "elevation_m": rounded_grid(np.where(valid, elevation, np.nan), precision),
            "slope_deg": rounded_grid(slope, precision),
            "roughness_rms_m": rounded_grid(roughness, precision),
            "roughness_window_cells": args.roughness_window,
        },
        "statistics": {
            "valid_cell_count": int(np.count_nonzero(valid)),
            "nodata_cell_count": int(valid.size - np.count_nonzero(valid)),
            "elevation_m": rounded_stats(finite_stats(np.where(valid, elevation, np.nan)), precision),
            "slope_deg": rounded_stats(finite_stats(slope), precision),
            "roughness_rms_m": rounded_stats(finite_stats(roughness), precision),
        },
    }
    return document, output


def write_document(document: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(f".{output.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(document, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write("\n")
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)


def main(argv: Sequence[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        document, output = extract(args)
        write_document(document, output)
    except (ProfileError, OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(
        f"Wrote {document['spatial']['width']}x{document['spatial']['height']} terrain profile "
        f"with {document['statistics']['valid_cell_count']} valid cells to {output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
