"""Twenty more Moon and twenty more Mars study areas for the planetary side of the Atlas.

Centres are analysis choices taken from published landing sites and named features (east
longitude, WGS84-style degrees on each body's reference sphere), not surveyed landing
approvals. Moon windows are about 5 km (LOLA, 150 m grid); Mars windows are about 16 km
(MOLA, 500 m grid). Landform and substrate labels are interpretations; where a site mixes
units the label names the dominant one. None of these is a verified safe landing site.
"""

NASA = 'https://www.nasa.gov/mission/'
SCI = 'https://science.nasa.gov/mission/'
LIMIT = ' Regional elevation only; no hazard-scale detail, resource inventory or landing approval is implied.'

# id, name, body, lon_east, lat, region, morphology, substrate, evidence_url, note
_MOON = [
    ('apollo-11-tranquillity', 'Apollo 11 Tranquility Base area', 23.473, 0.674, 'Mare Tranquillitatis', 'volcanic_plain', 'lunar_regolith', NASA + 'apollo-11/', 'First crewed landing site on a basaltic mare plain; a benchmark for smooth, low-slope terrain.'),
    ('apollo-12-procellarum', 'Apollo 12 Oceanus Procellarum area', -23.421, -3.012, 'Oceanus Procellarum', 'volcanic_plain', 'lunar_regolith', NASA + 'apollo-12/', 'Mare plain near the Surveyor 3 site, with a degraded crater and ray-material context.'),
    ('apollo-14-fra-mauro', 'Apollo 14 Fra Mauro highlands area', -17.471, -3.645, 'Fra Mauro Formation', 'massif', 'lunar_regolith', NASA + 'apollo-14/', 'Hummocky ejecta upland from the Imbrium basin; rougher and steeper than a mare.'),
    ('apollo-15-hadley', 'Apollo 15 Hadley Rille and Apennine front', 3.633, 26.132, 'Hadley-Apennine', 'massif', 'lunar_regolith', NASA + 'apollo-15/', 'Sinuous rille beside a mountain front; steep relief next to flat mare.'),
    ('apollo-16-descartes', 'Apollo 16 Descartes highlands area', 15.501, -8.973, 'Descartes Formation', 'massif', 'lunar_regolith', NASA + 'apollo-16/', 'Rolling cratered highland plains, the only Apollo landing on typical highland terrain.'),
    ('apollo-17-taurus-littrow', 'Apollo 17 Taurus-Littrow valley', 30.772, 20.188, 'Taurus-Littrow', 'massif', 'lunar_regolith', NASA + 'apollo-17/', 'Narrow valley floor between massifs, with dark mantle deposits and steep walls.'),
    ('tycho-central-peak', 'Tycho central peak', -11.36, -43.31, 'Tycho crater', 'crater', 'lunar_regolith', SCI + 'lro/', 'Young, well-preserved complex crater peak with high local relief and fresh rock.'),
    ('aristarchus-plateau', 'Aristarchus plateau', -47.4, 23.7, 'Aristarchus plateau', 'volcanic_plain', 'lunar_regolith', SCI + 'lro/', 'Raised volcanic plateau with pyroclastic mantle, rilles and a bright young crater nearby.'),
    ('reiner-gamma', 'Reiner Gamma swirl', -59.0, 7.5, 'Oceanus Procellarum', 'volcanic_plain', 'lunar_regolith', SCI + 'lro/', 'Mare plain crossed by a magnetic-anomaly swirl; the swirl is an albedo feature with little relief.'),
    ('copernicus-peaks', 'Copernicus central peaks', -20.1, 9.7, 'Copernicus crater', 'crater', 'lunar_regolith', SCI + 'lro/', 'Central peaks of a large young crater, with terraced walls and blocky ejecta nearby.'),
    ('cabeus-rim', 'Cabeus crater rim', -35.5, -84.9, 'Lunar south polar region', 'crater', 'lunar_regolith', SCI + 'lcross/', 'Rim of the permanently shadowed crater targeted by LCROSS, where it detected water ice.'),
    ('faustini-rim', 'Faustini crater rim', 77.0, -87.3, 'Lunar south polar region', 'crater', 'lunar_regolith', SCI + 'lro/', 'Rim of a large permanently shadowed crater near the pole; cold-trap context for volatiles.'),
    ('haworth-rim', 'Haworth crater rim', -5.0, -87.5, 'Lunar south polar region', 'crater', 'lunar_regolith', SCI + 'lro/', 'Rim of a polar crater with permanently shadowed floor; approximate study centre.'),
    ('de-gerlache-rim', 'de Gerlache crater rim', -87.1, -88.5, 'Lunar south polar region', 'crater', 'lunar_regolith', SCI + 'lro/', 'Rim of an old polar crater beside Shackleton, with low-sun terrain and rough ejecta.'),
    ('shoemaker-rim', 'Shoemaker crater rim', 44.9, -88.1, 'Lunar south polar region', 'crater', 'lunar_regolith', SCI + 'lro/', 'Rim of a large permanently shadowed polar crater; very low sun angles.'),
    ('peary-rim', 'Peary crater rim', 33.0, 88.6, 'Lunar north polar region', 'crater', 'lunar_regolith', SCI + 'lro/', 'Rim of a large crater at the north pole, the northern counterpart of the south polar sites.'),
    ('von-karman-chang-e-4', 'Von Karman crater floor (Chang’e-4)', 177.6, -45.5, 'South Pole-Aitken basin', 'crater', 'lunar_regolith', 'https://www.cnsa.gov.cn/english/', 'Floor of a crater inside the South Pole-Aitken basin, the first landing on the far side.'),
    ('mons-rumker', 'Mons Rümker volcanic complex (Chang’e-5)', -51.9, 43.1, 'Oceanus Procellarum', 'volcanic_plain', 'lunar_regolith', 'https://www.cnsa.gov.cn/english/', 'Volcanic dome complex rising from the mare, near the Chang’e-5 sample-return site.'),
    ('chandrayaan-3-manzinus', 'Chandrayaan-3 southern highlands area', 32.32, -69.37, 'Lunar southern highlands', 'massif', 'lunar_regolith', 'https://www.isro.gov.in/Chandrayaan3.html', 'High-latitude highland plain where Chandrayaan-3 landed, with ejecta from nearby craters.'),
    ('tranquillitatis-pit', 'Mare Tranquillitatis pit crater', 33.222, 8.335, 'Mare Tranquillitatis', 'crater', 'lunar_regolith', SCI + 'lro/', 'Collapse pit in the mare, studied as a possible skylight into a lava tube.'),
]

_MARS = [
    ('oxia-planum', 'Oxia Planum clay plain (ExoMars)', -24.6, 18.2, 'Oxia Planum', 'rocky_desert', 'sedimentary_rock', 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars', 'Clay-bearing plain chosen for the ExoMars rover, with a smooth surface and scattered rocks.'),
    ('mawrth-vallis', 'Mawrth Vallis clay outcrops', -19.0, 24.0, 'Mawrth Vallis', 'canyon', 'sedimentary_rock', SCI + 'mars-reconnaissance-orbiter/', 'Ancient outflow channel cutting layered clay-rich rock, a candidate for early-Mars chemistry.'),
    ('meridiani-planum', 'Meridiani Planum (Opportunity)', -5.53, -1.95, 'Meridiani Planum', 'rocky_desert', 'sedimentary_rock', SCI + 'mer-opportunity/', 'Very flat plain with hematite-bearing sedimentary rock where Opportunity drove for 14 years.'),
    ('gusev-crater', 'Gusev crater floor (Spirit)', 175.47, -14.57, 'Gusev crater', 'crater', 'basalt', SCI + 'mer-spirit/', 'Basalt-covered crater floor, the landing site of the Spirit rover, with scattered rocks.'),
    ('elysium-planitia', 'Elysium Planitia (InSight)', 135.62, 4.5, 'Elysium Planitia', 'volcanic_plain', 'basalt', SCI + 'insight/', 'Smooth, nearly flat lava plain selected for InSight; low slopes and few large rocks.'),
    ('isidis-planitia', 'Isidis Planitia basin floor', 90.43, 11.53, 'Isidis basin', 'volcanic_plain', 'basalt', SCI + 'mars-express/', 'Flat basin floor with volcanic fill and sediment; site of the Beagle 2 landing attempt.'),
    ('utopia-planitia', 'Utopia Planitia (Zhurong)', 109.9, 25.1, 'Utopia Planitia', 'rocky_desert', 'unknown', 'https://science.nasa.gov/mars/', 'Wide northern plain with buried ice and low slopes, where the Zhurong rover operated.'),
    ('chryse-planitia', 'Chryse Planitia (Viking 1)', -47.95, 22.27, 'Chryse Planitia', 'rocky_desert', 'unknown', SCI + 'viking/', 'Outflow plain where Viking 1 landed, with a boulder field and rolling terrain.'),
    ('ares-vallis', 'Ares Vallis flood plain (Pathfinder)', -33.25, 19.13, 'Ares Vallis', 'canyon', 'basalt', SCI + 'mars-pathfinder/', 'Catastrophic-flood outflow plain where Pathfinder found a rock-strewn surface.'),
    ('melas-chasma', 'Melas Chasma floor', -69.0, -9.8, 'Valles Marineris', 'canyon', 'sedimentary_rock', SCI + 'mars-reconnaissance-orbiter/', 'Deep trough of Valles Marineris with layered deposits and landslide debris.'),
    ('olympus-mons-caldera', 'Olympus Mons caldera', -133.8, 18.65, 'Olympus Mons', 'volcanic_plain', 'basalt', SCI + 'mars-global-surveyor/', 'Summit caldera of the largest known volcano; thin air and nested collapse pits.'),
    ('hellas-planitia', 'Hellas Planitia basin floor', 70.0, -42.4, 'Hellas basin', 'rocky_desert', 'unknown', SCI + 'mars-reconnaissance-orbiter/', 'Floor of the deepest basin on Mars, with the thickest atmosphere and seasonal frost.'),
    ('syrtis-major', 'Syrtis Major volcanic plain', 69.5, 8.4, 'Syrtis Major', 'volcanic_plain', 'basalt', SCI + 'mars-reconnaissance-orbiter/', 'Old low-relief shield of basaltic lava, dark and dusty in orbital images.'),
    ('nili-fossae', 'Nili Fossae troughs', 77.5, 21.0, 'Nili Fossae', 'canyon', 'basalt', SCI + 'mars-reconnaissance-orbiter/', 'Fractured trough system with olivine and carbonate-bearing rock.'),
    ('eberswalde-delta', 'Eberswalde crater delta', -33.7, -24.3, 'Eberswalde crater', 'delta', 'sedimentary_rock', SCI + 'mars-reconnaissance-orbiter/', 'Well-preserved ancient river delta, a close cousin of the Jezero delta.'),
    ('korolev-crater', 'Korolev crater ice dunes', 165.4, 73.3, 'North polar region', 'crater', 'icy_regolith', SCI + 'mars-express/', 'Large crater holding a permanent mound of water ice, with dunes on its floor.'),
    ('noctis-labyrinthus', 'Noctis Labyrinthus', -95.5, -7.0, 'Tharsis', 'canyon', 'basalt', SCI + 'mars-express/', 'Maze of intersecting valleys at the head of Valles Marineris, with steep, fractured walls.'),
    ('argyre-planitia', 'Argyre Planitia basin floor', -44.0, -50.0, 'Argyre basin', 'crater', 'unknown', SCI + 'mars-global-surveyor/', 'Floor of a large southern impact basin, with glacier-like flow features on its rim.'),
    ('candor-chasma', 'Candor Chasma layered deposits', -76.0, -6.0, 'Valles Marineris', 'canyon', 'sedimentary_rock', SCI + 'mars-reconnaissance-orbiter/', 'Trough with kilometre-thick layered deposits of sulphate-bearing rock.'),
    ('athabasca-valles', 'Athabasca Valles lava plains', -155.6, 9.5, 'Elysium Planitia', 'volcanic_plain', 'basalt', SCI + 'mars-reconnaissance-orbiter/', 'Young lava-flood channels with plated and ridged flows, among the youngest surfaces on Mars.'),
]


def _rows(body, rows):
    return [(sid, name, body, lon, lat, region, form, substrate, url, note + LIMIT, [])
            for sid, name, lon, lat, region, form, substrate, url, note in rows]


SITES = _rows('moon', _MOON) + _rows('mars', _MARS)
IDS = [row[0] for row in SITES]
