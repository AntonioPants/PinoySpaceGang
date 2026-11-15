# Opening art direction

Palette: void #030405, instrument charcoal #12151b, warm paper #eeeae1,
brushed gold #dfc28d, quiet text #b6b3ab. Natural planetary colours stay in the scene.
Type: self-hosted Inter for reading, DM Mono for figures and labels (both from nasa.gov) and
Michroma for the title wordmark only. No external font or image service. Buttons are neutral
paper on black; gold is for selection and the landing flag. Steep ground on the measured
terrain (over 12 deg, the standard gear's rating) carries red dots.

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

The site panel (regions on the Moon and Mars, Earth matches) is the one light surface: a solid
eggshell card with dark text (`--shell #efe9dc`, `--shell-ink #14130f`, `--shell-dim #5b574d`,
`--shell-rule #14130f24`, `--shell-wash` for hover; `--shell-score`, `--shell-found` and
`--shell-alert` are the gold, cyan and red of the dark UI darkened for paper). No blur, 4 px
radius, soft shadow. Names and the heading are Inter; indices, regions, scores and labels are DM
Mono. Rows are separated by hairlines; hover is a darker wash; the selected row is inverted (ink
background, eggshell text, gold dot). The card's main button is the inverse of the page's. Every
text colour on the card reaches 4.5:1 (the lowest is the dim text on a hovered row, 5.2:1). On a
phone the card scrolls inside itself; the page never scrolls.

One continuous shot: the simple Three.js globes (`WorldScene`) stay mounted from the title to the
terrain. The detailed Cesium globe is a layer above that fades in once it has tiles and the
fly-in has finished, with the camera handed across (same direction from the world's centre, same
distance in radii, 42 degree field of view), and fades out before the player leaves. Switching
between Google 3D and the measured terrain hands the camera pose across and cross-fades: no zoom
is replayed. If Cesium is slow or offline the player stays on the simple globe.
