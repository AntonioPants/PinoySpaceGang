# Field Shift 🌾🛰️ — PinoySpaceGang

**NASA Space Apps Challenge 2026 · "Field Shift: Adapting Farms with NASA Data"**

A decision-support tool for farmers and the agricultural advisers who support them. It
enumerates **every valid 3-year crop rotation** for a field, **replays each one through every
year of NASA weather since 1991**, ranks them by how they hold up in *bad* years (not just on
average), and turns the replay into **adaptive plans**: "check root-zone moisture on 11 Nov;
if it is above 0.88, plant X instead of Y".

Pilot: rain-fed lowland farm near **Muñoz, Nueva Ecija, Central Luzon, Philippines**
(15.72° N, 120.90° E). Works for any latitude/longitude. Languages: **English + Filipino**.

> Scores are relative comparisons between rotations — not yield or profit predictions.
> Every plan says: review it with a local agricultural adviser.

---

## 5-minute tour for judges

1. **Start** (`.\scripts\dev.ps1 offline` or `make engine-offline` + `make web`) → open http://localhost:3000.
2. **Farm setup** → "Use the pilot farm" → click through the 5 steps (map pin, current rotation
   *rice → fallow*, soil auto-filled from SoilGrids with badges, rain-fed, priority sliders) → **Run the plan**.
   The engine enumerates ~95,000 valid rotations and replays all of them through 35 years in ~2 s.
3. **Rotations** — current vs options A/B/C, score breakdown, plain-language reasons citing the
   actual numbers, the split-screen comparison slider, and the top-10 table. Switch the ranking
   between *best on average / best in bad years / least regret*.
4. **Time machine** — press *Play*: 1991 → 2025, every crop-season coloured good/stressed/failed,
   bad years highlighted in red.
5. **Adaptive plan** — the decision points, each with its evidence and a cross-validated gain,
   plus fixed-vs-adaptive replay.
6. **Why it lost** — for each non-winner, the smallest change in priorities or rainfall that
   would make it win (with a button to try those priorities).
7. **Data & confidence** — every source (observed / modelled / farmer-entered / unavailable),
   the information gaps, and the **honest backtest** against MODIS NDVI.
8. Toggle **Filipino** in the header; try the **Advisor** (voice input works in Chrome/Edge);
   open **Print / export** for the one-page plan for banks and insurers.

## What makes it different

| | Typical entry | Field Shift |
|---|---|---|
| Rotations | 3 hand-picked | **all** valid 3-year rotations (hard rules remove, never penalise) |
| Weather | climatology average | **replay through every year 1991–present** |
| Ranking | weighted average | TOPSIS on every (rotation, year) → average, **worst 20 % of years**, **regret**, win-rate vs current |
| Output | a fixed plan | **adaptive plan** with if-then decision points, tested on held-out years |
| Honesty | — | data badges on every number, explicit gaps, backtest reported even when it doesn't flatter us |

## Run it

Requirements: Python 3.11+ (developed on 3.14), Node 20+.

```powershell
# Windows
.\scripts\dev.ps1 setup
.\scripts\dev.ps1 offline   # or: start   (live data for any location)
.\scripts\dev.ps1 test
```

```bash
# macOS / Linux
make setup
make engine-offline   # terminal 1  (or `make engine` for live data)
make web              # terminal 2
make test
```

- App: http://localhost:3000 · Engine API docs: http://localhost:8000/docs
- **Offline demo**: `FIELDSHIFT_OFFLINE=1` makes the engine read only `data/snapshot/` (committed,
  pre-fetched NASA POWER 1991–2026, SoilGrids and MODIS for the pilot farm). The frontend is a PWA:
  the app shell and the last plan stay available without a connection.
- No keys are needed. Optional keys go in `.env` (copy `.env.example`): Earthdata (SMAP + ECOSTRESS)
  and `ANTHROPIC_API_KEY` (AI advisor). `.env` is git-ignored.

## Architecture

```
 web/  Next.js 14 (App Router, TS, Tailwind, Leaflet, Recharts, PWA)
   │   10 screens · i18n en/fil · localStorage farm profile + last plan
   │   /api/* ──rewrite──►
 engine/  FastAPI science engine (Python, numpy/pandas/scipy, pydantic)
   ├─ sources/      pluggable Source.fetch(lat, lon, start, end) → DataFrame, disk cache + snapshot
   │    power · smap (AppEEARS) · ecostress (AppEEARS) · modis (ORNL DAAC) · soilgrids
   ├─ climate/      FAO-56 Penman–Monteith ET0, season calendar, indicators, Theil–Sen trends
   ├─ crops/        crops.yaml — 20 crops, `sources` + `verify` per crop
   ├─ waterbalance  FAO-56 root-zone balance (Kc curve, roots, p, Ks) + FAO-33 Ky → season outcome
   ├─ feasibility   season, duration, temperature, GDD, frost, salinity, pH, water, reliability
   ├─ rotations/    vectorised enumeration of ALL valid rotations (family gaps, legume, taproot)
   ├─ scoring/      water · soil health · climate risk · income (0–100) + reasons; TOPSIS
   ├─ replay/       every candidate × every year → mean, worst-20 %, regret, win-rate
   ├─ adaptive/     decision-point search + leave-one-year-out cross-validation
   ├─ drought       flash-drought warning (wetness percentile + rate, stress index, canopy–air ΔT), field memory
   ├─ projections   10-yr soil organic carbon + N (illustrative), irrigation m³/ha
   ├─ why_lost      smallest priority or rainfall change that flips the ranking
   ├─ backtest      engine water stress vs MODIS NDVI anomaly (r, p, n, caveats)
   └─ advisor       Claude + engine tools if a key is set, otherwise rule-based answers
 data/snapshot/  pre-fetched pilot-farm data (offline demo)
```

Endpoints: `GET /api/health · /api/climate · /api/soil · /api/drought · /api/backtest · /api/crops · /api/geocode`,
`POST /api/plan · /api/advisor`. Contracts: `engine/fieldshift/models.py` → `web/lib/openapi.json`
→ `web/lib/openapi.d.ts` (`make types`); hand-written mirror in `web/lib/types.ts`.

## Data sources

| Source | What | Kind | Resolution | Login |
|---|---|---|---|---|
| NASA POWER daily (AG) | rain, T, RH, wind, radiation, GWETROOT/GWETTOP, skin T, 1991–present | modelled (MERRA-2/GEOS + CERES) | ~0.5° × 0.625° | none |
| SMAP L4 SPL4SMGP v8 (AppEEARS) | root-zone soil moisture | observed (assimilated) | 9 km | Earthdata (optional) |
| ECOSTRESS LST + ESI (AppEEARS) | canopy temperature, evaporative stress | observed | 70 m | Earthdata (optional) |
| MODIS MOD13Q1 v6.1 (ORNL DAAC) | NDVI 2001–present | observed | 250 m, 16-day | none |
| ISRIC SoilGrids 2.0 | pH, SOC, N, clay/sand/silt, bulk density, CEC (0–30 cm) | modelled | 250 m | none |

If a source fails, the app says "unavailable" and why; it never fills values in silently.
Short gaps (≤ 5 days) in daily weather are interpolated **and counted** in the data page.

## Real data vs fallback in this build

- **Real**: NASA POWER (13,099 days, 1991-01-01 → 2026-11-11), SoilGrids (silty clay, pH 6.4,
  SOC 13.9 g/kg), MODIS NDVI (594 composites 2001 → 2026-10) — all fetched live and snapshotted.
- **Fallback**: SMAP and ECOSTRESS need Earthdata credentials, which this repo does not contain.
  Without them the engine uses POWER GWETROOT for root-zone moisture and a POWER-derived stress
  index / skin-minus-air temperature, each labelled "modelled". The AppEEARS client is written
  to the public API docs but **has not been exercised with real credentials** — test it once you
  add your own token.
- **Backtest (pilot farm)**: dry season r = 0.74 (p < 0.001, n = 26) between the engine's water
  satisfaction and MODIS NDVI anomaly; wet season r = 0.07 (not significant — wet-season greenness
  around the pin is not water-limited, and irrigated fields mix in). Reported as-is in the app.

## Agronomy values to double-check

Everything in `engine/fieldshift/crops/crops.yaml` has a `sources` block; values sourced "TEAM"
are prototype estimates, and each crop lists the least certain fields under `verify`. Priorities:

1. **Income bands (0–5)** for every crop — a team guess, not market data.
2. **Ky** for crops not in FAO-33 (rice, eggplant, squash, bitter gourd, okra, sweet potato, radish, sesame, sunn hemp).
3. **N credits** of legumes (mungbean 30, peanut 35, cowpea 35, sunn hemp 80 kg N/ha) and N demands.
4. **Salinity thresholds** for mungbean, garlic, squash, watermelon, okra, sesame, sunn hemp.
5. Damage coefficients in `waterbalance.py`: heat (−2 %/day above crop limit), waterlogging
   (tolerance-scaled, 25-day full effect), storm days (≥ 100 mm rain or ≥ 8 m/s mean wind; −12 %/day,
   paddy −6 %), paddy percolation by texture, 150 mm supplemental-irrigation cap, 60 % irrigation efficiency.
6. Soil-carbon model: 20 % humification, decay calibrated so the current rotation is stable
   (bounded 0.4–5 %/yr); residue carbon per crop.
7. Season calendar: sowing 30 days into the wet window (31 May) and 10 days into the dry window (11 Nov).
8. Filipino translations — to be reviewed by a native-speaking extension worker.

## Limitations

- Weather is a ~55 km grid cell, not a farm station; grid rain can be biased and local typhoon
  damage is only proxied (extreme rain / wind days). Floods from rivers, pests, diseases and
  markets are not modelled.
- Season outcomes are a transparent index from a water balance and damage rules — not a crop model,
  not yields. Income is a relative index from bands.
- Decision points use NASA POWER signals; with ~35 years, rules are kept only if they still help
  on held-out years, and many slots honestly end up with "no reliable signal".
- When more than 250,000 rotations are valid (e.g. irrigated farms), the best 250,000 by average
  weighted score go through the year-by-year replay; the app says so.
- The frontend was verified with a production build, type-check and HTTP checks of every route;
  please click through it on a phone before the demo.

## Tests

`make test` / `.\scripts\dev.ps1 test` — 57 engine tests on synthetic fixtures (no network):
ET0 against FAO-56 worked examples, gap handling, season detection, texture triangle, source
parsing and failure modes, generator vs brute force, hard rules, TOPSIS, replay statistics,
adaptive cross-validation, planner and HTTP endpoints, en/fil message parity.

## Inspiration

We studied **[BlinkFarms-NASA-SpaceApps](https://github.com/umar-essayed/BlinkFarms-NASA-SpaceApps)**
by umar-essayed (a fellow Space Apps 2026 team) for architecture and feature ideas: a Next.js
front end with a separate Python science engine, a farm-setup wizard, crop feasibility filtering,
rotation rules with legume N credits and taproot crops for compaction, TOPSIS ranking, FAO-56 water
balance, ECOSTRESS-based flash-drought warning, SMAP "field memory", data-source badges, a
comparison slider, PWA offline mode, and an AI advisor with voice input. **No code, text, data,
crop tables or assets were copied** — everything here was written from scratch, and our backtest
numbers are our own.

## Team

PinoySpaceGang — NASA Space Apps Challenge 2026.
