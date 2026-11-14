import { overall, type Check } from '../checklist';
import { Checks } from './Checks';

/** The launch station: what still needs attention, and the launch control itself. */
export default function LaunchScreen({ checks, onLaunch, onExit }: { checks: Check[]; onLaunch: () => void; onExit: () => void }) {
  const state = overall(checks);
  const open = checks.filter(c => c.status !== 'go');
  return <>
    <header><h2>Launch</h2><span className={`monitor-tag ${state}`}>{state === 'go' ? 'Go for launch' : state === 'caution' ? 'Go with caution' : 'Hold'}</span></header>
    {open.length ? <Checks checks={open} /> : <p className="monitor-lede">All checks are go. The mission configuration is locked when you launch.</p>}
    <div className="monitor-actions">
      <button className="primary-button" onClick={onLaunch}>Launch mission</button>
      <button className="subtle-button" onClick={onExit}>Return to equipment</button>
    </div>
    <p className="monitor-note">Launching flies the descent over the Earth test site with the settings on these monitors.</p>
  </>;
}
