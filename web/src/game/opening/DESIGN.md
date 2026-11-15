# Opening art direction

Palette: void #030405, instrument charcoal #12151b, warm paper #eeeae1,
brushed gold #dfc28d, quiet text #b6b3ab. Natural planetary colours stay in the scene.
Typeface: the existing self-hosted IBM Plex Sans, light large titles and compact
readable controls. No new decorative display typeface or external image service.

Layout: a full-viewport title (a ship racing through streaking stars towards a bright point,
the solar system) starts on a click anywhere; there is no start button. The camera then
flies in, the worlds appear out of a burst of light, and their labels follow. The
world remains the main surface. Compact HUD text and selection controls float over
it; after site selection, collapse the list so the landscape fills the screen.
On narrow screens, controls scroll inside compact overlays; the document never scrolls.
Equipment uses three rails, then hands directly into full-viewport scenes and descent.

Distinctive moment: three actual 3D worlds in one scene, followed by a continuous
camera flight down to the selected terrain. Avoid the prior card-grid/page metaphor.
The proposed orbit-scale layout is illustrative; local elevation geometry uses real
metres and a 1:1 height scale, not procedural relief or exaggerated gameplay terrain.

Motion responds to selection. The one ambient motion is the title's flight (the ship weaving,
stars streaking); the stars slow to a drift on the world overview and stop after that.
Everything selectable answers the pointer: worlds brighten, list rows slide and light their
region on the globe, and regions fill gold. Sites are drawn as square study-area outlines,
enlarged to be visible from orbit (real footprints are a few kilometres across). Use reduced-motion
preferences, keyboard equivalents and an optional fullscreen control.

Review of the earlier design: the detached rectangular DEM and padded flight container
still read as a website. Replaced them with geographically registered curved ground,
an above-Earth camera path, and a renderer that fills the game viewport. The outer
ground and atmosphere are illustrative context; only the DEM footprint is measured.
The ground around the footprint is generated: it continues the patch's tilt and edge heights
and is as rough as the measured land along that edge. It never repeats a landmark.

Descents to the ground swing around the site while looking at it (`siteSwoop`), so the view
tilts over gradually instead of dropping straight down and turning at the end. On the terrain
the player flags a landing point inside the outlined area; the descent flies to it.

Launch Journey
plays a latch click, lifts the lander off the pad with a whoosh and closes to black.
