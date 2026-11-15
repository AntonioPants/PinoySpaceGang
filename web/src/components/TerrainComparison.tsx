import { useEffect, useState } from 'react';
import { loadCatalog } from '../lib/catalog';
import { loadTerrainPack, type TerrainPack } from './cutscene/terrainPack';

const KEY = 'analog-atlas-terrain-comparison';
const CHANGE = 'analog-atlas-terrain-comparison-change';
export function useTerrainComparison(targetId: string) {
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } });
  useEffect(() => {
    const sync = (event: Event) => {
      if (event instanceof CustomEvent) setEnabled(event.detail as boolean);
      else { try { setEnabled(localStorage.getItem(KEY) !== 'off'); } catch { /* optional preference */ } }
    };
    window.addEventListener(CHANGE,sync); window.addEventListener('storage',sync);
    return () => { window.removeEventListener(CHANGE,sync); window.removeEventListener('storage',sync); };
  }, []);
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
      const pack = await loadTerrainPack(entry.terrain.manifest_url.replace(/[^/]*$/, ''), abort.signal);
      if (pack.manifest.id !== targetId) throw new Error('The comparison terrain does not match the selected region.');
      if (!abort.signal.aborted) setLoaded({ id: targetId, pack });
    }).catch(e => { if (!abort.signal.aborted) setFailure({id:targetId,message:e instanceof Error ? e.message : 'Terrain could not be loaded.'}); });
    return () => abort.abort();
  }, [targetId, enabled, attempt]);
  return { enabled, pack: enabled && loaded?.id === targetId ? loaded.pack : null,
    error: failure?.id === targetId ? failure.message : '',
    retry: () => setAttempt(a => a+1),
    toggle: () => { const next = !enabled; setEnabled(next); try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* optional preference */ } window.dispatchEvent(new CustomEvent(CHANGE,{detail:next})); } };
}
export type TerrainComparisonState = ReturnType<typeof useTerrainComparison>;
export function ComparisonToggle({ comparison }: { comparison: TerrainComparisonState }) {
  return <button className="subtle-button" aria-pressed={comparison.enabled} onClick={comparison.toggle}>Terrain comparison: {comparison.enabled ? 'on' : 'off'}</button>;
}
export function ComparisonLegend({ comparison, targetName, earthName, earthSpacing }: {
  comparison: TerrainComparisonState; targetName: string; earthName: string; earthSpacing: number;
}) {
  if (!comparison.enabled) return null;
  return <div className="terrain-comparison-legend" role="status">
    {comparison.error ? <><span>Comparison unavailable: {comparison.error}</span> <button className="subtle-button" onClick={comparison.retry}>Retry comparison</button></> : !comparison.pack ? 'Loading planetary comparison…' : <>
      <strong><span className="comparison-earth">━</span> Earth · {earthName} <span className="comparison-planet">┄</span> {targetName}</strong>
      <details><summary>Alignment, resolution &amp; sources</summary><small>Centres and centre elevations aligned · east/north preserved · 1:1 metres · shared footprint only. Cyan is an x-ray reference, including below Earth.</small>
      <small>Earth grid {earthSpacing} m · planetary grid {comparison.pack.manifest.grid.spacing_m} m. Visual terrain comparison; proposed analog, not landing validation.</small>
      <p>{comparison.pack.manifest.attribution}</p></details>
    </>}
  </div>;
}
