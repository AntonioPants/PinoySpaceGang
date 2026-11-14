# Registered exploratory windows

The first shortlist has 52 distinct windows registered alongside the original
50 Earth sites: 102 Earth, 4 Moon and 5 Mars records. Research proposals retain
priority; not every registered window enters a target's ten displayed candidates.

Registration preserves `morphology: unknown`, `substrate: unknown`, empty `matches`,
and the accuracy owner's `inferred_landforms`. Region seeds and sources are
recorded in each pack's receipt. Weather and mechanics remain unknown. No scoring
weights, cutoff or frozen scales are changed.

```sh
python -m scripts.locations.register stage
# Stop repository dev servers before publication.
python -m scripts.locations.register publish
python -m scripts.catalog.scan_matches
python -m scripts.catalog.coverage
python -m scripts.catalog.validate
python -m pytest -q
cd web
pnpm test
pnpm build
```

Staging reads one snapshot of `data/earth_index/matches.json`, deduplicates window
IDs, builds real packs, verifies all shortlist scores with the unchanged matcher,
and validates a complete catalog. Publication rejects changed production catalogs
or frozen scales. `data/earth_index/registration.json` preserves the selected
snapshot after the remaining shortlist is refreshed. Repeatedly registering new
shortlists is an explicit new batch, never an automatic loop.

The validator allows unpaired Earth terrain only for explicit regional scans with
traceable seed labels and matching pack receipts. Full curated catalog rebuilds
retain registered scans. The app labels the regional landform inference unreviewed.

This supersedes the pre-registration blockers in LOCATION_SCAN.md. The entire
3,361-window index is not published; only the selected real packs are installed.
