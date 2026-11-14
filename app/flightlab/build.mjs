// Builds dist/flight-lab.html: one self-contained page (three.js, the physics engine from app/sim
// and the terrain pack are inlined).   cd app/flightlab && npm install && npm run build
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packDir = join(here, "../../web/public/terrain", process.argv[2] ?? "kilbourne-hole-v1");

// the pack is inlined so the page also works when opened straight from disk
mkdirSync(join(here, "pack"), { recursive: true });
copyFileSync(join(packDir, "load-terrain.mjs"), join(here, "pack/load-terrain.mjs"));
const manifest = readFileSync(join(packDir, "manifest.json"), "utf8");
const f32 = readFileSync(join(packDir, "elevation.f32")).toString("base64");
writeFileSync(join(here, "terrain-data.ts"), `export const MANIFEST = ${JSON.stringify(JSON.parse(manifest))};\nexport const F32_B64 = ${JSON.stringify(f32)};\n`);

const out = await build({ entryPoints: [join(here, "main.ts")], bundle: true, minify: true, format: "iife", write: false,
  nodePaths: [join(here, "node_modules")], logLevel: "warning" });
const js = out.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
mkdirSync(join(here, "dist"), { recursive: true });
writeFileSync(join(here, "dist/flight-lab.html"), readFileSync(join(here, "index.html"), "utf8").replace("/*BUNDLE*/", () => js));
console.log("dist/flight-lab.html", Math.round(js.length / 1024), "KiB");
