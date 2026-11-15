import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import { acquireEarthTiles } from './earthTilesResource';

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('Earth tile lifetime', () => {
  it('retains the tile hierarchy across a synchronous site replacement and disposes on unmount', () => {
    vi.useFakeTimers();
    const renderer = {} as WebGLRenderer;
    const first = acquireEarthTiles(renderer, true);
    const dispose = vi.spyOn(first.tiles, 'dispose');
    first.release();
    const second = acquireEarthTiles(renderer, true);
    vi.runAllTimers();
    expect(second.tiles).toBe(first.tiles);
    expect(dispose).not.toHaveBeenCalled();
    second.release();
    second.release();
    vi.runAllTimers();
    expect(dispose).toHaveBeenCalledTimes(1);
    const next = acquireEarthTiles(renderer, true);
    expect(next.tiles).not.toBe(first.tiles);
    next.release();
  });

  it('keeps distinct WebGL renderers and cinematic tile sets independent', () => {
    vi.useFakeTimers();
    const renderer = {} as WebGLRenderer;
    const opening = acquireEarthTiles(renderer, true);
    const cinematic = acquireEarthTiles(renderer, false);
    const other = acquireEarthTiles({} as WebGLRenderer, true);
    expect(cinematic.tiles).not.toBe(opening.tiles);
    expect(other.tiles).not.toBe(opening.tiles);
    const dispose = vi.spyOn(cinematic.tiles, 'dispose');
    cinematic.release();
    expect(dispose).toHaveBeenCalledTimes(1);
    opening.release();
    other.release();
  });
});
