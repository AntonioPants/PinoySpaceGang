import { describe, expect, it } from 'vitest';
import { completePhase, nextPhase, type GameIntegrations, type GamePhase } from './contracts';
import { equipmentLoadouts } from './equipment';
import { defaultSettings, validateSettings } from '../lib/mission';
const Scene = () => null;
const missing: GameIntegrations = { planetaryArrival: null, controlCenter: Scene, liftoff: null, earthApproach: null, outcome: null };
const complete: GameIntegrations = { planetaryArrival: Scene, controlCenter: Scene, liftoff: Scene, earthApproach: Scene, outcome: Scene };
describe('game scene handoffs', () => {
  it('keeps an unfinished scene integration playable', () => {
    expect(nextPhase(null, missing)).toBe('controlCenter');
    expect(nextPhase('controlCenter', missing)).toBe('descent');
    expect(nextPhase('descent', missing)).toBe('report');
  });
  it('plays the intended order when all teammate scenes are attached', () => {
    let phase: GamePhase | null = null;
    const visited: GamePhase[] = [];
    for (let i = 0; i < 7; i++) { phase = nextPhase(phase, complete); visited.push(phase); }
    expect(visited).toEqual(['planetaryArrival','controlCenter','liftoff','earthApproach','descent','outcome','report']);
  });
  it('does not skip physics after a double click or late cinematic callback', () => {
    const phase = completePhase('earthApproach', 'earthApproach', complete);
    expect(completePhase(phase, 'earthApproach', complete)).toBe('descent');
    expect(completePhase('controlCenter', 'planetaryArrival', complete)).toBe('controlCenter');
  });
  it('keeps equipment presets valid and preserves chosen environmental inputs', () => {
    for (const loadout of equipmentLoadouts) {
      const settings = { ...defaultSettings, windSpeedMs: 9, ...loadout.settings };
      expect(validateSettings(settings)).toEqual([]); expect(settings.windSpeedMs).toBe(9);
    }
  });
});
