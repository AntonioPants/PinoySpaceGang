/**
 * Analog Fidelity Score for every pairing in the site catalog.
 *   npx tsx scripts/fidelity.ts [--seeds 5] [--out out/fidelity.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { analogFidelity } from '../src/index.ts';
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
  rows.push({ earthId: p.earth_id, planetaryId: p.planetary_id, ...r });
  console.log(
    `${p.earth_id.padEnd(20)} → ${p.planetary_id.padEnd(15)} fidelity ${String(r.score).padStart(3)}  ` +
      `(outcome ${r.components.outcome.toFixed(2)} touchdown ${r.components.touchdown.toFixed(2)} ground ${r.components.ground.toFixed(2)} fuel ${r.components.fuel.toFixed(2)})  ` +
      `catalog terrain ${p.terrain_score?.toFixed(2) ?? '–'}  planet: ${r.planetary.outcomes.join('/')}  analog: ${r.analog.outcomes.join('/')}`,
  );
}
const out = opt('out', 'out/fidelity.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), seeds, pairings: rows }, null, 2));
console.log(`→ ${out}`);
