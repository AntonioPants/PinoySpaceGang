from __future__ import annotations

import json
from pathlib import Path

import jsonschema


ROOT = Path(__file__).resolve().parents[1]


def test_catalog_manifest_matches_schema() -> None:
    manifest = json.loads((ROOT / "data" / "catalog_manifest.json").read_text(encoding="utf-8"))
    schema = json.loads((ROOT / "data" / "catalog_manifest.schema.json").read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(schema).validate(manifest)

