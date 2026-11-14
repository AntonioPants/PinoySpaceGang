"""TOPSIS multi-criteria ranking (Hwang & Yoon 1981).

Two entry points:

* ``topsis(matrix, weights)`` - the textbook method on an (alternatives x criteria) matrix.
* ``TopsisFrame`` - the same maths applied to every (rotation, year) cell at once.  The
  normalisation constants and the ideal / anti-ideal points are fitted ONCE over all
  rotations and all years, so the closeness of a rotation in 1998 is directly comparable
  with its closeness in 2020 - which is what lets the replay rank by average, worst years
  and regret.  They do not depend on the weights, so "what if I changed my priorities?"
  can be answered exactly without refitting.

All criteria are benefit criteria (higher is better).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


def normalise_weights(weights) -> np.ndarray:
    w = np.asarray(weights, dtype="float64")
    w = np.where(np.isfinite(w) & (w > 0), w, 0.0)
    if w.sum() <= 0:
        return np.full(len(w), 1.0 / len(w))
    return w / w.sum()


def topsis(matrix, weights) -> np.ndarray:
    """Closeness coefficient (0-1) of each row of ``matrix`` to the ideal solution."""
    x = np.asarray(matrix, dtype="float64")
    w = normalise_weights(weights)
    norm = np.sqrt((x**2).sum(axis=0))
    norm = np.where(norm > 0, norm, 1.0)
    v = x / norm * w
    ideal, anti = v.max(axis=0), v.min(axis=0)
    d_plus = np.sqrt(((v - ideal) ** 2).sum(axis=1))
    d_minus = np.sqrt(((v - anti) ** 2).sum(axis=1))
    total = d_plus + d_minus
    return np.where(total > 0, d_minus / np.where(total > 0, total, 1.0), 0.5)


@dataclass
class TopsisFrame:
    norm: np.ndarray  # (4,) root-mean-square of each criterion
    ideal: np.ndarray  # (4,) best normalised value
    anti: np.ndarray  # (4,) worst normalised value

    @classmethod
    def fit(cls, water: np.ndarray, soil: np.ndarray, risk: np.ndarray, income: np.ndarray) -> "TopsisFrame":
        norm, ideal, anti = [], [], []
        for values in (water, soil, risk, income):
            rms = float(np.sqrt(np.mean(np.square(values, dtype="float64"))))
            rms = rms if rms > 0 else 1.0
            norm.append(rms)
            ideal.append(float(values.max()) / rms)
            anti.append(float(values.min()) / rms)
        return cls(np.array(norm), np.array(ideal), np.array(anti))

    def closeness(
        self, weights, water: np.ndarray, soil: np.ndarray, risk: np.ndarray, income: np.ndarray, chunk: int = 20000
    ) -> np.ndarray:
        """Closeness for every (rotation, year): water/risk/income are (N, Y), soil is (N,)."""
        w = normalise_weights(weights)
        n = water.shape[0]
        out = np.empty(water.shape, dtype=np.float32)
        for start in range(0, n, chunk):
            sl = slice(start, start + chunk)
            d_plus = np.zeros(water[sl].shape, dtype="float64")
            d_minus = np.zeros(water[sl].shape, dtype="float64")
            for k, values in enumerate((water[sl], soil[sl, None], risk[sl], income[sl])):
                z = values / self.norm[k]
                d_plus += (w[k] * (z - self.ideal[k])) ** 2
                d_minus += (w[k] * (z - self.anti[k])) ** 2
            d_plus, d_minus = np.sqrt(d_plus), np.sqrt(d_minus)
            total = d_plus + d_minus
            out[sl] = np.where(total > 0, d_minus / np.where(total > 0, total, 1.0), 0.5)
        return out


def worst_share_mean(values: np.ndarray, share: float = 0.2) -> np.ndarray:
    """Mean of the worst ``share`` of years for each row (conditional value at risk)."""
    n_years = values.shape[1]
    k = max(1, int(np.ceil(share * n_years)))
    part = np.partition(values, k - 1, axis=1)[:, :k]
    return part.mean(axis=1)
