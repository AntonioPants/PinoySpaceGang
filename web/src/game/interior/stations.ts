/**
 * Where things are in the cabin. Angles are measured clockwise from the cabin's forward wall,
 * seen from above, so a station at angle a sits at (sin a, -cos a) on the floor plan.
 */
export const CABIN = {
  /** Distance from the centre to the inside of each of the eight walls, m. */
  wallM: 2.6,
  heightM: 2.5,
  /** The player's eyes. */
  eyeM: 1.6,
  /** How far from the centre the player can walk, m. */
  walkM: 1.75,
  /** Where the player stands when using a monitor: this far in front of it, m. */
  standM: 1.35,
  monitorHeightM: 1.5,
} as const;

export type StationId = 'mission' | 'equipment' | 'config' | 'launch';

export interface Station { id: StationId; title: string; key: string; angleDeg: number }

/** The four monitors, in the order the number keys and Tab visit them. */
export const STATIONS: readonly Station[] = [
  { id: 'mission', title: 'Mission control', key: '1', angleDeg: -45 },
  { id: 'equipment', title: 'Equipment', key: '2', angleDeg: 0 },
  { id: 'config', title: 'Flight configuration', key: '3', angleDeg: 45 },
  { id: 'launch', title: 'Launch', key: '4', angleDeg: 90 },
];

/** The porthole to the surface, opposite the launch station. Key 5 turns to it. */
export const WINDOW_ANGLE_DEG = -90;
