"""Rotation generator: enumerates every valid 3-year rotation."""
from .generator import (
    N_YEARS,
    SLOTS,
    RotationSpace,
    align_to,
    enumerate_rotations,
    family_gap,
    slot_difference,
    violations,
    year_pairs,
)

__all__ = [
    "N_YEARS",
    "SLOTS",
    "RotationSpace",
    "align_to",
    "enumerate_rotations",
    "family_gap",
    "slot_difference",
    "violations",
    "year_pairs",
]
