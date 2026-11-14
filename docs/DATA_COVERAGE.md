# Per-location data coverage

Generated with `python -m scripts.catalog.coverage`. Values remain in `web/public/sites.json`; this is a coverage inventory, not a second science catalog.

| Site | Known condition records | Unknown / inapplicable | Seasonal weather | Missing landform measurements |
|---|---:|---|---|---|
| meteor-crater | 11 | 3 unknown; 0 N/A | 2015-2024 regional | rim_continuity |
| badwater | 11 | 3 unknown; 0 N/A | 2015-2024 regional | wet_dry_state, salt_mineral_fractions |
| barrow-observatory | 11 | 3 unknown; 0 N/A | 2015-2024 regional | polygon_size, active_layer_depth, ground_temperature |
| phoenix | 7 | 7 unknown; 0 N/A | not ingested | No dedicated fields defined |
| kilbourne-hole-v1 | 11 | 3 unknown; 0 N/A | 2015-2024 regional | crater_diameter, depth_diameter_ratio, rim_relief |
| craters-moon | 11 | 3 unknown; 0 N/A | not ingested | No dedicated fields defined |
| lava-beds | 11 | 3 unknown; 0 N/A | not ingested | No dedicated fields defined |
| amboy | 11 | 3 unknown; 0 N/A | 2015-2024 regional | flow_morphology |
| white-sands | 11 | 3 unknown; 0 N/A | 2015-2024 regional | dune_height, crest_spacing, crest_orientation, migration |
| capitol-reef | 11 | 3 unknown; 0 N/A | not ingested | No dedicated fields defined |
| jezero | 7 | 7 unknown; 0 N/A | not ingested | No dedicated fields defined |
| bagnold | 7 | 7 unknown; 0 N/A | not ingested | No dedicated fields defined |
| arsia-flank | 7 | 7 unknown; 0 N/A | not ingested | No dedicated fields defined |
| marius-hills | 9 | 5 unknown; 2 N/A | not ingested | No dedicated fields defined |
| shackleton-rim | 9 | 5 unknown; 2 N/A | not ingested | No dedicated fields defined |
| haughton | 11 | 3 unknown; 0 N/A | not ingested | crater_diameter, rim_geometry, ground_ice_depth |
| qaidam | 11 | 3 unknown; 0 N/A | not ingested | yardang_height, yardang_width, yardang_orientation, surface_material_fractions |
| lucus-planum | 7 | 7 unknown; 0 N/A | not ingested | No dedicated fields defined |

## Interpretation and remaining work

- All eleven Earth records contain 2024 POWER regional context. Only six have the separate 2015-2024 seasonal weather profiles; annual means do not provide seasonal wind vectors.
- Marius Hills and Shackleton have Diviner cumulative bolometric-temperature bins (2009-2015). These are not instantaneous ground temperatures or footprint extrema. Lunar atmospheric wind and air temperature are physically inapplicable.
- Mars weather/albedo remain unknown in this catalog. Earth weather must not be silently applied to Mars.
- Friction, cohesion and bulk density remain unknown for every site. Soil-survey context, basalt labels and DEM roughness do not establish contact mechanics. Vehicle/contact defaults belong in explicit simulation settings.
- Unknown does not necessarily mean access blocked: landform boundaries, dune migration, active-layer depth and strength require a suitable scientific method and spatially matched measurements. Obtain those before replacing nulls.
- Earthdata authenticated products and RCM access remain separate acquisition work; see DATA_SOURCES_AND_GAPS.md for provider-specific steps. No new radar or MODIS ingestion is claimed.
- Amboy cone dimensions and Kilbourne short/long dimensions are approximate literature values. They are separate from crop statistics and are not included in similarity scoring.
- Haughton, Qaidam, Craters of the Moon, Lava Beds and Capitol Reef still need seasonal profiles if seasonal scenarios are required. Do not replace the existing ten-year baseline with a short demonstration fetch.
- Empty feature lists mean no feature-specific extraction is defined, not that the site is scientifically complete. Pairings and engineering scores remain unvalidated.
