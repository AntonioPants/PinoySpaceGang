import { useEffect, useState } from 'react';
import { loadCatalog } from '../lib/catalog';
import { loadTerrainPack, type TerrainPack } from './cutscene/terrainPack';
import { stereoSelection, STEREO_CHANGE, type StereoSelection } from '../lib/stereoPilot';

const KEY = 'analog-atlas-terrain-comparison';
const CHANGE = 'analog-atlas-terrain-comparison-change';
export function useTerrainComparison(targetId: string) {
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } });
  const [stereo,setStereo]=useState(stereoSelection);
  useEffect(() => {
    const sync = (event: Event) => {
      if (event instanceof CustomEvent) setEnabled(event.detail as boolean);
      else { try { setEnabled(localStorage.getItem(KEY) !== 'off'); } catch { /* optional preference */ } }
    };
    const syncStereo=(event:Event)=>{
      const selection=(event as CustomEvent<StereoSelection|null>).detail;
      setStereo(selection);
      if(selection){try{localStorage.setItem(KEY,'on');}catch{/* optional preference */}window.dispatchEvent(new CustomEvent(CHANGE,{detail:true}));}
    };
    window.addEventListener(CHANGE,sync); window.addEventListener('storage',sync); window.addEventListener(STEREO_CHANGE,syncStereo);
    return () => { window.removeEventListener(CHANGE,sync); window.removeEventListener('storage',sync); window.removeEventListener(STEREO_CHANGE,syncStereo); };
  }, []);
  const pilot=stereo?.targetId===targetId?stereo:null;
  const sourceKey=pilot?`${targetId}:${pilot.elevationHash}`:targetId;
  const [loaded, setLoaded] = useState<{ id: string; pack: TerrainPack } | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    setFailure(null);
    void loadCatalog(abort.signal).then(async catalog => {
      const entry = catalog.entries.get(targetId);
      if (!entry?.terrain) throw new Error('No measured planetary terrain pack is available.');
      if(pilot&&(pilot.baselineHash!==entry.terrain.elevation_sha256||pilot.manifestUrl!==`/terrain-pilots/${targetId}/manifest.json`))throw new Error('Stereo pilot inputs differ from the catalog.');
      const url=pilot?.manifestUrl??entry.terrain.manifest_url;
      const pack = await loadTerrainPack(url.replace(/[^/]*$/, ''), abort.signal);
      if (pack.manifest.id !== targetId) throw new Error('The comparison terrain does not match the selected region.');
      if(pilot){
        const bytes=new ArrayBuffer(pack.heights.length*4),view=new DataView(bytes);
        pack.heights.forEach((h,i)=>view.setFloat32(i*4,h,true));
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
        if(hash!==pilot.elevationHash)throw new Error('Stereo terrain checksum differs from the staged pilot.');
      }
      if (!abort.signal.aborted) setLoaded({ id: sourceKey, pack });
    }).catch(e => { if (!abort.signal.aborted) setFailure({id:targetId,message:e instanceof Error ? e.message : 'Terrain could not be loaded.'}); });
    return () => abort.abort();
  }, [targetId, enabled, attempt, pilot, sourceKey]);
  return { enabled, stereo:!!pilot, pack: enabled && loaded?.id === sourceKey ? loaded.pack : null,
    error: failure?.id === targetId ? failure.message : '',
    retry: () => setAttempt(a => a+1),
    toggle: () => { const next = !enabled; setEnabled(next); try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* optional preference */ } window.dispatchEvent(new CustomEvent(CHANGE,{detail:next})); } };
}
export type TerrainComparisonState = ReturnType<typeof useTerrainComparison>;
export function ComparisonToggle({ comparison }: { comparison: TerrainComparisonState }) {
  return <button className="subtle-button" aria-pressed={comparison.enabled} onClick={comparison.toggle} title="Overlay the target's terrain and its landing as a hologram on the Earth site">Hologram mode: {comparison.enabled ? comparison.stereo ? 'stereo preview' : 'on' : 'off'}</button>;
}
export function ComparisonLegend({ comparison, targetName, earthName, earthSpacing }: {
  comparison: TerrainComparisonState; targetName: string; earthName: string; earthSpacing: number;
}) {
  if (!comparison.enabled) return null;
  return <div className="terrain-comparison-legend" role="status">
    {comparison.error ? <><span>Comparison unavailable: {comparison.error}</span> <button className="subtle-button" onClick={comparison.retry}>Retry comparison</button></> : !comparison.pack ? 'Loading planetary comparison…' : <>
      <strong><span className="comparison-earth">━</span> Earth · {earthName} <span className="comparison-planet">┄</span> {targetName}</strong>
      {comparison.stereo&&<small>Measured stereo preview · artifact review pending · catalog ranking retained</small>}
      <details><summary>Alignment, resolution &amp; sources</summary><small>Centres and centre elevations aligned · east/north preserved · 1:1 metres · shared footprint only. Cyan is an x-ray reference, including below Earth.</small>
      <small>Earth grid {earthSpacing} m · planetary grid {comparison.pack.manifest.grid.spacing_m} m. Visual terrain comparison; proposed analog, not landing validation.</small>
      <p>{comparison.pack.manifest.attribution}</p></details>
    </>}
  </div>;
}
