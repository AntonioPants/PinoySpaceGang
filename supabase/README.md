# Click-anywhere matching service (Supabase)

The game's only server. Everything else is static files. A player pins any point on the Moon
or Mars; this service reads the terrain there, scores it against every Earth site with the
published analog score, and returns the ranking with the terrain window.

Results for a clicked point are a weaker class of evidence than the curated pairings: on
demand, unreviewed, not validated. See `docs/ANALOG_MATCHING.md`.

## What is deployed

Project `analog-atlas`, ref `mnbnprnvtzetyjuatpez`, region eu-west-1 (free tier).

| Thing | What it is |
|---|---|
| Edge function `match-analog` | `POST https://mnbnprnvtzetyjuatpez.supabase.co/functions/v1/match-analog` with `{ "body": "Moon" \| "Mars", "lat": number, "lon": number }`. JWT verification is on; the browser sends the public anon key. Source: `functions/match-analog/index.ts` and `functions/_shared/analog/`. |
| Edge function `probe` | Throwaway preflight from the build: range-reads 16 bytes of each elevation mosaic and reports status and timing. Safe to delete in the dashboard. |
| Table `analog_click_cache` | One row per snapped point (0.01 degrees) and method version, holding the whole response. |
| Table `analog_assets` | Reference data the function loads at cold start: `earth-vectors`, `mars-tiles`, `unit-families` (copies of the files beside the shared modules). |
| Tables `geology_units`, `gazetteer` | USGS global geologic map polygons (Mars SIM 3292 1:20M; Moon Unified Geologic Map 1:5M) and IAU gazetteer centre points. PostGIS, in schema `extensions`. |
| SQL function `click_context(body, lat, lon)` | Map unit and nearest or enclosing named feature for a point. Service role only. |

All tables have row-level security on and no policies: only the function (service role, from
its own environment) reads and writes them. No secret is in this repository; `web/.env` holds
the project URL and the public anon key only.

## Request and response

The point is snapped to 0.01 degrees and the snapped point is used for everything. The response
shape is in `docs/QUEST.md` (C3) and typed in `web/src/lib/analogClick.ts`. Errors are JSON
`{ code, message }` with a sentence a player can read:

| Code | HTTP | When |
|---|---|---|
| `bad_request` | 400 | Not JSON, not the Moon or Mars, not numbers |
| `out_of_range` | 422 | Outside -90..90 / -360..360, or within 0.1 degrees (Moon) or 0.3 degrees (Mars) of a pole |
| `no_data` | 422 | The mosaic has a gap in the window. Never filled. |
| `upstream_unreachable` | 502 / 503 | The elevation archive or the reference data could not be read |

## How a point is scored

1. `fetchPack` builds the same 33 x 33 azimuthal-equidistant window the Python pack builder
   makes (150 m cells on the Moon, 500 m on Mars) from HTTP range reads of the USGS LOLA and
   MOLA global mosaics. About 45 small requests on the Moon, 1 to 4 tiles on Mars.
2. `packFeatures`, `rank`: the TypeScript port of the published descriptors and analog score,
   against the Earth vectors exported by `scripts/catalog/export_click_vectors.py`.
3. `click_context`: the geologic map unit under the point, translated to a landform family by
   `functions/_shared/analog/unit-families.json` (reviewed by nobody), discounted to 75% like
   any unreviewed inferred label. No family means the ranking is terrain-only and says so.
4. The nearest or enclosing IAU feature names the point.

Parity is tested in `web/src/lib/analogParity.test.ts` (always) and
`web/src/lib/analogReaders.test.ts` (`ANALOG_NETWORK=1`), and end to end by `verify.ts`.

## Verify

```
node supabase/verify.ts
```

Calls the deployed function for six points and requires its grid to be byte-identical to, and
its ranking equal to, what this machine computes from the same modules; then checks the cache,
the error codes and the published figures for Jezero and Marius Hills.

## Redeploy

With the Supabase CLI (not installed on the build machine; needs a personal access token):

```
supabase functions deploy match-analog --project-ref mnbnprnvtzetyjuatpez
```

The build machine deployed through the Supabase connector instead, as one bundled file:

```
node web/node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild supabase/functions/match-analog/index.ts --bundle --format=esm --minify --target=es2022 --charset=ascii --outfile=match-analog.js
```

Bump `CLICK_VERSION` in `index.ts` whenever a response can change, so old cache rows are not
served. After any deploy run `node supabase/verify.ts`.

Reference data and maps are loaded by `scripts/supabase/load_reference.py` (see its header). It
posts to a token-guarded loader function, `quest_upload`. That loader is now closed: it rejects
every call and the public roles cannot execute it (migration `close_quest_upload`). To reload
data, replace it with a new token-guarded version (the original is in the migration history as
`analog_assets_geology_gazetteer`) and close it again afterwards. It was closed rather than
dropped because a drop needs a person to confirm it in the dashboard: `drop function
public.quest_upload(text, text, jsonb);` is safe to run.

## Platform limits (Supabase docs, read 2026-11-15)

Edge functions: 256 MB memory, 2 s CPU time per request (network waits do not count), 150 s
wall clock on the free plan (400 s paid), 150 s request idle timeout, 20 MB function size.
A scored point takes about 1 to 2.5 s wall clock uncached and about 0.1 s cached. The preflight
measured about 0.65 s for one range read of either mosaic from eu-west-1.

Free-tier projects pause after a week without traffic: restore the project in the dashboard
before a demo. If the service is down the game says so and the nine curated regions work as
before.
