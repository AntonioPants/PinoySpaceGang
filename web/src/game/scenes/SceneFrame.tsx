import { useEffect, useState, type ReactNode } from 'react';
import { cinematicsChoice } from '../interior/LaunchMenu';

/**
 * Shared frame for the cinematic scenes: the sound switch, and the still alternative shown when
 * the player has asked for reduced motion (with the option to play it anyway). The "Play
 * cinematics" choice made at the pilot seat overrides both ways. Sound starts on.
 */
export function SceneFrame({ title, detail, reducedMotion, onComplete, children }: {
  title: string; detail: string; reducedMotion: boolean; onComplete: () => void;
  children: (muted: boolean) => ReactNode;
}) {
  const [muted, setMuted] = useState(false);       // sound on: the click that started the mission allows it
  // The player's choice at the pilot seat wins: 'on' plays even with reduced motion, 'off' skips.
  const [choice] = useState(cinematicsChoice);
  const [playAnyway, setPlayAnyway] = useState(choice === 'on');
  useEffect(() => { if (choice === 'off') onComplete(); }, [choice, onComplete]);
  if (choice === 'off') return null;
  if (reducedMotion && !playAnyway) return <section className="systems-console" aria-label={title}>
    <h2>{title}</h2><p>{detail}</p>
    <p className="field-help">The cinematic is not played because your system asks for reduced motion.</p>
    <button className="primary-button" onClick={onComplete}>Continue</button>
    <button className="text-button" onClick={() => setPlayAnyway(true)}>Play the cinematic anyway</button>
  </section>;
  return <section className="scene-frame" aria-label={title}>
    {children(muted)}
    <button className="subtle-button scene-sound" aria-pressed={!muted} onClick={() => setMuted(m => !m)}>{muted ? 'Sound on' : 'Sound off'}</button>
  </section>;
}
