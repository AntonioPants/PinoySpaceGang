# Earth location discovery index

`windows.jsonl`: 3,361 real, land-cover-filtered terrain windows, each linked to
`sources.json`; `manifest.json`: counts, rejection reasons and integrity hashes.
Schema: `../earth_index.schema.json`. Rebuild/read/stage instructions and limitations:
[Location scan handoff](../../docs/LOCATION_SCAN.md).

These are overlapping exploratory windows, not new production catalog entries.
Accuracy features, scores and rankings are deliberately absent and owned by Claude.
Original source rasters and staged packs remain under ignored `data/raw/`.
