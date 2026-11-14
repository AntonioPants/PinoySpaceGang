# Vintage NASA UI/UX Design Framework (NHB 1430.2 edition)

**Planetary Analog Landing Simulator: mission planner, descent console and flight report**

Adapted from the team's framework for the hackathon flight console, which is grounded in the
January 1976 NASA Graphics Standards Manual (NHB 1430.2). Section numbers refer to that manual
and are carried over from the source framework; they have not been re-checked against the
manual itself.

This is a visual style inspired by the manual. The product is an independent Space Apps entry:
it never shows the NASA logotype, insignia or seal, and it uses the team's own marks.

---

## 1. Architectural philosophy and visual laws (Sec. 1)

The simulator has to answer two questions within three seconds of looking at a screen:

- **Is this Earth site a fair stand-in for the planetary target?**
- **Did the lander make it, and if not, why?**

Every screen (Destination, Earth analog, Configure, Descent, Report) follows the manual's three
principles: unity, technological precision and forward thrust.

### 1.1 Monolinear geometry and the 3-unit grid (Sec. 1.1, 1.7)

- **Uniform stroke weight.** Icons, terrain contours, trajectory lines, pairing connectors and
  dividers share one monolinear stroke width tied to a modular grid.
- **3-unit clear space.** Primary containers and headers keep a clear-space buffer of three
  stroke widths on all four sides.
- **Directional thrust.** The journey reads left to right without interruption: planetary
  target on the left, Earth analog in the middle, flight outcome on the right. Controls that
  break that flow are removed.

### 1.2 The nine prohibitions (Sec. 1.6)

1. **No pattern overlays.** No hatching, noise or decorative textures on cards, headers or the
   hazard map.
2. **No enclosing circles.** Site identifiers and status badges never sit in round medallions
   or pills.
3. **No box around the product mark.** The stem-word title stands free on its baseline.
   Technical diagrams are the exception and are always boxed (Sec. 5.8).
4. **No hollow outlined titles.** Titles are solid, high-contrast fills.
5. **No drop shadows or 3D extrusion.** Hierarchy comes from scale, grid alignment and value
   contrast only. This applies to the globe and terrain frames too.
6. **No stretching or skewing.** Icons, type and badges keep a 1:1 aspect ratio at every
   breakpoint. Terrain is never stretched horizontally; vertical exaggeration is a labelled
   number, never a silent distortion.
7. **No light tints of the alert colour.** NASA Red appears at 100% or not at all.
8. **No darkened elements on dark surfaces.** In a dark focus state, active foreground elements
   switch to pure white.
9. **No rotated text.** Axis labels on the transect, the altitude tape and the terrain frame
   all read horizontally.

### 1.3 Separate zones for personality and telemetry (Sec. 1.8)

- The team emblem and project nickname live in an isolated **Mission Patch Bay**, apart from
  site data and flight controls.
- **Cutscenes are a personality zone too.** The approach and outcome cutscenes take the whole
  frame, with no telemetry chrome over them, and hand back to the operational grid when they
  end. Cinematic style and instrument style never share a screen.

### 1.4 Operational mode and ceremonial mode (Sec. 1.9, 8.1)

- **Operational mode** covers all five screens during planning and flight: the stark 1976 grid.
- **Ceremonial mode** appears only on a successful touchdown. The report offers a "Mission
  Accomplished" flight certificate with the team's own crest, the target and analog names, the
  touchdown numbers and the fidelity scores. It is never shown beside the operational header,
  and it never uses the NASA seal.

---

## 2. Colour architecture and polarity (Sec. 1.3–1.5, 7.1)

### 2.1 Surface and ink tokens

| Token | Role in the simulator |
|---|---|
| **Federal White** (#17886) | Viewport canvas and the background of every technical diagram: transect, terrain map, descent view, charts |
| **NASA Red** | The alert colour, reserved for: a crash or tip-over outcome, a touchdown limit exceeded, unsafe ground on the hazard map, a hazard detection, and NO-GO |
| **NASA Warm Gray** (#16165) | Secondary panels, sites without a pairing, sites awaiting data, past trajectory, de-emphasised chrome |
| **Federal Blue** (#15102) | The telemetry band of the masthead only, paired with white |
| **Carbon Black** | Hairlines, diagram frames, terrain contours, body type on light surfaces |

### 2.2 The 40% gray-scale polarity law (Sec. 7.1, 7.2)

- On surfaces at or below 40% gray, all type, icons and lines are 100% black.
- On surfaces above 40% gray, they invert to 100% white.
- NASA Red appears only on white or near-white (under 15% gray).

**Consequence for terrain.** A gray hillshade cannot carry red. Terrain maps are therefore
drawn as black contour lines on white, and unsafe ground (slope or roughness over the vehicle's
limit) is a solid red fill on that white ground. The 3D terrain explorer uses neutral gray
shading with no red; hazards are shown on the 2D map.

### 2.3 The chromatic-conflict rule (Sec. 7.10)

When a view carries its own colour (globe textures, satellite imagery, the Mars surface), the
surrounding chrome shifts to Warm Gray and black. Red stays an uncontested signal for real
problems. The Mars globe never borrows the alert red.

### 2.4 Banned treatments (Sec. 5.2)

No pastel or low-contrast tints on status plaques, provenance badges or chart regions. Every
state is a solid fill or a crisp outline.

---

## 3. Four-tier typography (Sec. 1.2, 3.3, 5.3–5.6)

### 3.1 Tier 1: interface and signage (Helvetica Light and Medium)

- **Parent-to-child emphasis (Sec. 1.2).** The planetary body or region is set in Helvetica
  Light; the specific site sits directly beneath in Helvetica Medium. Example: "Lunar south
  pole" in Light above "Shackleton rim" in Medium. The working context gets the weight.
- **Controls (Sec. 6.2).** Buttons, stage tabs and status plaques are Helvetica Medium with
  normal letter-spacing.

### 3.2 Tier 2: catalogue IDs, coordinates and telemetry (Futura Light and Demibold)

- Used only for site IDs (`shackleton-rim`), coordinates (89.55° S), grid spacing, telemetry
  numbers (altitude, sink rate, fuel, throttle) and scores.
- Futura is set 1pt larger than adjacent Helvetica to match its x-height.
- Helvetica headings never sit inside Futura data blocks; Futura Light values pair with Futura
  Demibold labels.

### 3.3 Tier 3: dense logs and limitations (Times Roman and Bold)

- The flight event log, failure reasons, each terrain pack's limitations list and import
  errors. These are the long, utilitarian reading zones.

### 3.4 Tier 4: enduring documentation (Garamond and Bold)

- The "Data, evidence and limitations" panel, the scoring-method notes in the report, and the
  certificate text. Garamond Bold is light, so its headings are larger with more white space.

### 3.5 Alignment and text rules (Sec. 2.6, 3.3)

- Flush left, ragged right everywhere. No centred text in operational screens.
- No paragraph indents. Paragraphs are separated by a full line break.

### 3.6 Web fonts

Helvetica and Futura are licensed fonts. Use the system Helvetica where present, with Arial as
the fallback; Jost as the open substitute for Futura; system Times; EB Garamond for Garamond.

---

## 4. Spatial grid and viewport anatomy (Sec. 5.14–5.20, 7.3)

### 4.1 Master grid

- **Outer margin folios (Sec. 5.14).** Global coordinates sit in the outside margins: the stage
  number (01–05), the mission ID and the mission clock. Before launch the clock shows UTC;
  during descent it shows mission elapsed time (T+).
- **Vertical reading (Sec. 5.2).** Site lists and the configurator scroll in single vertical
  columns. No horizontal carousels.

### 4.2 Masthead: white band over blue band (Sec. 7.3)

- **Upper white band.** The stem-word title "ANALOG // ATLAS" in a bold geometric mark plus
  Helvetica Light, with 3x clearance. The Mission Patch Bay sits at the far right.
- **Lower Federal Blue band.** Reversed white telemetry: TARGET, EARTH ANALOG, SCENARIO GRAVITY,
  AIR DENSITY, and a binary flight status. "GO" is white on blue. "NO-GO" is a red-on-white
  alert block, shown when the configuration cannot fly (thrust below weight, weather not
  loaded) or the flight ended in a crash or tip-over.

### 4.3 Primary viewport: the enclosed technical diagram (Sec. 5.8, 5.17)

- **Solid outline frame.** Every diagram sits in a 1px black rectangle on white: the globe, the
  terrain map, the transect, the descent view.
- **Coordinate ticks.** The inner border carries tick marks in real units: metres along the
  terrain, metres of altitude, degrees on the globe.
- **White breathing band (Sec. 5.17a).** A clear strip across the top of the frame holds the
  view toggles and never overlaps the drawing:
  - Earth analog screen: GLOBE, 3D TERRAIN, TRANSECT.
  - Descent screen: SIDE VIEW, TOP VIEW, playback speed.

### 4.4 Secondary column (right of a 1px vertical rule)

Two stacked modules, separated by 1px horizontal rules (Sec. 5.17b):

1. **Site directory (top).** Modelled on the lobby directory boards of Sec. 6.2: one slat per
   site. On the Earth analog screen the slats are ordered by the catalogue's proposed pairings,
   best terrain score first.
2. **Flight plan (bottom).** What to do next for the current stage: the next required choice
   in the configurator, or the live telemetry tape during descent.

### 4.5 Bottom CAPCOM teletype strip (Sec. 3.5, 4.1)

A collapsible 96px footer that prints the physics events as they happen, each prefixed with
mission elapsed time, ending in "-more-" when there is more to read:

```
T+024.9  HAZARD AT AIM POINT  SLOPE 12.3 DEG
T+024.9  DIVERT 8.0 M
T+039.7  DUST KICK-UP AT 30 M
T+055.3  TOUCHDOWN  SINK 1.00 M/S  LATERAL 0.00 M/S
```

Before a flight, the strip prints data loads and import results instead.

---

## 5. Component specifications

### 5.1 Site cards (Sec. 5.8, 7.8)

- **Geometry.** 0–2px corner radius, 1px black border, white fill.
- **Invariant catalogue coordinate.** The site ID is set in Futura Demibold at the same
  top-right position on every card, so a list of sites can be scanned without the eye jumping.
- **Directional ports.**
  - Left edge of an analog card: the planetary targets it is proposed for.
  - Right edge of a target card: the Earth analogs proposed for it, with their terrain scores.
  - Ports and labels keep a one-stroke buffer from the border.

### 5.2 Pairing connectors and trajectory lines (Sec. 6.1)

- **Orthogonal routing.** Pairing connectors between a target and its analogs run horizontally
  and vertically only.
- **Arrow height.** Arrowheads match the cap height of the adjacent Futura label.
- **Three connector states:**
  1. **Selected pairing:** 1.5px black, labelled with the terrain score.
  2. **Proposed pairing, not selected:** 1px Warm Gray.
  3. **No pairing proposed:** no connector. The card states "Not paired with this target".
- **Trajectory.** The flown path is 1.5px black, the planned approach is 1px Warm Gray, and a
  hazard divert is marked by a 2px red segment with a white-backed tag ("DIVERT 8.0 M").

### 5.3 Sliding plaques (Sec. 6.2f–g)

Modelled on the door plaques with sliding shutters. They never fade; they slide.

- **Terrain availability** on every site card:
  - Black fill, white type: "TERRAIN LOADED // 30 M GRID".
  - White fill, black border: "AWAITING DATA".
- **Hazard sensor** in the configurator: a three-position plaque, LIDAR / CAMERA / NONE.
- **Interference source:** a two-position plaque, FROM SITE DATA / SET MANUALLY.
- **Hold override,** red fill with white type, when a stage cannot proceed: "HOLD // THRUST
  BELOW WEIGHT", "HOLD // WEATHER NOT LOADED".

### 5.4 Provenance badges, after the Vinylcal (Sec. 9.1)

The data team's rule is that every number has a source and a status. The Vinylcal carries it:
a compact rounded-corner white tag, usable on any background, placed at the bottom-left of a
value or card.

- The status word is in red only for values the user must not mistake for data: **ASSUMED** and
  **UNKNOWN**.
- **MEASURED**, **DERIVED** and **MODELED** are in black.
- The source code follows in black: "COP-DEM GLO-30", "NASA POWER", "MOLA", "LOLA".

Examples: dust interference from site data reads "DERIVED // CATALOG SUBSTRATE". A manually
set dust value reads "ASSUMED // USER". Wind direction on a catalogue site reads "ASSUMED".

### 5.5 Bracketed failure callouts and emergency patches (Sec. 5.18, 9.2)

- **Bracket isolation.** When a flight ends in failure, the reason is lifted to the top of the
  report and framed by heavy black brackets.
- **Emergency patch layout:**
  - Primary patch: solid red rectangle with an inset white border and a white title, "CRASH",
    "TIP-OVER" or "HARD LANDING".
  - Sub-patch 6px below: solid black with white type stating the exact exceedance, "SINK RATE
    13.41 M/S // LIMIT 3.0".
- A successful touchdown uses no patch. Success is the calm state: black type on white.

### 5.6 Site directory slats (Sec. 6.2j)

- **Left column:** region in Helvetica Light, site name in Helvetica Medium.
- **Centre column:** landform and surface material with the pack's grid spacing, in Futura
  Light.
- **Right column:** the terrain score for the selected target and a status dot. Solid black
  means terrain loaded and paired, Warm Gray means loaded but not paired, and a hollow black
  ring means awaiting data. Red is not used here: an unpaired site is not a fault.

---

## 6. Workflows

### 6.1 Workflow A: "Is this Earth site a fair stand-in?"

1. On the Earth analog screen, read the directory from the top: proposed pairings come first,
   ordered by terrain score.
2. Select a slat. The diagram frame shows that site's terrain; the pairing connector to the
   target turns black and shows its score.
3. Read the two evidence rows beside the frame: what the catalogue records about the site, and
   where the analogy ends. Every number carries its provenance badge.
4. After a flight, the report gives the two fidelity scores side by side with the landable
   share of each terrain, and the caveat about grid resolution directly beneath them.

### 6.2 Workflow B: "Will it land, and why not?"

1. On the Configure screen, the masthead shows GO or NO-GO for the current vehicle before
   anything is flown. A NO-GO names its reason on a hold plaque.
2. During descent, the diagram frame holds the side view; the right column holds the telemetry
   tape (altitude, sink rate, lateral speed, fuel, throttle) in Futura. A value over its
   touchdown limit below 30 m turns red.
3. At touchdown, the outcome is either the calm success state or an emergency patch with the
   exact exceedance.
4. The report lists the site conditions that were used, each with its badge.

### 6.3 Live descent cascade

When the physics engine emits an event:

1. A hazard detection draws a red marker on the top view and prints a line in the CAPCOM strip.
2. A divert draws the red divert segment and moves the aim marker.
3. Dust kick-up below 30 m is drawn in Warm Gray, never as a tint of red.
4. Touchdown snaps the masthead status to GO in white, or NO-GO in the red alert block, and
   prints the final line in the strip.

---

## 7. Interaction, motion and progressive disclosure (Sec. 5.1, 5.20, 6.2)

### 7.1 Polarity focus isolation (Sec. 7.2)

Selecting a site applies a field darker than 40% gray over every unrelated site. Dimmed slats
and connectors switch to pure white and lose any red, so nothing competes with the selected
pairing.

### 7.2 Mechanical linear transitions (Sec. 6.2)

Plaque slides, drawer openings and view toggles run in 100–120 ms with linear or sharp
cubic-bezier curves. Nothing bounces, overshoots or fades slowly. The descent itself runs at
its physical rate; only the interface chrome is mechanical.

Motion is switched off for people who ask their system to reduce it.

### 7.3 Margin-annotation drawer for sources (Sec. 5.20b)

Site cards show only the ID, name, region and ports. Selecting "Data and sources" opens a
slide-over dossier on the margin-annotation grid:

- A wide main column with the site description and limitations in Times Roman.
- A narrow right margin with one provenance badge, dataset name and link per number, aligned
  horizontally with the value it documents.

### 7.4 One-click reconfigure ticket, after Form 1025 (Sec. 4.1)

Selecting a red emergency patch in the report opens a compact card with uppercase micro-labels:
FAILED LIMIT, MEASURED VALUE, ALLOWED VALUE, MARGIN, CONDITIONS. It has one mechanical button,
"RECONFIGURE AND FLY AGAIN", which returns to the Configure screen with the same site and
settings loaded.
