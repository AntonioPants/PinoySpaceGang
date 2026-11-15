import { describe, expect, it } from 'vitest';
import {
  createSim, syntheticTerrain, evaluateTouchdown, assessFlight, DEFAULT_LANDER,
  GEAR_PRESETS, gearConfig, gearCapability, gearTouchdown, dynamicSlopeLimitDeg, validateGear, resolveLander,
} from '../src/index.ts';

const MOON = 1.62, EARTH = 9.81;
const standard = gearConfig('standard-four'), wide = gearConfig('wide-four'), survey = gearConfig('survey-six');
const contact = (over: Partial<{ verticalSpeedMps: number; horizontalSpeedMps: number; slopeDeg: number; roughnessM: number; tiltDeg: number }> = {}) =>
  ({ verticalSpeedMps: 1, horizontalSpeedMps: 0, slopeDeg: 0, roughnessM: 0, tiltDeg: 0, ...over });
const limits = DEFAULT_LANDER.limits;

describe('landing gear capability', () => {
  it('absorbs the sink rate its stroke and damping allow: v = sqrt(2 · a · stroke · damping)', () => {
    expect(gearCapability(standard).maxSinkMps).toBeCloseTo(Math.sqrt(2 * 15 * 0.45 * 0.65), 6);
    expect(gearCapability(standard).maxSinkMps).toBeCloseTo(2.96, 2);
    expect(gearCapability(survey).maxSinkMps).toBeGreaterThan(gearCapability(standard).maxSinkMps);
    expect(gearCapability(wide).maxSinkMps).toBeLessThan(gearCapability(standard).maxSinkMps);
  });
  it('tips at atan(R · cos(pi / N) / h): a wider stance and more legs both raise the angle', () => {
    const s = gearCapability(standard);
    expect(s.supportRadiusM).toBeCloseTo(3 * Math.cos(Math.PI / 4), 6);
    expect(s.cgHeightM).toBeCloseTo(3.0, 6);
    expect(s.staticTipDeg).toBeCloseTo(Math.atan(s.supportRadiusM / 3) * 180 / Math.PI, 6);
    expect(gearCapability(wide).staticTipDeg).toBeGreaterThan(s.staticTipDeg + 5);
    expect(gearCapability({ ...standard, legs: 6 }).staticTipDeg).toBeGreaterThan(s.staticTipDeg);
  });
  it('takes up more relief with longer stroke, wider pads and six legs', () => {
    expect(gearCapability(standard).roughnessToleranceM).toBeCloseTo(0.5, 2);
    expect(gearCapability(survey).roughnessToleranceM).toBeGreaterThan(gearCapability(wide).roughnessToleranceM);
    expect(gearCapability(wide).roughnessToleranceM).toBeGreaterThan(gearCapability(standard).roughnessToleranceM);
  });
  it('rates the standard gear near 12 degrees on the Moon, and every gear steeper on Earth', () => {
    expect(dynamicSlopeLimitDeg(standard, MOON)).toBeGreaterThan(11);
    expect(dynamicSlopeLimitDeg(standard, MOON)).toBeLessThan(13);
    for (const g of [standard, wide, survey]) expect(dynamicSlopeLimitDeg(g, EARTH)).toBeGreaterThan(dynamicSlopeLimitDeg(g, MOON) + 1);
    expect(dynamicSlopeLimitDeg(wide, MOON)).toBeGreaterThan(dynamicSlopeLimitDeg(standard, MOON) + 3);
  });
  it('marks a trimmed preset as custom and rejects impossible gear', () => {
    expect(gearConfig('standard-four').gearId).toBe('standard-four');
    expect(gearConfig('standard-four', { strokeM: 0.7 })).toMatchObject({ gearId: 'custom', strokeM: 0.7, legs: 4, radiusM: 3 });
    expect(validateGear(standard)).toEqual([]);
    expect(validateGear({ ...standard, legs: 2, strokeM: 0 })).toHaveLength(2);
    expect(() => createSim({ site: syntheticTerrain({ hillsM: 0 }), strategy: 'manual', lander: { gear: { ...standard, dampingRatio: 3 } } })).toThrow('dampingRatio');
  });
});

describe('touchdown on a landing gear', () => {
  it('reports stroke used, and bottoms out past the sink rate the gear absorbs', () => {
    const soft = evaluateTouchdown(contact({ verticalSpeedMps: 2 }), limits, { gear: standard, gravity: MOON });
    expect(soft.outcome).toBe('success');
    expect(soft.gear!.strokeUsedM).toBeCloseTo(0.45 * (2 / gearCapability(standard).maxSinkMps) ** 2, 6);
    const hard = evaluateTouchdown(contact({ verticalSpeedMps: 3.3 }), limits, { gear: standard, gravity: MOON });
    expect(hard.outcome).toBe('hard-landing');
    expect(hard.gear!.strokeUsedM).toBe(0.45);
    expect(hard.reasons[0]).toMatch(/leg stroke bottomed out at 0\.45 m: 3\.30 m\/s sink rate/);
    expect(evaluateTouchdown(contact({ verticalSpeedMps: 6.5 }), limits, { gear: standard, gravity: MOON }).outcome).toBe('crash');
  });
  it('a short stroke fails the impact a survey gear survives', () => {
    const short = gearConfig('standard-four', { strokeM: 0.3 });
    const impact = contact({ verticalSpeedMps: 3.3 });
    expect(evaluateTouchdown(impact, limits, { gear: short, gravity: MOON }).outcome).toBe('hard-landing');
    expect(evaluateTouchdown(impact, limits, { gear: survey, gravity: MOON }).outcome).toBe('success');
  });
  it('a 15 degree slope tips the standard gear and is held by the wide gear', () => {
    const steep = contact({ verticalSpeedMps: 1.5, horizontalSpeedMps: 0.5, slopeDeg: 15 });
    const std = evaluateTouchdown(steep, limits, { gear: standard, gravity: MOON });
    expect(std.outcome).toBe('tip-over');
    expect(std.reasons.join(' ')).toMatch(/tipped over: 15\.0° slope/);
    expect(std.gear!.tipMarginDeg).toBe(0);
    const held = evaluateTouchdown(steep, limits, { gear: wide, gravity: MOON });
    expect(held.outcome).toBe('success');
    expect(held.gear!.tipMarginDeg).toBeGreaterThan(0);
    expect(held.gear!.peakLeanDeg).toBeGreaterThan(15);
  });
  it('the same touchdown that goes over on the Moon stays upright in Earth gravity', () => {
    const c = contact({ verticalSpeedMps: 2, horizontalSpeedMps: 1.4, slopeDeg: 11 });
    expect(gearTouchdown(standard, c, MOON).tipped).toBe(true);
    expect(gearTouchdown(standard, c, EARTH).tipped).toBe(false);
  });
  it('lateral speed alone can tip a lander on level ground, and a slope past the tip angle always does', () => {
    expect(gearTouchdown(standard, contact({ horizontalSpeedMps: 0.5 }), MOON).tipped).toBe(false);
    expect(gearTouchdown(standard, contact({ horizontalSpeedMps: 2.3 }), MOON).tipped).toBe(true);
    expect(gearTouchdown(wide, contact({ horizontalSpeedMps: 0, verticalSpeedMps: 0.2, slopeDeg: 44 }), EARTH)).toMatchObject({ tipped: true, tipRatio: Infinity });
  });
  it('a perfectly gentle touchdown still goes over on ground steep enough, in any gravity', () => {
    const gentle = (slopeDeg: number) => contact({ verticalSpeedMps: 0.3, horizontalSpeedMps: 0, slopeDeg });
    for (const gravity of [MOON, EARTH]) {
      expect(gearTouchdown(standard, gentle(12), gravity).tipped).toBe(false);
      expect(gearTouchdown(standard, gentle(17), gravity).tipped).toBe(true);
      expect(gearTouchdown(wide, gentle(17), gravity).tipped).toBe(false);
    }
  });
  it('softer damping returns less rebound, so it tips later on a slope', () => {
    const c = contact({ verticalSpeedMps: 2.5, horizontalSpeedMps: 0.8, slopeDeg: 12 });
    const stiff = gearTouchdown(gearConfig('standard-four', { dampingRatio: 0.3 }), c, MOON);
    const soft = gearTouchdown(gearConfig('standard-four', { dampingRatio: 0.95 }), c, MOON);
    expect(soft.tipRatio).toBeLessThan(stiff.tipRatio);
  });
  it('is unchanged without a gear model', () => {
    expect(evaluateTouchdown(contact({ slopeDeg: 13 }), limits)).toEqual({ outcome: 'tip-over', survivability: 40, reasons: ['ground slope 13.0° > 12°'] });
  });
});

describe('landing gear in a flight', () => {
  const drop = (gear: typeof standard | undefined, slopeDeg: number, vz = -0.5, vx = 0) => {
    const site = syntheticTerrain({ hillsM: 0, baseSlopeDeg: slopeDeg, sizeM: 400, cellSize: 2 });
    const sim = createSim({ site, strategy: 'manual', lander: gear ? { gear } : {}, start: { position: { x: 0, y: 0, z: 0.5 }, velocity: { x: vx, y: 0, z: vz } } });
    while (!sim.state.done) sim.step({ throttle: 0, tiltX: 0, tiltY: 0 });
    return sim.telemetry();
  };
  it('adds the gear mass, uses its foot circle and derives the sink and roughness limits from it', () => {
    const lander = resolveLander({ site: syntheticTerrain({ hillsM: 0 }), strategy: 'manual', lander: { dryMassKg: 800, gear: survey } });
    expect(lander.dryMassKg).toBe(800 + GEAR_PRESETS['survey-six'].gearMassKg);
    expect(lander.legRadiusM).toBe(3.3);
    expect(lander.limits.maxVerticalMps).toBeCloseTo(gearCapability(survey).maxSinkMps, 2);
    expect(lander.limits.maxRoughnessM).toBeCloseTo(gearCapability(survey).roughnessToleranceM, 2);
    expect(lander.limits.maxSlopeDeg).toBe(DEFAULT_LANDER.limits.maxSlopeDeg);
  });
  it('holds a gentle touchdown on a 14 degree slope that the fixed 12 degree limit failed', () => {
    expect(drop(undefined, 14).summary!.outcome).toBe('tip-over');
    const tel = drop(standard, 14);
    expect(tel.summary!.outcome).toBe('success');
    expect(tel.summary!.gear!.groundLeanDeg).toBeCloseTo(14, 0);
    expect(tel.summary!.gear!.tipMarginDeg).toBeGreaterThan(5);
  });
  it('goes over on a slope steeper than its stance allows, and says why in the assessment', () => {
    const tel = drop(standard, 17, -0.5, 0.3);
    expect(tel.summary!.outcome).toBe('tip-over');
    expect(tel.events.some(e => e.type === 'tipOver')).toBe(true);
    const a = assessFlight(tel);
    expect(a.margins.find(m => m.key === 'stability')).toMatchObject({ status: 'exceeded', unit: '°' });
    expect(a.causes.map(c => c.code)).toContain('tipped');
    expect(drop(wide, 17, -0.5, 0.3).summary!.outcome).toBe('success');
  });
  it('shows slope over the guidance value as marginal, not exceeded, when the vehicle stayed up', () => {
    const a = assessFlight(drop(wide, 14));
    expect(a.outcome).toBe('success');
    expect(a.margins.find(m => m.key === 'slope')!.status).toBe('marginal');
    expect(a.margins.find(m => m.key === 'stability')!.status).toBe('within');
    expect(a.causes).toEqual([]);
  });
  it('carries no gear figures for a lander without a gear model', () => {
    const tel = drop(undefined, 0);
    expect(tel.summary!.gear).toBeUndefined();
    expect(assessFlight(tel).margins.some(m => m.key === 'stability')).toBe(false);
  });
});
