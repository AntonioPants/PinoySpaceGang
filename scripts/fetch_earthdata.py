#!/usr/bin/env python3
"""Search and download a small NASA Earthdata subset."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import earthaccess


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--short-name", default="NASADEM_HGT")
    parser.add_argument(
        "--bbox", nargs=4, type=float, required=True,
        metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
    )
    parser.add_argument("--count", type=int, default=5)
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "data" / "raw")
    parser.add_argument(
        "--auth-strategy", choices=("environment", "netrc", "interactive"), default="netrc",
        help="Earthdata Login authentication source.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.count < 1:
        print("error: --count must be positive", file=sys.stderr)
        return 2
    if args.bbox[0] >= args.bbox[2] or args.bbox[1] >= args.bbox[3]:
        print("error: bbox minima must be smaller than maxima", file=sys.stderr)
        return 2
    args.output.mkdir(parents=True, exist_ok=True)
    earthaccess.login(strategy=args.auth_strategy)
    results = earthaccess.search_data(
        short_name=args.short_name,
        bounding_box=tuple(args.bbox),
        count=args.count,
    )
    print(f"Found {len(results)} NASA granule(s).")
    if not results:
        return 1
    downloaded = earthaccess.download(results, local_path=str(args.output))
    for path in downloaded:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

