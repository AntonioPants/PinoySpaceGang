#!/usr/bin/env python3
"""Search Copernicus Data Space STAC and optionally download selected assets."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from pystac_client import Client


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STAC = "https://stac.dataspace.copernicus.eu/v1/"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection", required=True, help="STAC collection id.")
    parser.add_argument(
        "--bbox", nargs=4, type=float, required=True,
        metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
    )
    parser.add_argument("--datetime", help="ISO interval, for example 2024-06-01/2024-06-30.")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--asset", action="append", default=[], help="Asset key to download; repeatable.")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "data" / "raw")
    parser.add_argument("--stac-url", default=DEFAULT_STAC)
    parser.add_argument(
        "--token-env", default="COPERNICUS_TOKEN",
        help="Environment variable containing an optional bearer token for protected assets.",
    )
    parser.add_argument("--catalog-only", action="store_true", help="Print item metadata without downloads.")
    return parser.parse_args()


def safe_filename(href: str, fallback: str) -> str:
    name = Path(urlparse(href).path).name or fallback
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)


def download(href: str, destination: Path, token: str | None) -> None:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    partial = destination.with_suffix(destination.suffix + ".part")
    try:
        with requests.get(href, headers=headers, stream=True, timeout=(30, 300)) as response:
            response.raise_for_status()
            with partial.open("wb") as handle:
                for chunk in response.iter_content(1024 * 1024):
                    if chunk:
                        handle.write(chunk)
        partial.replace(destination)
    finally:
        partial.unlink(missing_ok=True)


def main() -> int:
    args = parse_args()
    if args.limit < 1:
        print("error: --limit must be positive", file=sys.stderr)
        return 2
    client = Client.open(args.stac_url)
    search = client.search(
        collections=[args.collection],
        bbox=args.bbox,
        datetime=args.datetime,
        max_items=args.limit,
    )
    items = list(search.items())
    print(json.dumps([
        {"id": item.id, "datetime": item.datetime.isoformat() if item.datetime else None,
         "assets": sorted(item.assets)} for item in items
    ], indent=2))
    if args.catalog_only or not args.asset:
        return 0 if items else 1

    args.output.mkdir(parents=True, exist_ok=True)
    token = os.environ.get(args.token_env)
    for item in items:
        for key in args.asset:
            asset = item.assets.get(key)
            if asset is None:
                print(f"warning: {item.id} has no asset '{key}'", file=sys.stderr)
                continue
            filename = safe_filename(asset.href, f"{item.id}_{key}.bin")
            destination = args.output / f"{item.id}_{filename}"
            print(f"Downloading {item.id}:{key} -> {destination}")
            download(asset.href, destination, token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

