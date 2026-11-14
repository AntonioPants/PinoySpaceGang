import type { AnalogSite, PlanetarySite } from '../lib/types';
// Curated navigation fixtures, not measured terrain or validated analog pairings.
// Coordinates are approximate visual locators; obtain precise study footprints from the data team.
export const targets: PlanetarySite[] = [
  { id: 'shackleton_rim', name: 'Shackleton rim', body: 'Moon', region: 'Lunar south pole', lat: -89.65, lon: 0, gravity: 1.62,
    description: 'Explore a polar landing scenario. Investigate terrain, low-angle lighting, and the limits of testing a lunar mission on Earth.',
    interests: ['Polar terrain', 'Lighting', 'Rim slopes'], source: 'https://pds-geosciences.wustl.edu/missions/lro/' },
  { id: 'marius_hills', name: 'Marius Hills', body: 'Moon', region: 'Oceanus Procellarum', lat: 14.2, lon: -56.8, gravity: 1.62,
    description: 'Explore a volcanic terrain scenario. Compare broad surface forms while keeping subsurface features outside the current terrain model.',
    interests: ['Volcanic terrain', 'Surface access', 'Roughness'], source: 'https://pds-geosciences.wustl.edu/missions/lro/' },
  { id: 'jezero_crater', name: 'Jezero crater', body: 'Mars', region: 'Isidis Planitia', lat: 18.38, lon: 77.58, gravity: 3.72,
    description: 'Prepare a crater-terrain scenario. Use an Earth test surface to explore descent controls before a matched planetary DEM is available.',
    interests: ['Crater terrain', 'Landing slopes', 'Navigation'], source: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html' },
  { id: 'arsia_mons', name: 'Arsia Mons', body: 'Mars', region: 'Tharsis volcanic province', lat: -9.0, lon: -120.0, gravity: 3.72,
    description: 'Explore a volcanic setting on Mars. Start with broad terrain descriptors; caves and overhangs need different observations.',
    interests: ['Volcanic terrain', 'Broad slopes', 'Surface access'], source: 'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html' },
];
export const analogs: AnalogSite[] = [
  { id: 'kilbourne-hole-v1', name: 'Kilbourne Hole', region: 'New Mexico, United States', lat: 31.972, lon: -106.969, available: true,
    description: 'A volcanic maar and documented Apollo field-training location. A real, coarse terrain pack is ready for your landing experiment.' },
  { id: 'haughton_crater', name: 'Haughton crater', region: 'Devon Island, Canada', lat: 75.38, lon: -89.68, available: false,
    description: 'A candidate from the team brief. Elevation data, comparison evidence, and a validated planetary pairing have not been supplied.' },
  { id: 'qaidam_basin', name: 'Qaidam Basin', region: 'Qinghai, China', lat: 37.5, lon: 93.5, available: false,
    description: 'A candidate from the team brief. This regional locator is illustrative; a study footprint and processed dataset are still needed.' },
];
