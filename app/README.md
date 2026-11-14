# Simulator application

Put the real-time frontend and physics engine here. Terrain profiles emitted by
`scripts/extract_profile.py` are stable JSON documents validated by
`data/terrain_profile.schema.json`.


The seasonal environmental adapter is in `lib/environment.mjs` with TypeScript
declarations. Run `python scripts/environment/export_web.py` from the repository
root to export the six profiles to `app/sim/viewer/public/environment/`. See
[the integration guide](../docs/environment-integration.md) for browser and Node examples.
