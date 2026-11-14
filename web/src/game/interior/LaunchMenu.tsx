import { useEffect, useRef, useState } from 'react';
import { overall, type Check } from './checklist';
import { Light, STATUS_PHRASE } from './screens/ui';

const KEY = 'analog-atlas-cinematics';
/** The player's choice at the pilot seat: 'on', 'off', or null if they have not chosen. */
export function cinematicsChoice(): 'on' | 'off' | null {
  try { const v = localStorage.getItem(KEY); return v === 'on' || v === 'off' ? v : null; } catch { return null; }
}

/**
 * Opens when the astronaut sits in the pilot seat. Starting the mission hands over to the parent,
 * which validates and locks the mission and cuts to the departure cinematic.
 */
export default function LaunchMenu({ checks, reducedMotion, onLaunch, onStand }: { checks: Check[]; reducedMotion: boolean; onLaunch: () => void; onStand: () => void }) {
  const state = overall(checks), open = checks.filter(c => c.status !== 'go');
  const [cinematics, setCinematics] = useState(() => cinematicsChoice() !== 'off');
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => { start.current?.focus({ preventScroll: true }); }, []);
  const launch = () => {
    try { localStorage.setItem(KEY, cinematics ? 'on' : 'off'); } catch { /* the choice just is not remembered */ }
    onLaunch();
  };
  return <div className="cabin-overlay launch-menu" role="dialog" aria-label="Pilot seat">
    <header><h2>Pilot seat</h2><Light status={state}>{STATUS_PHRASE[state]}</Light></header>
    {open.length ? <ul className="mon-checks">{open.map(c => <li key={c.id}><Light status={c.status} /><div><strong>{c.label}</strong><p>{c.detail}</p></div></li>)}</ul>
      : <p className="launch-lede">All systems are go. The mission is locked when you start.</p>}
    <label className="launch-option"><input type="checkbox" checked={cinematics} onChange={e => setCinematics(e.target.checked)} />Play cinematics
      {reducedMotion && <small>Your system asks for reduced motion. Untick to skip them.</small>}</label>
    <div className="launch-actions">
      <button ref={start} type="button" className="launch-start" onClick={launch}>Start mission</button>
      <button type="button" className="launch-stand" onClick={onStand}>Stand up</button>
    </div>
  </div>;
}
