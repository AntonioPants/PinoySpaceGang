"""Enumerate ALL valid 3-year rotations (two season slots per year).

A rotation is six slots: [Y1 main, Y1 off, Y2 main, Y2 off, Y3 main, Y3 off]; the cycle then
repeats.  The off-season slot may be fallow, the main season is always cropped.

Hard rules REMOVE candidates (they are never merely penalised):

  1. season fit   only crops that passed the feasibility filter for that season
  2. family gap   the same botanical family may not return within ``gap`` season slots,
                  counted around the cycle, where gap = max(2, 2 x rest_years + 1).
                  gap 2 = never back-to-back; rest_years 1 = at least a year and a half apart;
                  rest_years >= 2 = at most once in the 3-year cycle.
  3. legume       at least one nitrogen-fixing legume per cycle
  4. taproot      when the farmer suspects compaction, at least one deep-taprooted crop

Rotations that are the same cycle started in a different year (A-B-C, B-C-A, C-A-B) are
listed once.

Implementation: a year is a (main, off) *pair*; a rotation is a triple of pair indices.  All
cross-year rules are captured in one boolean matrix ``follows[p, q]`` ("pair q may be grown
the year after pair p"), so enumeration is a few vectorised numpy operations per pair.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..crops import FALLOW, Crop

N_YEARS = 3
SLOTS = 2 * N_YEARS


@dataclass
class RotationSpace:
    pairs: list[tuple[str, str]]  # (main crop id, off crop id or "fallow")
    follows: np.ndarray  # (P, P) bool
    triples: np.ndarray  # (N, 3) int32 indices into pairs - the valid rotations
    counts: dict  # how many candidates each rule removed

    def slots(self, triple) -> list[str]:
        out: list[str] = []
        for p in triple:
            out.extend(self.pairs[int(p)])
        return out


def family_gap(crop: Crop) -> int:
    return max(2, 2 * crop.rest_years + 1)


def slot_conflict(a: Crop | None, b: Crop | None, distance: int) -> bool:
    """True when crops a and b (None = fallow) are too close together in the cycle."""
    if a is None or b is None or a.family != b.family:
        return False
    return distance < max(family_gap(a), family_gap(b))


def cyclic_distance(i: int, j: int, n: int = SLOTS) -> int:
    d = abs(i - j) % n
    return min(d, n - d)


def violations(slots: list[str], crops: dict[str, Crop], compaction: bool = False) -> list[dict]:
    """Rule check for an arbitrary six-slot rotation (used for the farmer's current rotation)."""
    found: list[dict] = []
    resolved = [crops.get(s) if s != FALLOW else None for s in slots]
    for i in range(SLOTS):
        for j in range(i + 1, SLOTS):
            a, b = resolved[i], resolved[j]
            d = cyclic_distance(i, j)
            if slot_conflict(a, b, d):
                found.append(
                    {
                        "rule": "family_gap",
                        "family": a.family,
                        "slots": [i, j],
                        "distance": d,
                        "required": max(family_gap(a), family_gap(b)),
                    }
                )
    cropped = [c for c in resolved if c is not None]
    if not any(c.n_fixing for c in cropped):
        found.append({"rule": "legume"})
    if compaction and not any(c.deep_taproot for c in cropped):
        found.append({"rule": "taproot"})
    for year in range(N_YEARS):
        if resolved[2 * year] is None:
            found.append({"rule": "main_season_cropped", "slots": [2 * year]})
    return found


def year_pairs(main_ids: list[str], off_ids: list[str], crops: dict[str, Crop], allow_fallow: bool = True):
    """All (main, off) combinations that are valid within one year."""
    pairs: list[tuple[str, str]] = []
    for m in main_ids:
        for o in list(off_ids) + ([FALLOW] if allow_fallow else []):
            off_crop = crops[o] if o != FALLOW else None
            if not slot_conflict(crops[m], off_crop, 1):
                pairs.append((m, o))
    return pairs


def follows_matrix(pairs: list[tuple[str, str]], crops: dict[str, Crop]) -> np.ndarray:
    """follows[p, q]: no family-gap conflict between year p and the following year q."""
    n = len(pairs)
    mains = [crops[m] for m, _ in pairs]
    offs = [crops[o] if o != FALLOW else None for _, o in pairs]
    out = np.ones((n, n), dtype=bool)
    for p in range(n):
        for q in range(n):
            out[p, q] = not (
                slot_conflict(offs[p], mains[q], 1)
                or slot_conflict(mains[p], mains[q], 2)
                or slot_conflict(offs[p], offs[q], 2)
                or slot_conflict(mains[p], offs[q], 3)
            )
    return out


def enumerate_rotations(
    main_ids: list[str],
    off_ids: list[str],
    crops: dict[str, Crop],
    compaction: bool = False,
    allow_fallow: bool = True,
) -> RotationSpace:
    pairs = year_pairs(main_ids, off_ids, crops, allow_fallow)
    n = len(pairs)
    follows = follows_matrix(pairs, crops) if n else np.zeros((0, 0), dtype=bool)
    legume = np.array([crops[m].n_fixing or (o != FALLOW and crops[o].n_fixing) for m, o in pairs], dtype=bool)
    taproot = np.array(
        [crops[m].deep_taproot or (o != FALLOW and crops[o].deep_taproot) for m, o in pairs], dtype=bool
    )

    chunks: list[np.ndarray] = []
    gap_valid = 0
    for i in range(n):
        later = np.arange(i, n)
        j = later[follows[i, later]]  # second year: any pair >= i that may follow i
        k = later[follows[later, i]]  # third year: any pair >= i that i may follow
        if not len(j) or not len(k):
            continue
        jj, kk = np.nonzero(follows[np.ix_(j, k)])
        second, third = j[jj], k[kk]
        # keep one representative per cycle: the triple whose first element is its minimum
        canonical = (third > i) | ((second == i) & (third == i))
        second, third = second[canonical], third[canonical]
        gap_valid += len(second)
        ok = legume[i] | legume[second] | legume[third]
        if compaction:
            ok &= taproot[i] | taproot[second] | taproot[third]
        second, third = second[ok], third[ok]
        if len(second):
            chunks.append(np.column_stack([np.full(len(second), i), second, third]).astype(np.int32))

    triples = np.concatenate(chunks) if chunks else np.zeros((0, 3), dtype=np.int32)
    # distinct cycles before any rule: (P^3 + 2P) / 3 by Burnside's lemma
    unconstrained = (n**3 + 2 * n) // 3
    counts = {
        "main_season_crops": len(main_ids),
        "off_season_crops": len(off_ids),
        "year_pairs": n,
        "cycles_before_rules": int(unconstrained),
        "after_family_gap_rule": int(gap_valid),
        "after_legume_and_taproot_rules": int(len(triples)),
        "valid_rotations": int(len(triples)),
    }
    return RotationSpace(pairs=pairs, follows=follows, triples=triples, counts=counts)


def align_to(slots: list[str], reference: list[str]) -> list[str]:
    """Rotate the year order of ``slots`` to match ``reference`` as closely as possible."""
    best, best_score = slots, -1
    for shift in range(N_YEARS):
        candidate = slots[2 * shift :] + slots[: 2 * shift]
        score = sum(1 for a, b in zip(candidate, reference) if a == b)
        if score > best_score:
            best, best_score = candidate, score
    return best


def slot_difference(a: list[str], b: list[str]) -> int:
    """Smallest number of differing slots over the three possible year alignments."""
    best = SLOTS
    for shift in range(N_YEARS):
        candidate = a[2 * shift :] + a[: 2 * shift]
        best = min(best, sum(1 for x, y in zip(candidate, b) if x != y))
    return best
