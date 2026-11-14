/**
 * Analog Fidelity Score for every pairing in the site catalog.
 *   npx tsx scripts/fidelity.ts [--seeds 5] [--out out/fidelity.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { analogFidelity, stressFidelity } from '../src/index.ts';
import { loadCatalogSite, readCatalog } from './catalog-node.ts';

const args = process.argv.slice(2);
const opt = (n: string, d: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const seeds = Array.from({ length: Number(opt('seeds', '3')) }, (_, i) => i + 1);

const catalog = readCatalog();
const rows = [];
for (const p of catalog.pairings) {
  const r = analogFidelity(loadCatalogSite(catalog, p.planetary_id), loadCatalogSite(catalog, p.earth_id), {
    seeds,
    catalogTerrainScore: p.terrain_score,
  });
  const t0 = Date.now();
  const stress = stressFidelity(loadCatalogSite(catalog, p.planetary_id), loadCatalogSite(catalog, p.earth_id), { catalogTerrainScore: p.terrain_score });
  rows.push({ earthId: p.earth_id, planetaryId: p.planetary_id, nominal: r, stress });
  const pc = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
  console.log(
    `${p.earth_id.padEnd(19)} → ${p.planetary_id.padEnd(15)} guided ${String(r.score).padStart(3)}  stress ${String(stress.score).padStart(3)}  ` +
      `catalog ${p.terrain_score?.toFixed(2) ?? ' – '}  | landable: planet ${pc(stress.planetary.successRate)} analog ${pc(stress.analog.successRate)} ` +
      `| slope ${stress.planetary.meanSlopeDeg.toFixed(1)}° ${stress.analog.meanSlopeDeg.toFixed(1)}° ` +
      `| fuel ${stress.planetary.meanFuelUsedKg.toFixed(0)} ${stress.analog.meanFuelUsedKg.toFixed(0)} kg  (${Date.now() - t0} ms)`,
  );
}
const out = opt('out', 'out/fidelity.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), seeds, pairings: rows }, null, 2));
console.log(`→ ${out}`);
