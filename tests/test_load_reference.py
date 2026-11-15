"""Offline checks for scripts/supabase/load_reference.py: no network, no raw downloads."""
import json
import math
from pathlib import Path

import pytest

from scripts.supabase import load_reference as loader

ROOT = Path(__file__).resolve().parents[1]


def test_normalise_lon_is_east_positive_within_180():
    assert loader.normalise_lon(358.1489) == pytest.approx(-1.8511)
    assert loader.normalise_lon(77.4) == pytest.approx(77.4)
    assert loader.normalise_lon(180.0) == -180.0
    assert loader.normalise_lon(-181.0) == pytest.approx(179.0)


def test_wrap_geometry_splits_a_polygon_that_crosses_the_seam():
    geometry = pytest.importorskip("shapely.geometry")
    crossing = geometry.box(170.0, -10.0, 190.0, 10.0)
    wrapped = loader.wrap_geometry(crossing)
    west, _, east, _ = wrapped.bounds
    assert west == -180.0 and east == 180.0
    assert wrapped.area == pytest.approx(crossing.area)
    assert wrapped.contains(geometry.Point(179.9, 0.0)) and wrapped.contains(geometry.Point(-179.9, 0.0))
    assert not wrapped.contains(geometry.Point(0.0, 0.0))
    inside = geometry.box(-20.0, -5.0, 20.0, 5.0)
    assert loader.wrap_geometry(inside) is inside


def test_metres_to_degrees_on_the_lunar_sphere():
    geometry = pytest.importorskip("shapely.geometry")
    half = math.pi * loader.MOON_RADIUS_M
    world = loader.metres_to_degrees(geometry.box(-half, -half / 2, half, half / 2), loader.MOON_RADIUS_M)
    assert world.bounds == pytest.approx((-180.0, -90.0, 180.0, 90.0))


def test_mars_tile_table_parses_to_90_by_45():
    tiles = loader.mars_tiles()
    assert len(tiles["offsets"]) == len(tiles["counts"]) == 4050
    assert all(count > 0 for count in tiles["counts"])


def test_unit_families_use_only_game_families():
    table = json.loads((ROOT / "supabase/functions/_shared/analog/unit-families.json").read_text(encoding="utf-8"))
    allowed = set(table["families"]) | {None}
    for body in ("Moon", "Mars"):
        units = table[body]["units"]
        assert units and table[body]["source"]
        for code, unit in units.items():
            assert unit["family"] in allowed, code
            assert unit["unit_name"] and unit["why"], code
