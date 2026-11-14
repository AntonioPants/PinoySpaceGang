from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import rasterio
import jsonschema
from rasterio.transform import from_origin

from scripts.extract_profile import extract, parse_args, terrain_metrics, write_document


def make_dem(path: Path, *, nodata: bool = False) -> None:
    values = np.tile(np.arange(10, dtype=np.float32) * 2.0, (8, 1))
    if nodata:
        values[3, 4] = -9999.0
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=10,
        height=8,
        count=1,
        dtype="float32",
        crs="EPSG:32617",
        transform=from_origin(500_000, 8_000_000, 10, 10),
        nodata=-9999.0,
    ) as target:
        target.write(values, 1)


def cli_args(input_path: Path, output_path: Path):
    return parse_args([
        "--site", "test_plain",
        "--type", "earth_analog",
        "--body", "earth",
        "--input", str(input_path),
        "--bbox", "500000", "7999920", "500100", "8000000",
        "--bbox-crs", "native",
        "--width", "10",
        "--height", "8",
        "--roughness-window", "3",
        "--output", str(output_path),
        "--skip-checksum",
    ])


def test_extracts_projected_plane_with_expected_slope(tmp_path: Path) -> None:
    raster = tmp_path / "plane.tif"
    output = tmp_path / "profile.json"
    make_dem(raster)

    document, destination = extract(cli_args(raster, output))
    write_document(document, destination)

    assert destination == output.resolve()
    assert document["spatial"]["width"] == 10
    assert document["spatial"]["height"] == 8
    assert document["spatial"]["resolution_m"]["x"] == 10.0
    assert document["spatial"]["resolution_m"]["y"] == 10.0
    assert document["statistics"]["valid_cell_count"] == 80
    assert document["terrain"]["slope_deg"][4][5] == round(math.degrees(math.atan(0.2)), 3)
    assert document["terrain"]["roughness_rms_m"][4][5] > 0
    assert json.loads(output.read_text(encoding="utf-8"))["site"]["id"] == "test_plain"
    schema_path = Path(__file__).resolve().parents[1] / "data" / "terrain_profile.schema.json"
    jsonschema.Draft202012Validator(
        json.loads(schema_path.read_text(encoding="utf-8"))
    ).validate(document)


def test_nodata_becomes_json_null_without_poisoning_metrics(tmp_path: Path) -> None:
    raster = tmp_path / "nodata.tif"
    output = tmp_path / "profile.json"
    make_dem(raster, nodata=True)

    document, _ = extract(cli_args(raster, output))

    assert document["statistics"]["nodata_cell_count"] == 1
    assert document["terrain"]["elevation_m"][3][4] is None
    assert document["terrain"]["slope_deg"][3][4] is None
    assert document["terrain"]["slope_deg"][3][3] is not None


def test_rms_roughness_is_zero_for_flat_surface() -> None:
    elevation = np.full((5, 5), 42.0)
    valid = np.ones((5, 5), dtype=bool)
    slope, roughness = terrain_metrics(elevation, valid, np.full(5, 2.0), 2.0, 3)
    np.testing.assert_allclose(slope, 0.0)
    np.testing.assert_allclose(roughness, 0.0)

