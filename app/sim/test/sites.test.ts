import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseSites, parseSite, runSim } from '../src/index.ts';

describe('sites.json', () => {
  it('parses the example file and flies it', () => {
    const sites = parseSites(JSON.parse(readFileSync(new URL('../fixtures/sites.example.json', import.meta.url), 'utf8')));
    expect(sites.map((s) => s.id)).toEqual(['shackleton-rim', 'devon-island-haughton']);
    const tel = runSim({ site: sites[1], strategy: 'autonomous', start: { position: { x: -10, y: 0, z: 300 }, velocity: { x: 2, y: 0, z: -5 } } });
    expect(tel.environment.gravity).toBe(3.71);
    expect(tel.summary).toBeDefined();
  });

  it('rejects malformed heightmaps with a readable error', () => {
    expect(() => parseSite({ id: 'x', body: 'moon', heightmap: { cols: 2, rows: 2, cellSize: 1, heights: [1, 2, 3] } })).toThrow(
      /cols\*rows = 4/,
    );
    expect(() => parseSite({ id: 'x', body: 'venus' })).toThrow(/body/);
  });
});
