import type { TerrainProfile } from '../lib/types';
export default function TerrainChart({ profile }: { profile: TerrainProfile }) {
  const h = profile.heightsM, low = Math.floor(Math.min(...h)), high = Math.ceil(Math.max(...h));
  const path = h.map((v, i) => `${i === 0 ? 'M' : 'L'}${36 + i / (h.length - 1) * 556},${100 - (v - low) / Math.max(high - low, 1) * 70}`).join(' ');
  return <figure className="terrain-chart">
    <figcaption><span>Terrain transect</span><span>West → East · Centre row</span></figcaption>
    <svg viewBox="0 0 610 130" role="img" aria-label={`Terrain elevation transect, ${((h.length - 1) * profile.sampleSpacingM / 1000).toFixed(1)} kilometres wide; heights ${low} to ${high} metres above the local origin.`}>
      {[30, 65, 100].map(y => <line key={y} x1="36" x2="592" y1={y} y2={y} stroke="currentColor" opacity="0.12" />)}
      <path d={`${path} L592,100 L36,100 Z`} fill="var(--accent-soft)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      <text x="0" y="34">{high} m</text><text x="0" y="103">{low} m</text>
      <text x="36" y="122">0 km</text><text x="553" y="122">{((h.length - 1) * profile.sampleSpacingM / 1000).toFixed(1)} km</text>
    </svg>
    <small>Height above local origin ({profile.manifest.local_frame.vertical_offset_m} m EGM2008). Vertical scale exaggerated for readability.</small>
  </figure>;
}
