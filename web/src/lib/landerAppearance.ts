/** Illustrative finishes and attachments. These never change simulation parameters. */
export const liveries = [
  { id: 'heritage', name: 'Heritage gold', hull: 0xc5a253, shell: 0xe9e5da, accent: 0xad583b, swatch: '#c5a253' },
  { id: 'arctic', name: 'Arctic white', hull: 0xc5ced3, shell: 0xf0f2ee, accent: 0x397c9c, swatch: '#e9eeef' },
  { id: 'ember', name: 'Ember orange', hull: 0xb95531, shell: 0xe6ded0, accent: 0xf0b45b, swatch: '#b95531' },
  { id: 'midnight', name: 'Midnight blue', hull: 0x293b56, shell: 0xabb8c5, accent: 0xd6af62, swatch: '#293b56' },
  { id: 'sage', name: 'Expedition green', hull: 0x627668, shell: 0xdce0d4, accent: 0xd7b975, swatch: '#627668' },
] as const;
export const solarArrays = [
  { id: 'standard', name: 'Classic wings', detail: 'Twin framed arrays with individual photovoltaic cells.' },
  { id: 'extended', name: 'Explorer wings', detail: 'Long articulated arrays with three sections per wing.' },
  { id: 'compact', name: 'Compact wings', detail: 'Short swept arrays tucked close to the spacecraft.' },
] as const;
export const antennaPackages = [
  { id: 'dish', name: 'High-gain dish', detail: 'Parabolic reflector, feed arm and articulated mount.' },
  { id: 'relay', name: 'Relay array', detail: 'Twin flat antenna panels on a raised crossbar.' },
  { id: 'whip', name: 'Survey masts', detail: 'Paired slender antennas with insulated bases.' },
] as const;
export interface LanderAppearance {
  liveryId?: typeof liveries[number]['id'];
  solarArrayId?: typeof solarArrays[number]['id'];
  antennaId?: typeof antennaPackages[number]['id'];
}
export const defaultAppearance: Required<LanderAppearance> = { liveryId: 'heritage', solarArrayId: 'standard', antennaId: 'dish' };
