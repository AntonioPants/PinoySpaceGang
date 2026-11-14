import { useState, type ReactNode } from 'react';

/**
 * Shared frame for the cinematic scenes: the sound switch, and the still alternative shown when
 * the player has asked for reduced motion. Sound starts off; it needs a deliberate choice.
 */
export function SceneFrame({ title, detail, reducedMotion, onComplete, children }: {
  title: string; detail: string; reducedMotion: boolean; onComplete: () => void;
  children: (muted: boolean) => ReactNode;
}) {
  const [muted, setMuted] = useState(true);
  if (reducedMotion) return <section className="systems-console" aria-label={title}>
    <h2>{title}</h2><p>{detail}</p>
    <p className="field-help">The cinematic is not played because your system asks for reduced motion.</p>
    <button className="primary-button" onClick={onComplete}>Continue</button>
  </section>;
  return <section className="scene-frame" aria-label={title}>
    {children(muted)}
    <button className="subtle-button scene-sound" aria-pressed={!muted} onClick={() => setMuted(m => !m)}>{muted ? 'Sound on' : 'Sound off'}</button>
  </section>;
}
