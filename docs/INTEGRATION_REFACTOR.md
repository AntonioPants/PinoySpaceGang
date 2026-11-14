# Catalog and mission integration refactor

Integrated main `450d4fb`, Tim's `tim/web-catalog-fidelity`, and Eyad's
`eyad/mission-ui` on `refactor/catalog-integration`. The unrelated Field Shift
application is not part of this simulator integration.

- Both static and runtime mission consumers now use `web/src/lib/catalog.ts`.
  Removed the duplicate hardcoded unavailable Haughton/Qaidam entries from the
  static catalog projection. All eleven Earth packs are selectable; Qaidam has
  no proposed planetary pairing and remains an experimental terrain choice.
- Preserved Eyad's responsive interface, draft restoration, lazy descent view,
  and terrain identity checks alongside Tim's sensors, site-derived interference,
  seasonal weather and simulated-flight comparison.
- Consolidated terrain loading into one effect. Late fetch results cannot replace
  the selected terrain; changing settings invalidates a previously prepared mission.
- The shared terrain loader accepts either a pack directory or manifest URL,
  checks the expected ID and body, and validates all samples. Planetary comparison
  requests explicitly name the target body instead of failing Earth-only validation.
- Reused the complete catalog-details component in the mission planner. Categories,
  observations, provenance, missing values and seasonal profiles remain inspectable
  and downloadable rather than being reduced to physics inputs.
- Catalog JSON writes explicitly use LF bytes before hashing. Normalized the stale
  local Kilbourne manifest to its existing committed LF representation; no elevation
  data or scientific values were changed.
- The alternate `profileToSite` importer rejects missing/nonfinite elevations.
  It no longer creates a mean-elevation surface for missing cells.

## Verification

```powershell
# Repository root
.venv/Scripts/python -m scripts.catalog.validate
.venv/Scripts/python -m pytest -q --basetemp=.test-tmp-refactor
node scripts/catalog/check-consumers.mjs
node tests/environment.test.mjs

# web (install once with pnpm install --frozen-lockfile)
npm run build
npm test

# app/sim
npm run typecheck
npm test
```

Validated 17 sites and 13 reproducible descriptor comparisons; 85 combined web/physics
tests, 16 Python tests and four environment tests pass. Production web build passes.
The web build retains a bundle-size advisory; no interactive browser inspection was
performed. Tests exercise all eleven Earth packs through loading, export and physics,
including stale-pack rejection and the HTTP path used for planetary comparisons.

Scientific gaps are not refactoring tasks: pair-specific explanations remain partial
outside the newly documented Haughton pairing; unknown mechanics and unvalidated
analogy claims remain explicitly labelled. The six seasonal profiles do not cover
all eleven Earth sites. No new measurements or validated safety claims were added.
