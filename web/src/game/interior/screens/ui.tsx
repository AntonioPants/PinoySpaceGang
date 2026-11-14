/**
 * Controls for the bridge monitors, in the ship's own style: segmented switches, sliders with a
 * live readout, a drop-down list and status lights. All are ordinary focusable elements, so they
 * work with mouse and keyboard on the 3D screens.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CheckStatus } from '../checklist';

export interface Choice<T> { value: T; label: string; hint?: string }

export function Segmented<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: Choice<T>[]; onChange: (v: T) => void }) {
  return <div className="mon-field"><span className="mon-label">{label}</span>
    <div className="mon-segmented" role="group" aria-label={label}>{options.map(o => <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>
  </div>;
}

export function Slider({ label, value, min, max, step, unit, disabled, note, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; disabled?: boolean; note?: string; onChange: (v: number) => void }) {
  const id = useId(), fill = ((value - min) / (max - min)) * 100;
  return <div className={`mon-field mon-slider ${disabled ? 'off' : ''}`}>
    <label htmlFor={id} className="mon-label">{label}<output htmlFor={id}>{value.toLocaleString()}<small> {unit}</small></output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} style={{ '--fill': `${fill}%` } as React.CSSProperties} onChange={e => onChange(Number(e.target.value))} />
    {note && <span className="mon-note">{note}</span>}
  </div>;
}

/** A drop-down drawn inside the monitor, so it stays on the 3D screen instead of opening a system menu. */
export function Dropdown<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Choice<T>[]; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false), box = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="mon-field mon-dropdown" ref={box}><span className="mon-label">{label}</span>
    <button type="button" className="mon-dropdown-button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>{current?.label ?? '–'}<i aria-hidden="true" /></button>
    {open && <ul role="listbox" aria-label={label}>{options.map(o => <li key={String(o.value)} role="option" aria-selected={o.value === value}>
      <button type="button" onClick={() => { onChange(o.value); setOpen(false); }}>{o.label}</button></li>)}</ul>}
  </div>;
}

const WORD: Record<CheckStatus, string> = { go: 'Go', caution: 'Caution', hold: 'Hold' };
export function Light({ status, children }: { status: CheckStatus; children?: ReactNode }) {
  return <span className={`mon-light ${status}`}><i aria-hidden="true" />{children ?? WORD[status]}</span>;
}
export const STATUS_PHRASE: Record<CheckStatus, string> = { go: 'Go for launch', caution: 'Go with caution', hold: 'Hold' };
