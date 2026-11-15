# Opening art direction

Palette: void #030405, instrument charcoal #12151b, warm paper #eeeae1,
brushed gold #dfc28d, quiet text #b6b3ab. Natural planetary colours stay in the scene.
Type: self-hosted Inter for reading, DM Mono for figures and labels (both from nasa.gov) and
Michroma for the title wordmark only. No external font or image service. Buttons are neutral
paper on black; gold is for selection and the landing flag. Steep ground on the measured
terrain (over 12 deg, the standard gear's rating) carries red dots.

Layout: a full-viewport title (a Space Shuttle stack on a floodlit pad before dawn, under a
bright point, the solar system) starts on a click anywhere; there is no start button. The
shuttle launches (main engines, booster ignition and liftoff through its smoke, booster and
tank separation, about 6 s), then in one continuous move the camera flies in behind the orbiter, the
worlds appear one by one out of a soft glow, the orbiter glides ahead into a slow orbit of
Earth (staged, not to scale) without ever leaving the frame, and the labels follow. A click during the
launch skips to the burst of light. The shuttle has real proportions but is an illustration,
and the ascent is staged, not simulated (`titleFlight.ts`). The
world remains the main surface. Compact HUD text and selection controls float over
it; after site selection, collapse the list so the landscape fills the screen.
On narrow screens, controls scroll inside compact overlays; the document never scrolls.
Equipment uses three rails, then hands directly into full-viewport scenes and descent.

Distinctive moment: three actual 3D worlds in one scene, followed by a continuous
camera flight down to the selected terrain. Avoid the prior card-grid/page metaphor.
The proposed orbit-scale layout is illustrative; local elevation geometry uses real
metres and a 1:1 height scale, not procedural relief or exaggerated gameplay terrain.

Motion responds to selection. The title's pad is nearly still (venting vapour, searchlights,
tower lights); stars streak only during the launch, slow to a drift on the world overview and stop after that.
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
