# Shared project context

Read `docs/TEAM_HANDOFF.md` and `docs/GAME_VISION.md` before changing the player journey, scenes or contracts.
This is a game built with React/Three.js, not a conventional informational website.
The current browser planner and 2D console are playable prototype stages.

- Current ownership is in `docs/TEAM_HANDOFF.md`: Eyad owns the opening; Yousef owns
  equipment/gear data; Furgan owns all cinematics and optimization; Tim owns the
  character/ship controls/physics; Antonio owns terrain matching and character debrief.
  Tim's third-person ship bridge lives in `web/src/game/interior/` and is now the
  control center. Planetary arrival and liftoff remain open cinematic slots.
- Preserve the journey: planetary target → ranked Earth analog → equipment →
  planetary arrival → ship control center → liftoff → Earth approach → descent →
  outcome → debrief. Missing cinematics skip cleanly; the console remains playable.
- Register scenes in `web/src/game/integrations.ts` using `contracts.ts`.
  Keep scene code in separate modules; do not fork the physics engine or hardcode a site.
- Scene completion and Skip use the same callback. Clean up animation loops,
  controls, listeners, audio and WebGL resources on unmount. Never autoplay audio.
- The mission is editable in the control center, then rebuilt and locked before
  liftoff. Departure body, Earth terrain, and simulated gravity/atmosphere are distinct.
- `web/public/sites.json` owns catalog IDs, coordinates, proposed pairings and evidence.
  Keep model-derived scores distinct from scientific validation or landing safety.
- Fetch/review branches before merging. Preserve teammates' work; do not force-push.
  The archived `field-shift-app` branch belongs to the previous crop project.
- From `web/`, run `pnpm build` and `pnpm test`; from root run
  `node scripts/catalog/check-consumers.mjs`. Verify the changed player flow in-browser.
