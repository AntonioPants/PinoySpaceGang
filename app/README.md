# Simulator application

The first frontend implementation is now in `../web/`, beside the existing
`web/public/terrain/` handoff. See `../web/README.md` and `../web/INTEGRATION.md`.

Terrain profiles emitted by
`scripts/extract_profile.py` are stable JSON documents validated by
`data/terrain_profile.schema.json`.


The seasonal environmental adapter is in `lib/environment.mjs` with TypeScript
declarations. Run `python scripts/environment/export_web.py` from the repository
root to export the six profiles to `app/sim/viewer/public/environment/`. See
[the integration guide](../docs/environment-integration.md) for browser and Node examples.
