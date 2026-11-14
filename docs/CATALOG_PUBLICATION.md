# Validated catalog publication

Stop local dev servers before publication on Windows. Build in the project's
Python environment (`python -m pip install -r requirements-dev.txt`).

```sh
python -m scripts.catalog.build --offline --site haughton
python -m scripts.catalog.register --site haughton
python -m scripts.catalog.validate
node scripts/catalog/check-consumers.mjs
python -m scripts.catalog.handoff
python -m scripts.catalog.coverage
```

Omit `--offline` to retrieve missing source windows. A single-site build now
creates a **complete validated snapshot** at `data/cache/catalog/pending/ID/`.
It does not modify production. Registration imports only the requested record
and pack, recomputes pairings against current records and validates the resulting
catalog before publication. Older `ID-record.json` staging files are not consumed;
rebuild the site. Snapshots use additional disk space but stay ignored by Git.

`python -m scripts.catalog.build --offline` rebuilds all sites in staging and
publishes only if every requested terrain/environment stage and validation passes.
Remove `--offline` for retrieval. Native source windows/receipts retained in packs
can supply missing caches; their hashes are verified before reprojection. A corrupt
cache fails explicitly; investigate and reacquire it rather than rewriting its hash.
Shared metadata handling preserves curated feature measurements, adds reviewed
literature values and keeps Haughton/Qaidam feature gaps through either path.

`python -m scripts.catalog.refresh_metadata` updates reviewed literature and pairing
metadata without regenerating terrain or weather. Review measurements when changing
a study footprint: preserved literature dimensions describe named landforms, not
necessarily the crop. Terrain/weather statistics are always rebuilt from inputs.

Publication holds a sibling `.public.publish.lock`, prepares a sibling staging
directory, then renames the old directory to `.public.previous-UUID` and installs
the validated new directory. A failed second rename restores the original.
Validation/retrieval errors leave production unchanged. This is a local transaction
with a brief two-rename availability gap, not zero-downtime hosting deployment.
After a process crash, inspect any backup and lock before recovery. Do not bypass a
live writer's lock. A backup retained after a rollback failure is recoverable;
stop servers/writers and inspect both directories before restoring it.

Validation checks all inventoried assets and SHA-256 receipts, dimensions, row
order, spacing, exact GeoTIFF/float32 samples, source receipts and pair determinism.
Canonical text assets use LF through `.gitattributes`; never regenerate checksums
to hide unexplained differences. Do not run the validator with Python `-O`, which
disables its assertions.

Physics currently supports square cells: unequal X/Y spacing is rejected instead
of averaged. Both importer paths reject missing/nonfinite elevations. Supplied
roughness must be finite, nonnegative and representable as float32. Pack version 1
must declare north-first/west-first order; conversion flips rows once for physics.

Regression tests:

```sh
python -m pytest -q
cd web
npm test
npm run build
```

Coverage and remaining scientific gaps are in [DATA_COVERAGE.md](DATA_COVERAGE.md).
