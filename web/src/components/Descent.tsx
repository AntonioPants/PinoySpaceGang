import { lazy, Suspense, useState } from 'react';
import Descent2D, { type DescentProps } from './Descent2D';

// The 3D view pulls in the 3D engine, so it loads only when the descent opens.
const Descent3D = lazy(() => import('./Descent3D'));

/**
 * The descent screen. It flies in Furgan's live 3D view by default and keeps the 2D side view
 * as an alternative: chosen by the player, or used automatically when 3D cannot start or the
 * system asks for reduced motion. Both views fly the same physics.
 */
export default function Descent(props: Omit<DescentProps, 'toolbarExtra'>) {
  const [mode, setMode] = useState<'3d' | '2d'>(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '2d' : '3d');
  const [notice, setNotice] = useState('');
  const viewSwitch = <button className="subtle-button" onClick={() => { setNotice(''); setMode(m => m === '3d' ? '2d' : '3d'); }}>{mode === '3d' ? '2D view' : '3D view'}</button>;
  if (mode === '2d') return <>
    {notice && <p role="status" className="field-help">{notice}</p>}
    <Descent2D {...props} toolbarExtra={viewSwitch} />
  </>;
  return <Suspense fallback={<div className="flight-workspace empty-data" role="status">Preparing the 3D view…</div>}>
    <Descent3D {...props} toolbarExtra={viewSwitch} onUnavailable={reason => { setNotice(`3D view unavailable (${reason}). Showing the 2D view.`); setMode('2d'); }} />
  </Suspense>;
}
