/**
 * The layout of the ship's bridge. Floor coordinates are metres: x to the right, z toward the
 * back, so the big window is at the front (negative z). Headings are measured clockwise from
 * "facing the window", seen from above.
 */
export const ROOM = {
  halfWidthM: 5.8,
  halfDepthM: 4.4,
  heightM: 3.5,
} as const;

/** Size of a wall monitor's screen, m. */
export const SCREEN = { widthM: 2.4, heightM: 1.4, centreHeightM: 1.85 } as const;

export type StationId = 'mission' | 'equipment' | 'config';

export interface Station {
  id: StationId; title: string; key: string;
  /** Centre of the screen on the wall. */
  x: number; z: number;
  /** Unit vector pointing from the wall into the room. */
  nx: number; nz: number;
}

export const STATIONS: readonly Station[] = [
  { id: 'mission', title: 'Mission control', key: '1', x: -ROOM.halfWidthM, z: -0.4, nx: 1, nz: 0 },
  { id: 'equipment', title: 'Equipment', key: '2', x: 0, z: ROOM.halfDepthM, nx: 0, nz: -1 },
  { id: 'config', title: 'Flight configuration', key: '3', x: ROOM.halfWidthM, z: -0.4, nx: -1, nz: 0 },
];

/** The pilot's seat, facing the window. Sitting in it opens the launch menu. */
export const SEAT = { key: '4', title: 'Pilot seat', x: 0, z: -1.9, heading: 0, seatHeightM: 0.52 } as const;

export interface Box { x0: number; x1: number; z0: number; z1: number }

/** Things the astronaut cannot walk through: chairs, consoles, the dashboard, crates. */
export const OBSTACLES: readonly Box[] = [
  { x0: -0.5, x1: 0.5, z0: SEAT.z - 0.5, z1: SEAT.z + 0.55 },                         // pilot seat
  { x0: -2.5, x1: -1.5, z0: -2.5, z1: -1.45 }, { x0: 1.5, x1: 2.5, z0: -2.5, z1: -1.45 },   // side seats
  { x0: -4.0, x1: 4.0, z0: -ROOM.halfDepthM, z1: -3.35 },                              // dashboard under the window
  { x0: -ROOM.halfWidthM, x1: -5.05, z0: -1.9, z1: 1.1 },                              // mission control console
  { x0: 5.05, x1: ROOM.halfWidthM, z0: -1.9, z1: 1.1 },                                // flight configuration console
  { x0: -1.5, x1: 1.5, z0: 3.65, z1: ROOM.halfDepthM },                                // equipment console
  { x0: -5.3, x1: -4.2, z0: 3.0, z1: 4.1 }, { x0: 4.2, x1: 5.3, z0: 3.0, z1: 4.1 },    // cargo
];
