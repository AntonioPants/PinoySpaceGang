"""Rotation generator: hard rules remove candidates; enumeration is complete and de-duplicated."""
from __future__ import annotations

import itertools

import pytest

from fieldshift.crops import FALLOW, load_crops
from fieldshift.rotations import enumerate_rotations, family_gap, slot_difference, violations
from fieldshift.rotations.generator import align_to, cyclic_distance, slot_conflict


@pytest.fixture(scope="module")
def crops():
    return load_crops()


def brute_force(main_ids, off_ids, crops, compaction=False):
    """Reference implementation: check every 6-slot sequence directly, keep one per cycle."""
    off_options = list(off_ids) + [FALLOW]
    seen, valid = set(), set()
    for combo in itertools.product(main_ids, off_options, main_ids, off_options, main_ids, off_options):
        slots = list(combo)
        key = min(tuple(slots[2 * s :] + slots[: 2 * s]) for s in range(3))
        if key in seen:
            continue
        seen.add(key)
        if not violations(slots, crops, compaction):
            valid.add(key)
    return valid


def test_crop_knowledge_base_is_complete(crops):
    assert 15 <= len(crops) <= 25
    for crop in crops.values():
        assert crop.sources, f"{crop.id} has no sources"
        assert abs(sum(crop.stages) - 1.0) < 0.02
        assert crop.water_need_mm[0] <= crop.water_need_mm[1]
    assert any(c.n_fixing for c in crops.values())
    assert any(c.deep_taproot for c in crops.values())


def test_family_gap_rule_values(crops):
    assert family_gap(crops["rice"]) == 2  # rest_years 0: just not back-to-back
    assert family_gap(crops["tomato"]) == 5  # rest_years 2: once per cycle
    assert cyclic_distance(0, 5) == 1 and cyclic_distance(1, 4) == 3
    assert slot_conflict(crops["rice"], crops["corn"], 1)  # both Poaceae, adjacent
    assert not slot_conflict(crops["rice"], crops["corn"], 2)
    assert not slot_conflict(crops["rice"], None, 1)


def test_generator_matches_brute_force(crops):
    main, off = ["rice", "corn", "mungbean"], ["mungbean", "tomato", "watermelon", "sunn_hemp"]
    space = enumerate_rotations(main, off, crops)
    found = {min(tuple(space.slots(t)[2 * s :] + space.slots(t)[: 2 * s]) for s in range(3)) for t in space.triples}
    assert found == brute_force(main, off, crops)
    assert len(found) == len(space.triples)  # no rotation listed twice


def test_hard_rules_remove_candidates(crops):
    space = enumerate_rotations(["rice", "corn", "mungbean"], ["mungbean", "tomato", "eggplant", "radish"], crops)
    assert space.counts["valid_rotations"] < space.counts["after_family_gap_rule"] < space.counts["cycles_before_rules"]
    for triple in space.triples:
        slots = space.slots(triple)
        assert not violations(slots, crops), slots
        assert sum(s in ("tomato", "eggplant") for s in slots) <= 1  # Solanaceae: once per cycle
        assert any(crops[s].n_fixing for s in slots if s != FALLOW)


def test_no_legume_means_no_rotation(crops):
    space = enumerate_rotations(["rice", "corn"], ["tomato", "watermelon"], crops)
    assert space.counts["valid_rotations"] == 0


def test_compaction_requires_a_taproot(crops):
    loose = enumerate_rotations(["rice", "mungbean"], ["mungbean", "radish", "watermelon"], crops)
    tight = enumerate_rotations(["rice", "mungbean"], ["mungbean", "radish", "watermelon"], crops, compaction=True)
    assert 0 < len(tight.triples) < len(loose.triples)
    for triple in tight.triples:
        assert any(crops[s].deep_taproot for s in tight.slots(triple) if s != FALLOW)


def test_current_rotation_violations(crops):
    found = {v["rule"] for v in violations(["rice", "fallow"] * 3, crops)}
    assert found == {"legume"}
    found = {v["rule"] for v in violations(["rice", "rice"] * 3, crops)}
    assert "family_gap" in found


def test_alignment_helpers():
    a = ["rice", "mungbean", "corn", "tomato", "rice", FALLOW]
    shifted = a[2:] + a[:2]
    assert slot_difference(a, shifted) == 0
    assert align_to(shifted, a) == a
