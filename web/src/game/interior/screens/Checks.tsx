import type { Check, CheckStatus } from '../checklist';

const WORD: Record<CheckStatus, string> = { go: 'Go', caution: 'Caution', hold: 'Hold' };

/** The go / no-go list, shared by the mission control and launch monitors. */
export function Checks({ checks }: { checks: Check[] }) {
  return <ul className="monitor-checks">{checks.map(c => <li key={c.id} className={c.status}>
    <span className="monitor-tag">{WORD[c.status]}</span><strong>{c.label}</strong><p>{c.detail}</p>
  </li>)}</ul>;
}
