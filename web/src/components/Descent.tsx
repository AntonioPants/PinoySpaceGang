import { lazy, Suspense, useState } from 'react';
import Descent2D, { type DescentProps } from './Descent2D';

// The 3D view pulls in the 3D engine, so it loads only when the descent opens.
const Descent3D = lazy(() => import('./Descent3D'));
// Once the 3D view's code has been fetched ahead of time it is kept here and rendered directly.
// A lazy component always shows its placeholder first, even when the code is already loaded, and
// that placeholder was a visible "Preparing the 3D view" screen between the cutscene and the descent.
let Loaded3D: typeof import('./Descent3D').default | null = null;
/** Fetches the 3D descent ahead of time, so it opens without a loading screen. */
export function preloadDescent3D() {
  return import('./Descent3D').then(m => { Loaded3D = m.default; }).catch(() => { /* loads on demand instead */ });
}

/**
 * The descent screen. It flies in Furgan's live 3D view by default and keeps the 2D side view
 * as an alternative: chosen by the player (the choice is remembered), or used automatically
 * when 3D cannot start. Both views fly the same physics. With reduced motion the 3D view still
 * opens, because the descent is the thing being watched, and the calmer 2D view is pointed out.
 */
const KEY = 'analog-atlas-descent-view';
function savedMode(): '3d' | '2d' {
  try { return localStorage.getItem(KEY) === '2d' ? '2d' : '3d'; } catch { return '3d'; }
}
export default function Descent({ warming = false, ...props }: Omit<DescentProps, 'toolbarExtra'> & { warming?: boolean }) {
  const [mode, setMode] = useState<'3d' | '2d'>(savedMode);
  const [View3D] = useState(() => Loaded3D);        // fixed for this mount, so the view is never swapped mid-flight
  const [notice, setNotice] = useState(() => savedMode() === '3d' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'Your system asks for reduced motion. The 2D view moves less; switch with the 2D view button.' : '');
  const choose = (next: '3d' | '2d') => { setNotice(''); setMode(next); try { localStorage.setItem(KEY, next); } catch { /* the choice just is not remembered */ } };
  const viewSwitch = <button className="subtle-button" onClick={() => choose(mode === '3d' ? '2d' : '3d')}>{mode === '3d' ? '2D view' : '3D view'}</button>;
  const unavailable = (reason: string) => { setNotice(`3D view unavailable (${reason}). Showing the 2D view.`); setMode('2d'); };
  if (mode === '2d') return warming ? null : <>
    {notice && <p role="status" className="field-help">{notice}</p>}
    <Descent2D {...props} toolbarExtra={viewSwitch} />
  </>;
  return <>
    {notice && <p role="status" className="field-help">{notice}</p>}
    {View3D ? <View3D {...props} warming={warming} toolbarExtra={viewSwitch} onUnavailable={unavailable} />
      : <Suspense fallback={<div className="flight-workspace empty-data" role="status">Preparing the 3D view…</div>}>
        <Descent3D {...props} warming={warming} toolbarExtra={viewSwitch} onUnavailable={unavailable} />
      </Suspense>}
  </>;
}
