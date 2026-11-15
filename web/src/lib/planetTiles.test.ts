import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, type WebGLRenderer } from 'three';

const state = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('3d-tiles-renderer/three', () => ({ TilesRenderer: class {
  group = new Group(); lruCache = {}; downloadQueue = {}; parseQueue = {};
  manager = { addHandler: vi.fn() }; loadProgress = 1;
  listeners = new Map<string, (event: any) => void>();
  dispose = vi.fn(); update = vi.fn();
  constructor() { state.instances.push(this); }
  registerPlugin() {} hasCamera() { return true; } setCamera() {} setResolutionFromRenderer() {}
  getAttributions() { return []; }
  addEventListener(name: string, callback: (event: any) => void) { this.listeners.set(name, callback); }
  emit(name: string, event = {}) { this.listeners.get(name)?.(event); }
} }));
vi.mock('./cesiumIonAuth', () => ({ DisposableCesiumIonAuthPlugin: class {} }));
vi.mock('three/addons/loaders/DRACOLoader.js', () => ({ DRACOLoader: class {
  manager = { setURLModifier() {} }; setDecoderConfig() {} dispose() {}
} }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { setDRACOLoader() { return this; } } }));
import { createPlanetTiles } from './planetTiles';

const cameras = [new PerspectiveCamera()];
beforeEach(() => { state.instances.length = 0; vi.useFakeTimers({ toFake: ['performance'] }); });
afterEach(() => vi.useRealTimers());
const create = () => createPlanetTiles('Moon', 1, {} as WebGLRenderer);
function ready(world: ReturnType<typeof create>) {
  state.instances.at(-1).emit('tile-visibility-change', { visible: true });
  for (let i = 0; i < 8; i++) world.update(cameras);
}

it.each(['endpoint', 'child tile'])('automatically recovers a transient %s failure without replacing the scene attachment', kind => {
  const world = create(), group = world.group, first = state.instances[0];
  first.emit('load-error', { tile: kind === 'endpoint' ? null : {} });
  world.update(cameras);
  expect(world.failed).toBe(false);
  vi.advanceTimersByTime(999); world.update(cameras);
  expect(state.instances).toHaveLength(1);
  vi.advanceTimersByTime(1); world.update(cameras);
  expect(state.instances).toHaveLength(2);
  expect(first.dispose).toHaveBeenCalledOnce();
  expect(world.group).toBe(group); expect(group.children).toHaveLength(1);
  ready(world); expect(world.ready).toBe(true); expect(world.failed).toBe(false);
  world.dispose();
});

it('bounds retries even when many requests fail together', () => {
  const world = create();
  for (const delay of [1000, 3000]) {
    for (let i = 0; i < 10; i++) state.instances.at(-1).emit('load-error');
    world.update(cameras); vi.advanceTimersByTime(delay); world.update(cameras);
  }
  state.instances.at(-1).emit('load-error'); world.update(cameras);
  expect(world.failed).toBe(true); expect(world.ready).toBe(false);
  vi.advanceTimersByTime(60000); world.update(cameras);
  expect(state.instances).toHaveLength(3); world.dispose();
});

it('does not restart after disposal while a retry is pending', () => {
  const world = create(); state.instances[0].emit('load-error'); world.update(cameras);
  world.dispose(); vi.advanceTimersByTime(10000); world.update(cameras);
  expect(state.instances).toHaveLength(1); expect(world.ready).toBe(false);
});

it('keeps a prepared world when a later refinement fails', () => {
  const world = create(); ready(world);
  state.instances[0].loadProgress = .5; state.instances[0].emit('load-error');
  world.update(cameras); vi.advanceTimersByTime(10000); world.update(cameras);
  expect(world.ready).toBe(true); expect(world.failed).toBe(false);
  expect(state.instances).toHaveLength(1); world.dispose();
});
